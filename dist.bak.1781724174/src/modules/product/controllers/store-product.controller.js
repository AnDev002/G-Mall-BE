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
Object.defineProperty(exports, "__esModule", { value: true });
exports.StoreProductController = void 0;
const common_1 = require("@nestjs/common");
const product_read_service_1 = require("../services/product-read.service");
const public_decorator_1 = require("../../../common/decorators/public.decorator");
const jwt_guard_1 = require("../../auth/guards/jwt.guard");
const roles_guard_1 = require("../../../common/guards/roles.guard");
const roles_decorator_1 = require("../../../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const redis_cache_interceptor_1 = require("../../../common/interceptors/redis-cache.interceptor");
const pagination_util_1 = require("../../../common/utils/pagination.util");
let StoreProductController = class StoreProductController {
    productReadService;
    prisma;
    constructor(productReadService, prisma) {
        this.productReadService = productReadService;
        this.prisma = prisma;
    }
    async getProducts(req, page, limit, search, categorySlug, minPrice, maxPrice, rating, sort, tag, deviceId) {
        if (search === 'recommendation') {
            const userId = req.user?.userId || (deviceId ? `guest:${deviceId}` : null);
            if (userId) {
                return this.productReadService.getPersonalizedFeed(userId, Number(page) || 1, Number(limit) || 20);
            }
        }
        return this.productReadService.findAllPublic({
            page: Number(page),
            limit: Number(limit),
            search,
            categorySlug,
            minPrice: minPrice ? Number(minPrice) : undefined,
            maxPrice: maxPrice ? Number(maxPrice) : undefined,
            rating: rating ? Number(rating) : undefined,
            sort,
            tag,
        });
    }
    getProductDetail(id) {
        console.log("Backend received ID/Slug:", id);
        return this.productReadService.findOnePublic(id);
    }
    async syncSearchIndex() {
        return this.productReadService.syncAllProductsToRedis();
    }
    getRelated(id) {
        return this.productReadService.findRelated(id);
    }
    getMoreFromShop(id) {
        return this.productReadService.findMoreFromShop(id);
    }
    async getBoughtTogether(id) {
        const relations = await this.prisma.productCrossSell.findMany({
            where: { productId: id },
            include: {
                relatedProduct: {
                    include: {
                        options: {
                            include: { values: true },
                            orderBy: { position: 'asc' }
                        },
                        variants: true
                    }
                }
            },
            take: 6
        });
        return relations.map(r => {
            const p = r.relatedProduct;
            return {
                ...p,
                id: p.id,
                name: p.name,
                price: Number(p.price),
                stock: Number(p.stock),
                images: p.images?.map((i) => typeof i === 'string' ? i : i.url) || [],
                slug: p.slug,
                options: p.options.map(opt => ({
                    name: opt.name,
                    values: opt.values.map(v => ({
                        value: v.value,
                        image: v.image
                    }))
                })),
                variants: p.variants.map(v => ({
                    ...v,
                    price: Number(v.price),
                    stock: Number(v.stock)
                }))
            };
        });
    }
    async getProductReviews(productId, page, limit, rating) {
        const _pg = (0, pagination_util_1.getPagination)(page, limit);
        page = _pg.page;
        limit = _pg.limit;
        const skip = _pg.skip;
        const whereCondition = { productId };
        if (rating) {
            whereCondition.rating = Number(rating);
        }
        const [reviews, total, starCounts] = await Promise.all([
            this.prisma.productReview.findMany({
                where: whereCondition,
                take: limit,
                skip: skip,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: { name: true, avatar: true }
                    },
                }
            }),
            this.prisma.productReview.count({ where: whereCondition }),
            this.prisma.productReview.groupBy({
                by: ['rating'],
                where: { productId },
                _count: { rating: true },
            }),
        ]);
        const distribution = {
            1: 0, 2: 0, 3: 0, 4: 0, 5: 0
        };
        starCounts.forEach(item => {
            distribution[item.rating] = item._count.rating;
        });
        return {
            data: reviews,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
            distribution
        };
    }
};
exports.StoreProductController = StoreProductController;
__decorate([
    (0, common_1.Get)(),
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.UseInterceptors)(redis_cache_interceptor_1.RedisCacheInterceptor),
    (0, redis_cache_interceptor_1.CacheKey)('store:products:list'),
    (0, redis_cache_interceptor_1.CacheTTL)(30),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('search')),
    __param(4, (0, common_1.Query)('categorySlug')),
    __param(5, (0, common_1.Query)('minPrice')),
    __param(6, (0, common_1.Query)('maxPrice')),
    __param(7, (0, common_1.Query)('rating')),
    __param(8, (0, common_1.Query)('sort')),
    __param(9, (0, common_1.Query)('tag')),
    __param(10, (0, common_1.Headers)('x-device-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number, String, String, Number, Number, Number, String, String, String]),
    __metadata("design:returntype", Promise)
], StoreProductController.prototype, "getProducts", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, public_decorator_1.Public)(),
    (0, common_1.UseInterceptors)(redis_cache_interceptor_1.RedisCacheInterceptor),
    (0, redis_cache_interceptor_1.CacheKey)('store:product:detail'),
    (0, redis_cache_interceptor_1.CacheTTL)(30),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StoreProductController.prototype, "getProductDetail", null);
__decorate([
    (0, common_1.Post)('sync-search-index'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StoreProductController.prototype, "syncSearchIndex", null);
__decorate([
    (0, common_1.Get)(':id/related'),
    (0, public_decorator_1.Public)(),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StoreProductController.prototype, "getRelated", null);
__decorate([
    (0, common_1.Get)(':id/more-from-shop'),
    (0, public_decorator_1.Public)(),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StoreProductController.prototype, "getMoreFromShop", null);
__decorate([
    (0, common_1.Get)(':id/bought-together'),
    (0, public_decorator_1.Public)(),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StoreProductController.prototype, "getBoughtTogether", null);
__decorate([
    (0, common_1.Get)(':id/reviews'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('page', new common_1.DefaultValuePipe(1), common_1.ParseIntPipe)),
    __param(2, (0, common_1.Query)('limit', new common_1.DefaultValuePipe(10), common_1.ParseIntPipe)),
    __param(3, (0, common_1.Query)('rating')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Number, Number]),
    __metadata("design:returntype", Promise)
], StoreProductController.prototype, "getProductReviews", null);
exports.StoreProductController = StoreProductController = __decorate([
    (0, common_1.Controller)('store/products'),
    __metadata("design:paramtypes", [product_read_service_1.ProductReadService, prisma_service_1.PrismaService])
], StoreProductController);
//# sourceMappingURL=store-product.controller.js.map