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
var ProductCacheService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductCacheService = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = require("ioredis");
const redis_constants_1 = require("../../../database/redis/redis.constants");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const TTL = {
    PRODUCT_DETAIL: 3600,
    LOCK: 5,
};
const CACHE_VERSION = 'v2';
let ProductCacheService = ProductCacheService_1 = class ProductCacheService {
    redis;
    prisma;
    logger = new common_1.Logger(ProductCacheService_1.name);
    constructor(redis, prisma) {
        this.redis = redis;
        this.prisma = prisma;
    }
    async getProductDetail(idOrSlug) {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
        const cacheKey = isUUID
            ? `product:detail:${CACHE_VERSION}:${idOrSlug}`
            : `product:detail:${CACHE_VERSION}:slug:${idOrSlug}`;
        const cachedData = await this.redis.get(cacheKey);
        if (cachedData) {
            return JSON.parse(cachedData);
        }
        return null;
    }
    async setProductDetail(id, slug, data) {
        const dataToCache = JSON.stringify(data, (k, v) => typeof v === 'bigint' ? v.toString() : v);
        const pipeline = this.redis.pipeline();
        pipeline.set(`product:detail:${CACHE_VERSION}:${id}`, dataToCache, 'EX', TTL.PRODUCT_DETAIL);
        if (slug) {
            pipeline.set(`product:detail:${CACHE_VERSION}:slug:${slug}`, dataToCache, 'EX', TTL.PRODUCT_DETAIL);
        }
        await pipeline.exec();
    }
    async getProductsByIds(ids) {
        if (!ids.length)
            return [];
        const uniqueIds = [...new Set(ids)];
        const cacheKeys = uniqueIds.map(id => `product:detail:${CACHE_VERSION}:${id}`);
        const cachedResults = await this.redis.mget(cacheKeys);
        const result = [];
        const missingIds = [];
        cachedResults.forEach((json, index) => {
            if (json) {
                result.push(JSON.parse(json));
            }
            else {
                missingIds.push(uniqueIds[index]);
            }
        });
        if (missingIds.length > 0) {
            const dbProducts = await this.prisma.product.findMany({
                where: { id: { in: missingIds } },
                include: { seller: { select: { name: true } } }
            });
            if (dbProducts.length > 0) {
                await Promise.all(dbProducts.map(p => {
                    const formatted = { ...p, price: Number(p.price) };
                    result.push(formatted);
                    return this.setProductDetail(p.id, p.slug, formatted);
                }));
            }
        }
        const resultMap = new Map(result.map(p => [p.id, p]));
        return ids.map(id => resultMap.get(id)).filter(Boolean);
    }
    async invalidateProduct(id, slug) {
        const keys = [`product:detail:${CACHE_VERSION}:${id}`];
        if (slug)
            keys.push(`product:detail:${CACHE_VERSION}:slug:${slug}`);
        await this.redis.del(keys);
    }
};
exports.ProductCacheService = ProductCacheService;
exports.ProductCacheService = ProductCacheService = ProductCacheService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_constants_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [ioredis_1.Redis,
        prisma_service_1.PrismaService])
], ProductCacheService);
//# sourceMappingURL=product-cache.service.js.map