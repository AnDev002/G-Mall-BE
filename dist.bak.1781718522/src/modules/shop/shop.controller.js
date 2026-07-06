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
exports.ShopController = void 0;
const common_1 = require("@nestjs/common");
const shop_service_1 = require("./shop.service");
const jwt_guard_1 = require("../../modules/auth/guards/jwt.guard");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const update_shop_dto_1 = require("../auth/dto/update-shop.dto");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const pagination_util_1 = require("../../common/utils/pagination.util");
const create_shop_dto_1 = require("./dto/create-shop.dto");
let ShopController = class ShopController {
    shopService;
    prisma;
    constructor(shopService, prisma) {
        this.shopService = shopService;
        this.prisma = prisma;
    }
    async registerShop(req, body) {
        return this.shopService.createShop(req.user.userId, body);
    }
    async getShopProfile(id) {
        return this.shopService.getPublicProfile(id);
    }
    async getShops(query) {
        return this.shopService.getShops(query);
    }
    async getShopCategories(id) {
        return this.shopService.getShopCategories(id);
    }
    async getShopProducts(id, query) {
        return this.shopService.getShopProducts(id, query);
    }
    async getShopVouchers(id) {
        return this.shopService.getShopVouchers(id);
    }
    async getMyShop(req) {
        const userId = req.user.userId || req.user.id;
        if (!userId) {
            throw new common_1.BadRequestException("User ID không hợp lệ");
        }
        return this.shopService.getShopByOwnerId(req.user.id);
    }
    async getShopPublic(slug) {
        return this.shopService.getShopBySlug(slug);
    }
    async getMyDecoration(req) {
        const shop = await this.shopService.getShopByOwnerId(req.user.id);
        return { decoration: shop.decoration || [] };
    }
    async updateDecoration(req, body) {
        const userId = req.user.userId || req.user.id;
        if (!userId) {
            throw new common_1.BadRequestException("Không tìm thấy User ID hợp lệ");
        }
        return this.shopService.updateDecoration(req.user.id, body.decoration);
    }
    async getShopCustomCategories(id) {
        return this.shopService.getShopCustomCategories(id);
    }
    async updateMyShopProfile(req, body) {
        const userId = req.user.userId || req.user.id;
        return this.shopService.updateShopProfile(userId, body);
    }
    async getShopReviews(shopId, page, limit) {
        const _pg = (0, pagination_util_1.getPagination)(page, limit);
        page = _pg.page;
        limit = _pg.limit;
        const skip = _pg.skip;
        const [reviews, total] = await Promise.all([
            this.prisma.shopReview.findMany({
                where: { shopId },
                take: limit,
                skip: skip,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: { select: { name: true, avatar: true } },
                }
            }),
            this.prisma.shopReview.count({ where: { shopId } }),
        ]);
        const aggs = await this.prisma.shopReview.aggregate({
            where: { shopId },
            _avg: { rating: true },
            _count: { _all: true }
        });
        return {
            data: reviews,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
            stats: {
                avgRating: aggs._avg.rating || 0,
                totalReviews: aggs._count._all || 0,
                responseRate: 95,
                joinDate: (await this.prisma.shop.findUnique({ where: { id: shopId } }))?.createdAt
            }
        };
    }
};
exports.ShopController = ShopController;
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Post)('register'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_shop_dto_1.CreateShopDto]),
    __metadata("design:returntype", Promise)
], ShopController.prototype, "registerShop", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(':id/profile'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ShopController.prototype, "getShopProfile", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ShopController.prototype, "getShops", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(':id/categories'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ShopController.prototype, "getShopCategories", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(':id/products'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ShopController.prototype, "getShopProducts", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(':id/vouchers'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ShopController.prototype, "getShopVouchers", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ShopController.prototype, "getMyShop", null);
__decorate([
    (0, common_1.Get)(':slug'),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ShopController.prototype, "getShopPublic", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Get)('me/decoration'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ShopController.prototype, "getMyDecoration", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Put)('me/decoration'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ShopController.prototype, "updateDecoration", null);
__decorate([
    (0, common_1.Get)(':id/custom-categories'),
    (0, public_decorator_1.Public)(),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ShopController.prototype, "getShopCustomCategories", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Put)('me/profile'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_shop_dto_1.UpdateShopProfileDto]),
    __metadata("design:returntype", Promise)
], ShopController.prototype, "updateMyShopProfile", null);
__decorate([
    (0, common_1.Get)(':id/reviews'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('page', new common_1.DefaultValuePipe(1), common_1.ParseIntPipe)),
    __param(2, (0, common_1.Query)('limit', new common_1.DefaultValuePipe(10), common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Number]),
    __metadata("design:returntype", Promise)
], ShopController.prototype, "getShopReviews", null);
exports.ShopController = ShopController = __decorate([
    (0, common_1.Controller)('shops'),
    __metadata("design:paramtypes", [shop_service_1.ShopService, prisma_service_1.PrismaService])
], ShopController);
//# sourceMappingURL=shop.controller.js.map