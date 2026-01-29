// BE-00010/modules/product/services/product-read.service.ts

import { Inject, Injectable, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { REDIS_CLIENT } from '../../../database/redis/redis.constants';
import { ProductCacheService } from './product-cache.service';
import { CategoryService } from '../../category/category.service';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';

interface FindAllPublicDto {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  categorySlug?: string;
  brandId?: number;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  sort?: string;
  tag?: string;
}

@Injectable()
export class ProductReadService implements OnModuleInit {
  private readonly logger = new Logger(ProductReadService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly productCache: ProductCacheService,
    private readonly categoryService: CategoryService,
  ) {}

  async onModuleInit() {
    try {
      // Schema: name, price, salesCount, status, image, slug
      await this.redis.call(
        'FT.CREATE', 
        'idx:products', 
        'ON', 'HASH', 
        'PREFIX', '1', 'product:', 
        'SCHEMA', 
        'name', 'TEXT', 'WEIGHT', '5.0', 'SORTABLE', 
        'slug', 'TEXT', 'NOSTEM', // Thêm slug để search chính xác
        'price', 'NUMERIC', 'SORTABLE',
        'salesCount', 'NUMERIC', 'SORTABLE',
        'status', 'TAG'
      );
      this.logger.log('RediSearch Index created');
    } catch (e: any) {
        // Bỏ qua lỗi Index already exists
        if (!e.message?.includes('Index already exists')) {
             this.logger.error('Failed to create index', e);
        }
    }
  }

  // [QUAN TRỌNG] Hàm này dùng để đồng bộ sản phẩm ban đầu vào Redis
  async syncAllProductsToRedis() {
    const products = await this.prisma.product.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, price: true, salesCount: true, status: true, slug: true, images: true, description: true }
    });

    const pipeline = this.redis.pipeline();
    for (const p of products) {
        const key = `product:${p.id}`;
        // Lưu data dạng phẳng cho Hash
        pipeline.hset(key, {
            name: p.name,
            description: p.description || '',
            price: Number(p.price),
            salesCount: p.salesCount || 0,
            status: p.status,
            id: p.id,
            slug: p.slug,
            // Chỉ lưu ảnh đầu tiên để hiển thị nhanh ở Search Suggestion
            image: Array.isArray(p.images) ? p.images[0] : (p.images as any)?.url || '' 
        });
    }
    await pipeline.exec();
    this.logger.log(`Synced ${products.length} products to RediSearch`);
    return { count: products.length };
  }

  async syncProductToRedis(product: any) {
    const key = `product:${product.id}`;
    // Lưu dưới dạng Hash để RediSearch đánh index
    await this.redis.hset(key, {
      name: product.name,
      description: product.description || '',
      price: product.price,
      salesCount: product.salesCount || 0,
      status: product.status,
      id: product.id,
      slug: product.slug,
      image: product.images?.[0] || '' // Lấy ảnh đại diện
    });
  }

  // 1. Lấy Feed cá nhân hóa (Logic phức tạp + Redis)
  async getPersonalizedFeed(userId: string, page: number, limit: number) {
    const trackingKey = `user:affinity:${userId}`;
    const start = (page - 1) * limit;
    const stop = start + limit - 1;

    // A. Thử lấy ID từ Redis Score (User Affinity)
    let productIds = await this.redis.zrevrange(trackingKey, start, stop);

    // B. Fallback 1: Nếu không có dữ liệu cá nhân -> Lấy Trending từ Redis
    if (productIds.length === 0) {
      productIds = await this.redis.zrevrange('global:trending', start, stop);
    }

    // C. Hydrate dữ liệu từ Cache Service
    const products = await this.productCache.getProductsByIds(productIds);
    
    // D. Filter Active: Chỉ lấy sản phẩm ACTIVE (Đã duyệt)
    let activeProducts = products.filter(p => p.status === 'ACTIVE');

    // --- [LOGIC MỚI - GIẢI PHÁP BỀN VỮNG] ---
    // Nếu số lượng lấy từ Redis KHÔNG ĐỦ limit -> Gọi Database bù vào.
    if (activeProducts.length < limit) {
        const missingCount = limit - activeProducts.length;
        
        // Gọi hàm findAllPublic để lấy sản phẩm mới nhất từ DB
        const dbFallback = await this.findAllPublic({ 
            page: 1, 
            limit: missingCount 
        });

        // Merge dữ liệu: Cache + DB (loại bỏ trùng lặp)
        const currentIds = new Set(activeProducts.map(p => p.id));
        const newItems = dbFallback.data.filter((p: any) => !currentIds.has(p.id));
        
        activeProducts = [...activeProducts, ...newItems];
    }

    return {
      data: activeProducts,
      meta: { page, limit, total: 1000 },
    };
  }

  // 2. Lấy danh sách Public (Search + Pagination)
  async findAllPublic(query: FindAllPublicDto) {
    // 1. [CACHING LAYER]
    const queryHash = createHash('md5')
      .update(JSON.stringify(query))
      .digest('hex');
    
    const cacheKey = `search_result:${queryHash}`;
    
    // Check Cache
    const cachedResult = await this.redis.get(cacheKey);
    if (cachedResult) {
        return JSON.parse(cachedResult);
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    let resultData: any = null; 

    // Logic 1: Redis Search (Chỉ chạy khi có keyword search)
    if (query.search && query.search.trim().length > 0) {
        try {
            // [FIXED] Loại bỏ ký tự đặc biệt gây lỗi cú pháp Redis
            const cleanKeyword = query.search.replace(/[@!{}()|<>*%.]/g, '');
            if (cleanKeyword) {
                const terms = cleanKeyword.trim().split(/\s+/);
                
                // [FIXED] Dùng Prefix search (t*) thay vì %t% để tối ưu tốc độ
                const nameQuery = terms.map(t => `${t}*`).join(' '); 
                const ftQuery = `@status:{ACTIVE} @name:${nameQuery}`;

                const searchRes: any = await this.redis.call(
                    'FT.SEARCH', 'idx:products', 
                    ftQuery,
                    'LIMIT', skip, limit,
                    'SORTBY', 'salesCount', 'DESC',
                    // [TỐI ƯU] Return field trực tiếp để không phải query DB lại
                    'RETURN', '5', 'id', 'name', 'price', 'slug', 'image' 
                );

                const total = searchRes[0];
                // [ĐÃ SỬA LỖI Ở ĐÂY] Thêm type : any[] cho biến data
                const data: any[] = [];

                for (let i = 1; i < searchRes.length; i += 2) {
                    const fields = searchRes[i + 1];
                    const item: any = {};
                    for (let j = 0; j < fields.length; j += 2) {
                        item[fields[j]] = fields[j + 1];
                    }
                    
                    data.push({
                        id: item.id,
                        name: item.name,
                        slug: item.slug,
                        price: Number(item.price),
                        images: [item.image],
                    });
                }

                if (data.length > 0) {
                    resultData = {
                        data: data,
                        meta: { total, page, last_page: Math.ceil(total / limit) },
                    };
                }
            }
        } catch (e) {
            this.logger.error('RediSearch failed, falling back to DB', e);
        }
    }

    // Logic 2: Fallback DB (Chạy khi không search keyword hoặc Redis lỗi)
    if (!resultData) {
        const where: Prisma.ProductWhereInput = {
            status: 'ACTIVE',
            OR: [
                { stock: { gt: 0 } },
                { variants: { some: { stock: { gt: 0 } } } }
            ],
            ...(query.brandId ? { brandId: Number(query.brandId) } : {}),
        };

        if (query.search) {
            const keywords = query.search.trim().split(/\s+/).filter(k => k.length > 0);
            if (keywords.length > 0) {
                where.AND = keywords.map(word => ({
                    name: { contains: word }
                }));
            }
        }

        if (query.minPrice !== undefined || query.maxPrice !== undefined) {
            where.price = {};
            if (query.minPrice) where.price.gte = Number(query.minPrice);
            if (query.maxPrice) where.price.lte = Number(query.maxPrice);
        }
        
        const [productIdsData, total] = await Promise.all([
            this.prisma.product.findMany({
                where,
                take: limit,
                skip: skip,
                orderBy: { createdAt: 'desc' },
                select: { id: true },
            }),
            this.prisma.product.count({ where }),
        ]);

        const productIds = productIdsData.map((p) => p.id);
        const products = await this.productCache.getProductsByIds(productIds);

        resultData = {
            data: products,
            meta: {
                total,
                page,
                last_page: Math.ceil(total / limit),
            },
        };
    }

    // 3. [SET CACHE]
    if (resultData && resultData.data && resultData.data.length > 0) {
        await this.redis.set(
            cacheKey, 
            JSON.stringify(resultData), 
            'EX', 
            300 
        );
    }

    return resultData;
  }

  // --- 3. FIX BUG: Lấy chi tiết Public ---
  async findOnePublic(idOrSlug: string) {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

    // [BƯỚC 1: KIỂM TRA CACHE]
    if (isUUID) {
      const cachedProduct = await this.productCache.getProductDetail(idOrSlug);
      if (cachedProduct && cachedProduct.status === 'ACTIVE' && cachedProduct.tiers) {
         return cachedProduct; 
      }
    }

    // [BƯỚC 2: QUERY DB]
    const product = await this.prisma.product.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
        seller: { select: { name: true, id: true, avatar: true } }, 
        options: {
            include: { values: { orderBy: { id: 'asc' } } },
            orderBy: { position: 'asc' } 
        },
        variants: true,
      },
    });

    if (!product || product.status !== 'ACTIVE') {
        throw new NotFoundException('Sản phẩm không tồn tại hoặc chưa được duyệt');
    }

    // [BƯỚC 3: MAPPING]
    const mappedProduct = {
        ...product,
        sellerId: product.sellerId || product.seller?.id, 
        categoryId: product.categoryId, 
        
        price: Number(product.price), 
        regularPrice: product.originalPrice ? Number(product.originalPrice) : undefined,
        
        tiers: product.options.map(opt => ({
            name: opt.name,
            options: opt.values.map(v => v.value), 
            images: opt.values.map(v => v.image || '') 
        })),

        variations: product.variants.map(v => {
            let safeTierIndex: number[] = [];
            if (Array.isArray(v.tierIndex)) {
                safeTierIndex = v.tierIndex as number[];
            } else if (typeof v.tierIndex === 'string' && (v.tierIndex as string).length > 0) {
                safeTierIndex = (v.tierIndex as string).split(',').map(n => parseInt(n, 10));
            }

            return {
                ...v,
                price: Number(v.price),
                stock: Number(v.stock),
                sku: v.sku,
                imageUrl: v.image,
                tierIndex: safeTierIndex,
            };
        })
    };

    // [BƯỚC 4: UPDATE CACHE]
    if (isUUID) {
        await this.productCache.setProductDetail(product.id, mappedProduct); 
    }

    return mappedProduct; 
  }

  // 4. Lấy sản phẩm liên quan
  async findRelated(productId: string) {
    const currentProduct = await this.productCache.getProductDetail(productId);
    if (!currentProduct) return [];

    return this.prisma.product.findMany({
      where: {
        id: { not: productId },
        status: 'ACTIVE',
        stock: { gt: 0 },
        categoryId: currentProduct.categoryId,
      },
      take: 12,
      orderBy: { salesCount: 'desc' },
      select: {
        id: true, name: true, price: true, images: true, stock: true, slug: true, rating: true, salesCount: true
      },
    });
  }

  async findShopProducts(shopId: string, query: { 
      page?: number; 
      limit?: number; 
      sort?: string; 
      categoryId?: string;
      minPrice?: number;
      maxPrice?: number;
      rating?: number;
  }) {
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 12;
      const skip = (page - 1) * limit;

      const where: Prisma.ProductWhereInput = {
          shopId: shopId,
          status: 'ACTIVE',
          stock: { gt: 0 }, 
      };

      if (query.categoryId && query.categoryId !== 'all') {
          where.shopCategoryId = query.categoryId;
      }

      if (query.minPrice !== undefined || query.maxPrice !== undefined) {
          where.price = {};
          if (query.minPrice) where.price.gte = Number(query.minPrice);
          if (query.maxPrice) where.price.lte = Number(query.maxPrice);
      }

      if (query.rating) {
          where.rating = { gte: Number(query.rating) };
      }

      let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' }; 

      switch (query.sort) {
          case 'price_asc':
              orderBy = { price: 'asc' };
              break;
          case 'price_desc':
              orderBy = { price: 'desc' };
              break;
          case 'sales':
              orderBy = { salesCount: 'desc' };
              break;
          case 'rating':
              orderBy = { rating: 'desc' };
              break;
          default: 
              orderBy = { createdAt: 'desc' };
      }

      const [products, total] = await Promise.all([
          this.prisma.product.findMany({
              where,
              take: limit,
              skip,
              orderBy,
          }),
          this.prisma.product.count({ where })
      ]);

      return {
          data: products,
          meta: {
              total,
              page,
              limit,
              last_page: Math.ceil(total / limit)
          }
      };
  }
  
  async findMoreFromShop(productId: string) {
    const cachedProduct = await this.productCache.getProductDetail(productId);
    let shopId = cachedProduct?.shopId; 

    if (!shopId) {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        select: { shopId: true } 
      });
      shopId = product?.shopId;
    }

    if (!shopId) return [];

    return this.prisma.product.findMany({
      where: {
        shopId: shopId,         
        id: { not: productId },  
        status: 'ACTIVE',
      },
      take: 6, 
      orderBy: { createdAt: 'desc' }, 
      select: {
        id: true, name: true, price: true, images: true, stock: true, slug: true, rating: true, salesCount: true
      },
    });
  }

  // 6. Sản phẩm mua kèm (Frequently Bought Together)
  async findBoughtTogether(productId: string) {
    const cacheKey = `product:bought_together:${productId}`;
    const cachedData = await this.redis.get(cacheKey);
    if (cachedData) return JSON.parse(cachedData);

    const orders = await this.prisma.orderItem.findMany({
      where: { productId: productId },
      select: { orderId: true },
      take: 50,
      orderBy: { order: { createdAt: 'desc' } }
    });

    const orderIds = orders.map(o => o.orderId);
    if (orderIds.length === 0) return [];

    const relatedItems = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        orderId: { in: orderIds },
        productId: { not: productId }
      },
      _count: { productId: true },
      orderBy: { _count: { productId: 'desc' } },
      take: 6
    });

    const relatedIds = relatedItems
        .map(item => item.productId)
        .filter((id): id is string => id !== null);

    if (relatedIds.length > 0) {
        const products = await this.prisma.product.findMany({
            where: {
                id: { in: relatedIds },
                status: 'ACTIVE'
            },
            include: {
                options: { include: { values: true } },
                variants: true 
            }
        });
        const activeProducts = products.filter(p => p.status === 'ACTIVE' && p.stock > 0);
        
        await this.redis.set(cacheKey, JSON.stringify(activeProducts), 'EX', 86400);
        return activeProducts;
    }

    return [];
  }

  async searchProductsForAdmin(query: string) {
    return this.prisma.product.findMany({
      where: {
        name: { contains: query },
      },
      select: {
        id: true,
        name: true,
        images: true, 
        variants: true,
        price: true,
      },
      take: 20, 
    });
  }

  async findAllForSeller(sellerId: string, query: { page?: number; limit?: number; keyword?: string }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      shopId: sellerId,
    };

    if (query.keyword) {
      where.name = { contains: query.keyword };
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          variants: true, 
          category: true, 
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products,
      meta: {
        total,
        page,
        limit,
        last_page: Math.ceil(total / limit),
      },
    };
  }
}