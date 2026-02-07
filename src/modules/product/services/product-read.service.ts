// BE-129/modules/product/services/product-read.service.ts

import { Inject, Injectable, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { REDIS_CLIENT } from '../../../database/redis/redis.constants';
import { ProductCacheService } from './product-cache.service';
import { CategoryService } from '../../category/category.service';
import { Prisma } from '@prisma/client';
import { AUTO_TAG_RULES } from '../constants/tag-rules';

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
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly productCache: ProductCacheService,
    private readonly categoryService: CategoryService,
  ) {}

  async onModuleInit() {
    await this.ensureSearchIndex();
  }

  // ... (Giữ nguyên các hàm helper private: getKeywordsFromTag, cleanSystemTags, escapeRediSearchText, sanitizeTagForQuery, ensureSearchIndex, getKeywordsFromDynamicConfig)
  // [Để tiết kiệm không gian, tôi chỉ hiển thị phần code findAllPublic quan trọng bị lỗi, các phần khác giữ nguyên]

  private getKeywordsFromTag(tagCode: string): string[] {
    if (!tagCode) return [];
    const rule = AUTO_TAG_RULES.find(r => r.code === tagCode);
    return rule ? rule.keywords : [];
  }

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
        .map(t => typeof t === 'string' ? t.trim().replace(/[^a-zA-Z0-9_\-\:\.\u00C0-\u1EF9\s]/g, '') : '')
        .filter(t => t.length > 0);
    return Array.from(new Set(cleanedTags)).join(','); 
  }

  private escapeRediSearchText(str: string): string {
    return str.replace(/([.?\-,:@&|{}[\]()"\\`~^*])/g, '\\$1').trim();
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
          'systemTags', 'TAG', 'SEPARATOR', ',' 
        );
        this.logger.log('✅ RediSearch Index created');
        await this.syncAllProductsToRedis();
      }
    } catch (e: any) {
       // Ignore exists error
    }
  }

  private async getKeywordsFromDynamicConfig(tagCode: string): Promise<string[]> {
    const staticRule = AUTO_TAG_RULES.find(r => r.code === tagCode);
    if (staticRule) return staticRule.keywords;

    try {
        const CONFIG_KEYS = ['HEADER_RECIPIENT', 'HEADER_OCCASION', 'HEADER_BUSINESS'];
        const configs = await this.prisma.systemConfig.findMany({
            where: { key: { in: CONFIG_KEYS } }
        });

        if (!configs || configs.length === 0) return [];

        const findKeywords = (items: any[]): string[] | null => {
            if (!Array.isArray(items)) return null;
            
            for (const item of items) {
                // Kiểm tra nếu item match code HOẶC link chứa tag
                if ((item.code === tagCode) || (item.link && item.link.includes(`tag=${tagCode}`))) {
                    // [FIX] Xử lý an toàn cho cả String và Array
                    if (item.keywords) {
                        if (Array.isArray(item.keywords)) return item.keywords; // Đã là mảng thì trả về luôn
                        if (typeof item.keywords === 'string') return item.keywords.split(',').map((k: string) => k.trim());
                    }
                }
                
                // Đệ quy tìm con
                const foundInChild = findKeywords(item.children || item.items);
                if (foundInChild) return foundInChild;
            }
            return null;
        };

        for (const config of configs) {
            const menuTree = typeof config.value === 'string' ? JSON.parse(config.value) : config.value;
            const result = findKeywords(menuTree);
            if (result) return result;
        }
        return [];
    } catch (e) { 
        return []; 
    }
  }

  async syncAllProductsToRedis() {
    // ... (Giữ nguyên logic syncAllProductsToRedis)
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

            const score = p.salesCount > 0 ? p.salesCount : 1;
            const payload = JSON.stringify({ id: p.id, slug: p.slug, price: Number(p.price), image });
            pipeline.call('FT.SUGADD', SUGGESTION_KEY, p.name, score.toString(), 'PAYLOAD', payload);
        }
        await pipeline.exec();
    } catch (e: any) { this.logger.error(e); }
  }

  async syncProductToRedis(product: any) {
     // ... (Giữ nguyên logic syncProductToRedis)
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
  // [QUAN TRỌNG] HÀM ĐƯỢC FIX LỖI "TOTAL 0"
  // ===========================================================================
  async findAllPublic(query: FindAllPublicDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

    let resultData: any = null;
    const searchKeyword = query.search ? query.search.trim() : '';
    const tagCode = query.tag ? query.tag.trim() : '';

    // [STEP 1] Mapping Tag -> Keywords
    let tagKeywords: string[] = [];
    if (tagCode) {
        tagKeywords = await this.getKeywordsFromDynamicConfig(tagCode);
    }

    // --- BƯỚC 2: REDIS SEARCH (LOGIC FIX) ---
    if (searchKeyword.length > 0 || tagKeywords.length > 0) {
        try {
            // Khởi tạo mảng chứa các cụm điều kiện (OR clauses)
            const orClauses: string[] = [];

            // A. Xử lý Search Keywords (từ URL: ?q=iphone,váy,bàn chải)
            if (searchKeyword) {
                const phrases = searchKeyword.split(',').map(p => p.trim()).filter(Boolean);
                phrases.forEach(phrase => {
                    const cleanPhrase = this.escapeRediSearchText(phrase);
                    if (cleanPhrase) {
                        // Logic: Một cụm từ "bàn chải" -> Cần tìm Name chứa "bàn" VÀ chứa "chải"
                        // Tạo sub-query: (@name:bàn* @name:chải*)
                        // Dấu cách ở giữa 2 @name đóng vai trò là AND
                        const tokens = cleanPhrase.split(/\s+/).map(w => `@name:${w}*`).join(' ');
                        orClauses.push(`(${tokens})`);
                    }
                });
            }

            // B. Xử lý Tag Keywords (từ Admin Config)
            if (tagKeywords.length > 0) {
                tagKeywords.forEach(k => {
                    const clean = this.escapeRediSearchText(k);
                    if (clean) {
                         // Tag cũng tương tự, tìm chính xác từ đó trong Name
                         orClauses.push(`(@name:${clean}*)`);
                    }
                });
            }

            // C. Ghép Query tổng
            // Kết quả mong muốn: @status:{ACTIVE} ( (@name:iphone*) | (@name:váy*) | (@name:bàn* @name:chải*) )
            let ftQuery = `@status:{ACTIVE}`;
            if (orClauses.length > 0) {
                ftQuery += ` (${orClauses.join(' | ')})`;
            }

            // Setup Sort
            let redisSortBy = 'createdAt';
            let redisSortDir = 'DESC';
            if (query.sort === 'sales') redisSortBy = 'salesCount';
            if (query.sort === 'price_asc') { redisSortBy = 'price'; redisSortDir = 'ASC'; }
            if (query.sort === 'price_desc') { redisSortBy = 'price'; redisSortDir = 'DESC'; }

            // [QUAN TRỌNG] Thêm DIALECT 3 để xử lý ngoặc và OR/AND chính xác
            const searchRes = await this.redis.call(
                'FT.SEARCH', INDEX_NAME, 
                ftQuery, 
                'SORTBY', redisSortBy, redisSortDir,
                'LIMIT', String(skip), String(limit),
                'DIALECT', '3' 
            ) as any[];

            if (Array.isArray(searchRes) && searchRes.length > 0) {
                const totalDocs = Number(searchRes[0]);
                const docs: any[] = []; 
                
                for (let i = 1; i < searchRes.length; i += 2) {
                    const fields = searchRes[i + 1];
                    const productObj: any = {};
                    if(Array.isArray(fields)) {
                        for (let j = 0; j < fields.length; j += 2) {
                            productObj[fields[j]] = fields[j + 1];
                        }
                    }
                    if (productObj.json) {
                        docs.push(JSON.parse(productObj.json));
                    }
                }

                if (totalDocs > 0) {
                     resultData = {
                        data: docs,
                        meta: { total: totalDocs, page, limit, last_page: Math.ceil(totalDocs / limit) },
                    };
                }
            }
        } catch (e: any) {
            this.logger.error(`RediSearch Error: ${e.message} | Query: ${searchKeyword}`);
        }
    }

    // --- BƯỚC 3: DATABASE FALLBACK (Giữ nguyên logic DB đã fix ở bước trước) ---
    if (!resultData) {
        try {
            const whereConditions: Prisma.Sql[] = [Prisma.sql`status = 'ACTIVE'`];

            // 1. Search Logic
            if (searchKeyword) {
                const keywords = searchKeyword.split(',').map(k => k.trim()).filter(Boolean);
                if (keywords.length > 0) {
                    const orSubQueries = keywords.map(kw => {
                        const likeStr = `%${kw}%`;
                        return Prisma.sql`(name LIKE ${likeStr} OR description LIKE ${likeStr})`;
                    });
                    if (orSubQueries.length > 0) {
                        whereConditions.push(Prisma.sql`(${Prisma.join(orSubQueries, ' OR ')})`);
                    }
                }
            }

            // 2. Tag Logic
            if (tagKeywords.length > 0) {
                const keywordConditions = tagKeywords.map(kw => {
                    const likeStr = `%${kw}%`;
                    return Prisma.sql`name LIKE ${likeStr}`;
                });
                if (keywordConditions.length > 0) {
                    whereConditions.push(Prisma.sql`(${Prisma.join(keywordConditions, ' OR ')})`);
                }
            }

            // 3. Filter Categories
            if (query.categoryId) {
                whereConditions.push(Prisma.sql`categoryId = ${query.categoryId}`);
            } else if (query.categorySlug) { 
                const category = await this.prisma.category.findUnique({
                    where: { slug: query.categorySlug },
                    select: { id: true }
                });
                if (category) {
                    whereConditions.push(Prisma.sql`categoryId = ${category.id}`);
                } else {
                    return { data: [], meta: { total: 0, page, limit, last_page: 0 } };
                }
            }

            // 4. Other Filters
            if (query.brandId) whereConditions.push(Prisma.sql`brandId = ${query.brandId}`);
            if (query.minPrice !== undefined) whereConditions.push(Prisma.sql`price >= ${query.minPrice}`);
            if (query.maxPrice !== undefined) whereConditions.push(Prisma.sql`price <= ${query.maxPrice}`);
            if (query.rating) whereConditions.push(Prisma.sql`rating >= ${query.rating}`);

            // Build SQL
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
                SELECT COUNT(id) as total FROM Product ${whereClause}
            `;
            const rawTotal = countResult[0]?.total;
            const total = typeof rawTotal === 'bigint' ? Number(rawTotal) : (Number(rawTotal) || 0);

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

    return resultData || { data: [], meta: { total: 0, page, limit, last_page: 0 } };
  }
  
  // ... (Giữ nguyên các hàm removeProductFromRedis, escapeTagValue, searchSuggestions, findOnePublic, findRelated, findMoreFromShop, searchProductsForAdmin, findAllForSeller, findShopProducts, findBoughtTogether, getPersonalizedFeed)
  async removeProductFromRedis(id: string, name: string) {
      await this.redis.del(`product:${id}`);
      await this.redis.call('FT.SUGDEL', SUGGESTION_KEY, name);
  }
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