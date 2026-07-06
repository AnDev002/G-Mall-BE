"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ProductReadService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductReadService = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = require("ioredis");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const redis_constants_1 = require("../../../database/redis/redis.constants");
const product_cache_service_1 = require("./product-cache.service");
const category_service_1 = require("../../category/category.service");
const client_1 = require("@prisma/client");
const tag_rules_1 = require("../constants/tag-rules");
const pagination_util_1 = require("../../../common/utils/pagination.util");
const SUGGESTION_KEY = 'sug:products';
const INDEX_NAME = 'idx:products';
let ProductReadService = ProductReadService_1 = class ProductReadService {
    prisma;
    redis;
    productCache;
    categoryService;
    logger = new common_1.Logger(ProductReadService_1.name);
    constructor(prisma, redis, productCache, categoryService) {
        this.prisma = prisma;
        this.redis = redis;
        this.productCache = productCache;
        this.categoryService = categoryService;
    }
    async onModuleInit() {
        await this.ensureSearchIndex();
    }
    getKeywordsFromTag(tagCode) {
        if (!tagCode)
            return [];
        const rule = tag_rules_1.AUTO_TAG_RULES.find(r => r.code === tagCode);
        return rule ? rule.keywords : [];
    }
    cleanSystemTags(inputTags) {
        let tags = [];
        if (Array.isArray(inputTags)) {
            tags = inputTags;
        }
        else if (typeof inputTags === 'string') {
            try {
                const parsed = JSON.parse(inputTags);
                if (Array.isArray(parsed))
                    tags = parsed;
            }
            catch {
                tags = inputTags.split(',');
            }
        }
        if (!tags || tags.length === 0)
            return '';
        const cleanedTags = tags
            .map(t => typeof t === 'string' ? t.trim().replace(/[^a-zA-Z0-9_\-\:\.\u00C0-\u1EF9\s]/g, '') : '')
            .filter(t => t.length > 0);
        return Array.from(new Set(cleanedTags)).join(',');
    }
    escapeRediSearchText(str) {
        return str.replace(/([.?\-,:@&|{}[\]()"\\`~^*])/g, '\\$1').trim();
    }
    async ensureSearchIndex() {
        try {
            const info = await this.redis.call('FT.INFO', INDEX_NAME).catch(() => null);
            if (!info) {
                await this.redis.call('FT.CREATE', INDEX_NAME, 'ON', 'HASH', 'PREFIX', '1', 'product:', 'SCHEMA', 'name', 'TEXT', 'WEIGHT', '5.0', 'SORTABLE', 'slug', 'TEXT', 'NOSTEM', 'price', 'NUMERIC', 'SORTABLE', 'salesCount', 'NUMERIC', 'SORTABLE', 'createdAt', 'NUMERIC', 'SORTABLE', 'status', 'TAG', 'systemTags', 'TAG', 'SEPARATOR', ',');
                this.logger.log('✅ RediSearch Index created');
                await this.syncAllProductsToRedis();
            }
        }
        catch (e) {
        }
    }
    async getKeywordsFromDynamicConfig(tagCode) {
        const staticRule = tag_rules_1.AUTO_TAG_RULES.find(r => r.code === tagCode);
        if (staticRule) {
            console.log(`⚠️ [Tag Debug] Tag "${tagCode}" found in AUTO_TAG_RULES (Hardcoded):`, staticRule.keywords);
            return staticRule.keywords;
        }
        try {
            const CONFIG_KEYS = ['HEADER_RECIPIENT', 'HEADER_OCCASION', 'HEADER_BUSINESS'];
            const configs = await this.prisma.systemConfig.findMany({
                where: { key: { in: CONFIG_KEYS } }
            });
            console.log("🔍 [FULL CONFIG DUMP]:", JSON.stringify(configs));
            if (!configs || configs.length === 0)
                return [];
            let foundKeywords = null;
            const findKeywords = (items) => {
                if (!Array.isArray(items))
                    return null;
                for (const item of items) {
                    const isMatch = (item.code === tagCode) || (item.link && item.link.includes(`tag=${tagCode}`));
                    if (isMatch) {
                        console.log(`✅ [Tag Debug] Found Item match for "${tagCode}":`, JSON.stringify(item));
                        if (item.keywords) {
                            if (Array.isArray(item.keywords)) {
                                console.log("   -> Type: Array");
                                return item.keywords;
                            }
                            if (typeof item.keywords === 'string') {
                                console.log("   -> Type: String");
                                return item.keywords.split(/[,;]+/).map((k) => k.trim()).filter(Boolean);
                            }
                        }
                        else {
                            console.log("   -> ❌ Item has NO keywords property!");
                        }
                    }
                    const foundInChild = findKeywords(item.children || item.items);
                    if (foundInChild)
                        return foundInChild;
                }
                return null;
            };
            for (const config of configs) {
                const menuTree = typeof config.value === 'string' ? JSON.parse(config.value) : config.value;
                foundKeywords = findKeywords(menuTree);
                if (foundKeywords)
                    break;
            }
            if (foundKeywords) {
                console.log(`🎉 [Tag Debug] Final Keywords for "${tagCode}":`, foundKeywords);
                return foundKeywords;
            }
            console.log(`⚠️ [Tag Debug] No keywords found anywhere for "${tagCode}"`);
            return [];
        }
        catch (e) {
            console.error(`❌ [Tag Debug] Error:`, e);
            return [];
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
                const image = Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : '';
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
        }
        catch (e) {
            this.logger.error(e);
        }
    }
    async syncProductToRedis(product) {
        const key = `product:${product.id}`;
        const image = Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : '';
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
    async findAllPublic(query) {
        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.max(1, Number(query.limit) || 20);
        const skip = (page - 1) * limit;
        let resultData = null;
        const searchKeyword = query.search ? query.search.trim() : '';
        const tagCode = query.tag ? query.tag.trim() : '';
        let tagKeywords = [];
        if (tagCode) {
            tagKeywords = await this.getKeywordsFromDynamicConfig(tagCode);
        }
        if (searchKeyword.length > 0 || tagKeywords.length > 0) {
            try {
                const orClauses = [];
                if (searchKeyword) {
                    const phrases = searchKeyword.split(',').map(p => p.trim()).filter(Boolean);
                    phrases.forEach(phrase => {
                        const cleanPhrase = this.escapeRediSearchText(phrase);
                        if (cleanPhrase) {
                            const tokens = cleanPhrase.split(/\s+/).map(w => `@name:${w}*`).join(' ');
                            orClauses.push(`(${tokens})`);
                        }
                    });
                }
                if (tagKeywords.length > 0) {
                    tagKeywords.forEach(k => {
                        const clean = this.escapeRediSearchText(k);
                        if (clean) {
                            orClauses.push(`(@name:${clean}*)`);
                        }
                    });
                }
                let ftQuery = `@status:{ACTIVE}`;
                if (orClauses.length > 0) {
                    ftQuery += ` (${orClauses.join(' | ')})`;
                }
                let redisSortBy = 'createdAt';
                let redisSortDir = 'DESC';
                if (query.sort === 'sales')
                    redisSortBy = 'salesCount';
                if (query.sort === 'price_asc') {
                    redisSortBy = 'price';
                    redisSortDir = 'ASC';
                }
                if (query.sort === 'price_desc') {
                    redisSortBy = 'price';
                    redisSortDir = 'DESC';
                }
                console.log("⚡ [Redis Query]:", ftQuery);
                const searchRes = await this.redis.call('FT.SEARCH', INDEX_NAME, ftQuery, 'SORTBY', redisSortBy, redisSortDir, 'LIMIT', String(skip), String(limit), 'DIALECT', '3');
                console.log("   -> Redis Results Count:", searchRes?.[0]);
                if (Array.isArray(searchRes) && searchRes.length > 0) {
                    const totalDocs = Number(searchRes[0]);
                    const docs = [];
                    for (let i = 1; i < searchRes.length; i += 2) {
                        const fields = searchRes[i + 1];
                        const productObj = {};
                        if (Array.isArray(fields)) {
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
            }
            catch (e) {
                this.logger.error(`RediSearch Error: ${e.message} | Query: ${searchKeyword}`);
            }
        }
        if (!resultData) {
            try {
                const whereConditions = [client_1.Prisma.sql `status = 'ACTIVE'`];
                if (searchKeyword) {
                    const keywords = searchKeyword.split(',').map(k => k.trim()).filter(Boolean);
                    if (keywords.length > 0) {
                        const orSubQueries = keywords.map(kw => {
                            const likeStr = `%${kw}%`;
                            return client_1.Prisma.sql `(name LIKE ${likeStr} OR description LIKE ${likeStr})`;
                        });
                        if (orSubQueries.length > 0) {
                            whereConditions.push(client_1.Prisma.sql `(${client_1.Prisma.join(orSubQueries, ' OR ')})`);
                        }
                    }
                }
                if (tagKeywords.length > 0) {
                    const keywordConditions = tagKeywords.map(kw => {
                        const likeStr = `%${kw}%`;
                        return client_1.Prisma.sql `name LIKE ${likeStr}`;
                    });
                    if (keywordConditions.length > 0) {
                        whereConditions.push(client_1.Prisma.sql `(${client_1.Prisma.join(keywordConditions, ' OR ')})`);
                    }
                }
                if (query.categoryId) {
                    const ids = await this.categoryService.getDescendantIds(query.categoryId);
                    whereConditions.push(client_1.Prisma.sql `categoryId IN (${client_1.Prisma.join(ids)})`);
                }
                else if (query.categorySlug) {
                    const category = await this.prisma.category.findUnique({
                        where: { slug: query.categorySlug },
                        select: { id: true }
                    });
                    if (category) {
                        const ids = await this.categoryService.getDescendantIds(category.id);
                        whereConditions.push(client_1.Prisma.sql `categoryId IN (${client_1.Prisma.join(ids)})`);
                    }
                    else {
                        return { data: [], meta: { total: 0, page, limit, last_page: 0 } };
                    }
                }
                if (query.brandId)
                    whereConditions.push(client_1.Prisma.sql `brandId = ${query.brandId}`);
                if (query.minPrice !== undefined)
                    whereConditions.push(client_1.Prisma.sql `price >= ${query.minPrice}`);
                if (query.maxPrice !== undefined)
                    whereConditions.push(client_1.Prisma.sql `price <= ${query.maxPrice}`);
                if (query.rating)
                    whereConditions.push(client_1.Prisma.sql `rating >= ${query.rating}`);
                const whereClause = whereConditions.length > 0
                    ? client_1.Prisma.sql `WHERE ${client_1.Prisma.join(whereConditions, ' AND ')}`
                    : client_1.Prisma.sql ``;
                let orderBySql;
                const hasSearchSort = searchKeyword && !query.sort;
                if (hasSearchSort) {
                    const exactLike = `%${searchKeyword}%`;
                    orderBySql = client_1.Prisma.sql `ORDER BY
                    (CASE WHEN name LIKE ${exactLike} THEN 100 ELSE 0 END) +
                    (CASE WHEN description LIKE ${exactLike} THEN 10 ELSE 0 END) DESC,
                    salesCount DESC,
                    createdAt DESC`;
                }
                else if (query.sort === 'sales') {
                    orderBySql = client_1.Prisma.sql `ORDER BY salesCount DESC`;
                }
                else if (query.sort === 'price_asc') {
                    orderBySql = client_1.Prisma.sql `ORDER BY price ASC`;
                }
                else if (query.sort === 'price_desc') {
                    orderBySql = client_1.Prisma.sql `ORDER BY price DESC`;
                }
                else {
                    orderBySql = client_1.Prisma.sql `ORDER BY createdAt DESC`;
                }
                const products = await this.prisma.$queryRaw `
                SELECT id, name, price, slug, images, salesCount, originalPrice, createdAt, systemTags,
                       isDiscountActive, discountType, discountValue
                FROM Product
                ${whereClause}
                ${orderBySql}
                LIMIT ${limit} OFFSET ${skip}
            `;
                const countResult = await this.prisma.$queryRaw `
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
            }
            catch (dbErr) {
                this.logger.error(`❌ [DB Fallback Error] ${dbErr}`);
                return { data: [], meta: { total: 0, page, limit, last_page: 0 } };
            }
        }
        return resultData || { data: [], meta: { total: 0, page, limit, last_page: 0 } };
    }
    async getAdminProductSelector(query) {
        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.max(1, Number(query.limit) || 20);
        const skip = (page - 1) * limit;
        const { keyword, shopId } = query;
        const where = {
            status: 'ACTIVE',
        };
        if (shopId) {
            where.shopId = shopId;
        }
        const searchTerm = keyword || query.search;
        if (searchTerm) {
            where.OR = [
                { name: { contains: searchTerm } },
            ];
        }
        try {
            const [products, total] = await Promise.all([
                this.prisma.product.findMany({
                    where,
                    take: limit,
                    skip,
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        name: true,
                        price: true,
                        images: true,
                        shop: {
                            select: { id: true, name: true }
                        }
                    }
                }),
                this.prisma.product.count({ where })
            ]);
            const safeData = products.map(p => {
                let parsedImages = [];
                try {
                    if (Array.isArray(p.images)) {
                        parsedImages = p.images;
                    }
                    else if (typeof p.images === 'string') {
                        parsedImages = JSON.parse(p.images);
                    }
                }
                catch (e) {
                    parsedImages = [];
                }
                const displayImage = parsedImages.length > 0 ? parsedImages[0] : '/placeholder.png';
                return {
                    ...p,
                    price: Number(p.price),
                    images: [displayImage]
                };
            });
            return {
                data: safeData,
                meta: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit)
                }
            };
        }
        catch (error) {
            console.error("Error in getAdminProductSelector:", error);
            return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
        }
    }
    async searchPublic(query) {
        const keyword = query.keyword || '';
        const limit = Number(query.limit) || 20;
        if (!keyword)
            return { data: [] };
        const where = {
            status: 'ACTIVE',
            OR: [
                { name: { contains: keyword } },
                { variants: { some: { sku: { contains: keyword } } } },
            ],
        };
        if (query.shopId) {
            where.shopId = query.shopId;
        }
        try {
            const products = await this.prisma.product.findMany({
                where,
                take: limit,
                select: {
                    id: true,
                    name: true,
                    price: true,
                    images: true,
                    shop: { select: { name: true } }
                },
                orderBy: { createdAt: 'desc' }
            });
            return { data: products };
        }
        catch (error) {
            console.error('Error in searchPublic:', error);
            return { data: [] };
        }
    }
    async removeProductFromRedis(id, name) {
        await this.redis.del(`product:${id}`);
        await this.redis.call('FT.SUGDEL', SUGGESTION_KEY, name);
    }
    async searchSuggestions(keyword) {
        if (!keyword || keyword.length < 2)
            return [];
        try {
            const suggestions = await this.redis.call('FT.SUGGET', SUGGESTION_KEY, keyword, 'FUZZY', 'MAX', '6', 'WITHPAYLOADS');
            const result = [];
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
        }
        catch (error) {
            return [];
        }
    }
    async findOnePublic(idOrSlug) {
        const cachedProduct = await this.productCache.getProductDetail(idOrSlug);
        if (cachedProduct && cachedProduct.status === 'ACTIVE') {
            return cachedProduct;
        }
        const product = await this.prisma.product.findFirst({
            where: {
                OR: [{ id: idOrSlug }, { slug: { equals: idOrSlug } }],
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
            throw new common_1.NotFoundException('Sản phẩm không tồn tại');
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
                let safeTierIndex = [];
                if (Array.isArray(v.tierIndex)) {
                    safeTierIndex = v.tierIndex;
                }
                else if (typeof v.tierIndex === 'string' && v.tierIndex.length > 0) {
                    safeTierIndex = v.tierIndex.split(',').map(n => parseInt(n, 10));
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
    async findRelated(productId) {
        const currentProduct = await this.productCache.getProductDetail(productId);
        if (!currentProduct)
            return [];
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
    async findMoreFromShop(productId) {
        const cachedProduct = await this.productCache.getProductDetail(productId);
        let shopId = cachedProduct?.shopId;
        if (!shopId) {
            const product = await this.prisma.product.findUnique({
                where: { id: productId },
                select: { shopId: true }
            });
            shopId = product?.shopId;
        }
        if (!shopId)
            return [];
        return this.prisma.product.findMany({
            where: { shopId: shopId, id: { not: productId }, status: 'ACTIVE' },
            take: 6,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true, name: true, price: true, images: true, stock: true, slug: true, rating: true, salesCount: true
            },
        });
    }
    async searchProductsForAdmin(query) {
        return this.prisma.product.findMany({
            where: { name: { contains: query } },
            select: { id: true, name: true, images: true, variants: true, price: true },
            take: 20,
        });
    }
    async findAllForSeller(sellerId, query) {
        const { page, limit, skip } = (0, pagination_util_1.getPagination)(query.page, query.limit, { defaultLimit: 20 });
        const where = { shopId: sellerId };
        if (query.keyword)
            where.name = { contains: query.keyword };
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
    async findShopProducts(shopId, query) {
        const { page, limit, skip } = (0, pagination_util_1.getPagination)(query.page, query.limit, { defaultLimit: 12 });
        const where = {
            shopId: shopId,
            status: 'ACTIVE',
            stock: { gt: 0 },
        };
        if (query.categoryId && query.categoryId !== 'all')
            where.shopCategoryId = query.categoryId;
        if (query.minPrice !== undefined || query.maxPrice !== undefined) {
            where.price = {};
            if (query.minPrice)
                where.price.gte = Number(query.minPrice);
            if (query.maxPrice)
                where.price.lte = Number(query.maxPrice);
        }
        if (query.rating)
            where.rating = { gte: Number(query.rating) };
        let orderBy = { createdAt: 'desc' };
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
    async findBoughtTogether(productId) {
        const cacheKey = `product:bought_together:${productId}`;
        const cachedData = await this.redis.get(cacheKey);
        if (cachedData)
            return JSON.parse(cachedData);
        const orders = await this.prisma.orderItem.findMany({
            where: { productId: productId },
            select: { orderId: true },
            take: 50,
            orderBy: { order: { createdAt: 'desc' } }
        });
        const orderIds = orders.map(o => o.orderId);
        if (orderIds.length === 0)
            return [];
        const relatedItems = await this.prisma.orderItem.groupBy({
            by: ['productId'],
            where: { orderId: { in: orderIds }, productId: { not: productId } },
            _count: { productId: true },
            orderBy: { _count: { productId: 'desc' } },
            take: 6
        });
        const relatedIds = relatedItems.map(item => item.productId).filter((id) => id !== null);
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
    async getPersonalizedFeed(userId, page, limit) {
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
};
exports.ProductReadService = ProductReadService;
exports.ProductReadService = ProductReadService = ProductReadService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(redis_constants_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ioredis_1.Redis,
        product_cache_service_1.ProductCacheService,
        category_service_1.CategoryService])
], ProductReadService);
//# sourceMappingURL=product-read.service.js.map