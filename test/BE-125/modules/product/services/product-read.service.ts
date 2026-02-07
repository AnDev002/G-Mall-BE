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

const SUGGESTION_KEY = 'sug:products';
const INDEX_NAME = 'idx:products';

@Injectable()
export class ProductReadService implements OnModuleInit {
  private readonly logger = new Logger(ProductReadService.name);
  private readonly INDEX_NAME = 'idx:products';
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly productCache: ProductCacheService,
    private readonly categoryService: CategoryService,
  ) {}

  async onModuleInit() {
    // Tự động kiểm tra và tạo lại Index khi khởi động
    await this.ensureSearchIndex();
  }

  // ===========================================================================
  // [FIX 1] DATA CLEANING - Làm sạch dữ liệu rác từ Crawler
  // ===========================================================================
  private cleanSystemTags(inputTags: any): string {
    let tags: string[] = [];
    if (Array.isArray(inputTags)) {
        tags = inputTags;
    } else if (typeof inputTags === 'string') {
        try {
            const parsed = JSON.parse(inputTags);
            if (Array.isArray(parsed)) tags = parsed;
        } catch {
            tags = inputTags.split(',');
        }
    }

    if (!tags || tags.length === 0) return '';

    const cleanedTags = tags
        .map(t => {
            if (typeof t !== 'string') return '';
            // Chuẩn hóa tag: Xóa ký tự đặc biệt, giữ lại chữ cái, số, dấu _ và dấu -
            return t.trim().replace(/[^a-zA-Z0-9_\-\u00C0-\u1EF9\s]/g, ''); 
        })
        .filter(t => t.length > 0);

    return Array.from(new Set(cleanedTags)).join(','); 
  }

  // ===========================================================================
  // [FIX 2] REDIS HELPERS - Xử lý Query an toàn
  // ===========================================================================
  
  // Helper cho TEXT (@name): Escape ký tự đặc biệt bằng \
  private escapeRediSearchText(str: string): string {
    return str.replace(/([^a-zA-Z0-9\s\u00C0-\u1EF9\-])/g, '\\$1').trim();
  }

  // Helper cho TAG (@systemTags): KHÔNG dùng \, chỉ thay thế ký tự lỗi
  private sanitizeTagForQuery(str: string): string {
    // Với Tag Query {}, ta chỉ cần đảm bảo không có ký tự phá vỡ cú pháp {}
    // Loại bỏ các ký tự đặc biệt, chỉ giữ lại alphanumeric và dấu _ -
    return str.replace(/[^a-zA-Z0-9_\-\u00C0-\u1EF9]/g, '').trim();
  }

  private async ensureSearchIndex() {
    try {
      const info = await this.redis.call('FT.INFO', INDEX_NAME).catch(() => null);
      if (!info) {
        await this.redis.call(
          'FT.CREATE', INDEX_NAME,
          'ON', 'HASH',
          'PREFIX', '1', 'product:',
          'SCHEMA',
          'name', 'TEXT', 'WEIGHT', '5.0', 'SORTABLE',
          'slug', 'TEXT', 'NOSTEM',
          'price', 'NUMERIC', 'SORTABLE',
          'salesCount', 'NUMERIC', 'SORTABLE',
          'createdAt', 'NUMERIC', 'SORTABLE',
          'status', 'TAG',
          // [FIX]: Định nghĩa TAG với separator dấu phẩy
          'systemTags', 'TAG', 'SEPARATOR', ',' 
        );
        this.logger.log('✅ RediSearch Index Created with systemTags!');
        // Tự động sync lại dữ liệu khi tạo mới index
        await this.syncAllProductsToRedis();
      }
    } catch (e) {
      this.logger.error(`Index Error: ${e}`);
    }
  }

  private async createSearchIndex() {
      try {
        await this.redis.call(
            'FT.CREATE', this.INDEX_NAME, 
            'ON', 'HASH', 
            'PREFIX', '1', 'product:', 
            'SCHEMA', 
            'name', 'TEXT', 'WEIGHT', '5.0', 'SORTABLE', 
            'slug', 'TEXT', 'NOSTEM', 
            'price', 'NUMERIC', 'SORTABLE',
            'salesCount', 'NUMERIC', 'SORTABLE',
            'createdAt', 'NUMERIC', 'SORTABLE',
            'status', 'TAG',
            'systemTags', 'TAG', 'SEPARATOR', ',' // [QUAN TRỌNG] Định nghĩa separator
        );
        this.logger.log('✅ RediSearch Index created');
        await this.syncAllProductsToRedis();
      } catch (e: any) {
         if(!e.message?.includes('already exists')) {
             this.logger.error(`Create Index Error: ${e.message}`);
         }
      }
  }

  async syncAllProductsToRedis() {
    try {
        const products = await this.prisma.product.findMany({
            where: { status: 'ACTIVE' },
            select: { 
                id: true, name: true, price: true, salesCount: true, 
                status: true, slug: true, images: true, originalPrice: true,
                systemTags: true, createdAt: true,
                isDiscountActive: true, discountType: true, discountValue: true
            }
        });

        const pipeline = this.redis.pipeline();
        await this.redis.del(SUGGESTION_KEY);

        for (const p of products) {
            const key = `product:${p.id}`;
            const image = Array.isArray(p.images) && p.images.length > 0 ? (p.images[0] as any) : '';
            const tagsString = this.cleanSystemTags(p.systemTags);
            
            const frontendJson = JSON.stringify({
                id: p.id,
                name: p.name,
                slug: p.slug,
                price: Number(p.price),
                originalPrice: Number(p.originalPrice || 0),
                images: [image],
                salesCount: p.salesCount || 0,
                isDiscountActive: p.isDiscountActive,
                discountType: p.discountType,
                discountValue: Number(p.discountValue || 0)
            });

            pipeline.hset(key, {
                name: p.name,
                price: Number(p.price),
                salesCount: p.salesCount || 0,
                createdAt: p.createdAt ? new Date(p.createdAt).getTime() : 0, 
                status: p.status,
                id: p.id,
                slug: p.slug,
                json: frontendJson,
                systemTags: tagsString 
            });

            // Sync Suggestion
            const score = p.salesCount > 0 ? p.salesCount : 1;
            const payload = JSON.stringify({ id: p.id, slug: p.slug, price: Number(p.price), image });
            pipeline.call('FT.SUGADD', SUGGESTION_KEY, p.name, score.toString(), 'PAYLOAD', payload);
        }
        
        await pipeline.exec();
        this.logger.log(`Synced ${products.length} products to Redis.`);
    } catch (e: any) {
        this.logger.error(`Sync Error: ${e.message}`);
    }
  }

  async syncProductToRedis(product: any) {
    const key = `product:${product.id}`;
    const image = Array.isArray(product.images) && product.images.length > 0 ? (product.images[0] as any) : '';
    const tagsString = this.cleanSystemTags(product.systemTags);

    const frontendJson = JSON.stringify({
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: Number(product.price),
        originalPrice: Number(product.originalPrice || 0),
        images: [image],
        salesCount: product.salesCount || 0,
        isDiscountActive: product.isDiscountActive,
        discountType: product.discountType,
        discountValue: Number(product.discountValue || 0)
    });

    await this.redis.hset(key, {
      name: product.name,
      price: Number(product.price),
      salesCount: product.salesCount || 0,
      createdAt: product.createdAt ? new Date(product.createdAt).getTime() : 0, 
      status: product.status,
      id: product.id,
      slug: product.slug,
      json: frontendJson,
      systemTags: tagsString
    });
  }

  // ===========================================================================
  // [FIX 3] SEARCH LOGIC - Fallback thông minh cho dữ liệu bẩn
  // ===========================================================================
  async findAllPublic(query: FindAllPublicDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

    let sortByField = 'createdAt';
    let sortDirection = 'DESC';
    if (query.sort === 'sales') sortByField = 'salesCount';
    if (query.sort === 'price_asc') { sortByField = 'price'; sortDirection = 'ASC'; }
    if (query.sort === 'price_desc') { sortByField = 'price'; sortDirection = 'DESC'; }

    let resultData: any = null;
    const searchKeyword = query.search ? query.search.trim() : '';
    const tagKeyword = query.tag ? query.tag.trim() : '';

    // --- BƯỚC 1: REDIS SEARCH ---
    if (searchKeyword.length > 0 || tagKeyword.length > 0) {
        try {
            // Base Query: Status Active
            let ftQuery = `@status:{ACTIVE}`;
            
            // 1. Filter by Name (Keyword)
            if (searchKeyword) {
                const cleanName = this.escapeRediSearchText(searchKeyword);
                if (cleanName) {
                    // Dùng prefix match (*) cho từng từ
                    const nameTokens = cleanName.split(/\s+/).map(t => `${t}*`).join(' ');
                    ftQuery += ` @name:(${nameTokens})`;
                }
            }

            // 2. Filter by Tag
            // [FIX LOGIC] Dùng cú pháp TAG {value}
            if (tagKeyword) {
                const cleanTag = this.sanitizeTagForQuery(tagKeyword);
                if (cleanTag) {
                   ftQuery += ` @systemTags:{${cleanTag}}`; 
                }
            }

            // 3. Thực thi Query
            const searchRes: any = await this.redis.call(
                'FT.SEARCH', this.INDEX_NAME, 
                ftQuery,
                'LIMIT', skip, limit,
                'SORTBY', sortByField, sortDirection,
                'RETURN', '1', 'json' 
            );

            const total = searchRes[0];
            if (total > 0) {
                const products: any[] = [];
                for (let i = 1; i < searchRes.length; i += 2) {
                    const fields = searchRes[i + 1];
                    if (fields && fields.length >= 2) {
                        const jsonStr = fields[fields.indexOf('json') + 1];
                        if(jsonStr) products.push(JSON.parse(jsonStr));
                    }
                }
                resultData = {
                    data: products,
                    meta: { total, page, limit, last_page: Math.ceil(total / limit) },
                };
            }
        } catch (e: any) {
            this.logger.error(`❌ [Redis Search Fail] Query: ${searchKeyword} | Tag: ${tagKeyword} - Error: ${e.message}`);
            // Fallback to DB
        }
    }

    // --- BƯỚC 2: DATABASE FALLBACK ---
    if (!resultData) {
        try {
            const whereConditions: Prisma.Sql[] = [Prisma.sql`status = 'ACTIVE'`];

            // Filter by Tag (LIKE %tag%)
            if (tagKeyword) {
                whereConditions.push(Prisma.sql`systemTags LIKE ${`%${tagKeyword}%`}`);
            }

            // Filter by Search Keyword
            if (searchKeyword) {
                const rawSearch = `%${searchKeyword}%`;
                whereConditions.push(Prisma.sql`(name LIKE ${rawSearch} OR description LIKE ${rawSearch})`);
            }

            const whereClause = whereConditions.length > 0 
                ? Prisma.sql`WHERE ${Prisma.join(whereConditions, ' AND ')}` 
                : Prisma.sql``;

            let orderBySql = Prisma.sql`ORDER BY createdAt DESC`;
            if (query.sort === 'sales') orderBySql = Prisma.sql`ORDER BY salesCount DESC`;
            else if (query.sort === 'price_asc') orderBySql = Prisma.sql`ORDER BY price ASC`;
            else if (query.sort === 'price_desc') orderBySql = Prisma.sql`ORDER BY price DESC`;

            const products = await this.prisma.$queryRaw<any[]>`
                SELECT id, name, price, slug, images, salesCount, originalPrice, createdAt, systemTags,
                       isDiscountActive, discountType, discountValue
                FROM Product 
                ${whereClause}
                ${orderBySql}
                LIMIT ${limit} OFFSET ${skip}
            `;
            
            const countResult = await this.prisma.$queryRaw<any[]>`
                SELECT COUNT(*) as total FROM Product ${whereClause}
            `;
            const total = Number(countResult[0]?.total || 0);

            resultData = {
                data: products.map(p => ({
                    ...p,
                    price: Number(p.price),
                    originalPrice: Number(p.originalPrice || 0),
                    images: typeof p.images === 'string' ? JSON.parse(p.images) : p.images,
                    isDiscountActive: Boolean(p.isDiscountActive),
                    discountType: p.discountType,
                    discountValue: Number(p.discountValue || 0)
                })),
                meta: { total, page, limit, last_page: Math.ceil(total / limit) },
            };
        } catch (dbErr) {
            this.logger.error(`❌ [DB Fallback Error] ${dbErr}`);
            return { data: [], meta: { total: 0, page, limit, last_page: 0 } };
        }
    }

    return resultData;
  }

  async removeProductFromRedis(id: string, name: string) {
      await this.redis.del(`product:${id}`);
      await this.redis.call('FT.SUGDEL', SUGGESTION_KEY, name);
  }

  // ===========================================================================
  // Các hàm phụ trợ giữ nguyên
  // ===========================================================================

  async searchSuggestions(keyword: string) {
    if (!keyword || keyword.length < 2) return [];
    try {
        const suggestions: any = await this.redis.call(
            'FT.SUGGET', SUGGESTION_KEY, keyword, 'FUZZY', 'MAX', '6', 'WITHPAYLOADS' 
        );
        const result: any = [];
        for (let i = 0; i < suggestions.length; i += 2) {
            const name = suggestions[i];
            const payloadStr = suggestions[i + 1];
            if (payloadStr) {
                const data = JSON.parse(payloadStr);
                result.push({
                    id: data.id, name: name, price: data.price, slug: data.slug, images: [data.image] 
                });
            }
        }
        return result;
    } catch (error) { return []; }
  }

  async findOnePublic(idOrSlug: string) {
    const cachedProduct = await this.productCache.getProductDetail(idOrSlug);
    if (cachedProduct && cachedProduct.status === 'ACTIVE') {
      return cachedProduct;
    }

    const product = await this.prisma.product.findFirst({
      where: {
        OR: [ { id: idOrSlug }, { slug: { equals: idOrSlug } } ],
      },
      include: {
        seller: { select: { name: true, id: true, avatar: true } },
        options: {
          include: { values: { orderBy: { id: 'asc' } } },
          orderBy: { position: 'asc' },
        },
        variants: true,
      },
    });

    if (!product || product.status !== 'ACTIVE') {
      throw new NotFoundException('Sản phẩm không tồn tại');
    }

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
        variants: product.variants.map(v => {
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

    await this.productCache.setProductDetail(product.id, product.slug, mappedProduct);
    return mappedProduct; 
  }

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
      where: { shopId: shopId, id: { not: productId }, status: 'ACTIVE' },
      take: 6, 
      orderBy: { createdAt: 'desc' }, 
      select: {
        id: true, name: true, price: true, images: true, stock: true, slug: true, rating: true, salesCount: true
      },
    });
  }

  async searchProductsForAdmin(query: string) {
    return this.prisma.product.findMany({
      where: { name: { contains: query } },
      select: { id: true, name: true, images: true, variants: true, price: true },
      take: 20, 
    });
  }

  async findAllForSeller(sellerId: string, query: { page?: number; limit?: number; keyword?: string }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;
    const where: Prisma.ProductWhereInput = { shopId: sellerId };
    if (query.keyword) where.name = { contains: query.keyword };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where, take: limit, skip,
        orderBy: { createdAt: 'desc' },
        include: { variants: true, category: true },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products,
      meta: { total, page, limit, last_page: Math.ceil(total / limit) },
    };
  }

  async findShopProducts(shopId: string, query: { 
      page?: number; limit?: number; sort?: string; 
      categoryId?: string; minPrice?: number; maxPrice?: number; rating?: number;
  }) {
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 12;
      const skip = (page - 1) * limit;

      const where: Prisma.ProductWhereInput = {
          shopId: shopId,
          status: 'ACTIVE',
          stock: { gt: 0 }, 
      };

      if (query.categoryId && query.categoryId !== 'all') where.shopCategoryId = query.categoryId;
      if (query.minPrice !== undefined || query.maxPrice !== undefined) {
          where.price = {};
          if (query.minPrice) where.price.gte = Number(query.minPrice);
          if (query.maxPrice) where.price.lte = Number(query.maxPrice);
      }
      if (query.rating) where.rating = { gte: Number(query.rating) };

      let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' }; 
      switch (query.sort) {
          case 'price_asc': orderBy = { price: 'asc' }; break;
          case 'price_desc': orderBy = { price: 'desc' }; break;
          case 'sales': orderBy = { salesCount: 'desc' }; break;
          case 'rating': orderBy = { rating: 'desc' }; break;
      }

      const [products, total] = await Promise.all([
          this.prisma.product.findMany({ where, take: limit, skip, orderBy }),
          this.prisma.product.count({ where })
      ]);

      return {
          data: products,
          meta: { total, page, limit, last_page: Math.ceil(total / limit) }
      };
  }

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
      where: { orderId: { in: orderIds }, productId: { not: productId } },
      _count: { productId: true },
      orderBy: { _count: { productId: 'desc' } },
      take: 6
    });

    const relatedIds = relatedItems.map(item => item.productId).filter((id): id is string => id !== null);

    if (relatedIds.length > 0) {
        const products = await this.prisma.product.findMany({
            where: { id: { in: relatedIds }, status: 'ACTIVE' },
            include: { options: { include: { values: true } }, variants: true }
        });
        const activeProducts = products.filter(p => p.status === 'ACTIVE' && p.stock > 0);
        await this.redis.set(cacheKey, JSON.stringify(activeProducts), 'EX', 86400);
        return activeProducts;
    }
    return [];
  }

  async getPersonalizedFeed(userId: string, page: number, limit: number) {
    const trackingKey = `user:affinity:${userId}`;
    const start = (page - 1) * limit;
    const stop = start + limit - 1;

    let productIds = await this.redis.zrevrange(trackingKey, start, stop);
    if (productIds.length === 0) {
      productIds = await this.redis.zrevrange('global:trending', start, stop);
    }
    const products = await this.productCache.getProductsByIds(productIds);
    return { data: products, meta: { page, limit, total: 100 } };
  }
}