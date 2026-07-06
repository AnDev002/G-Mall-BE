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
exports.ShopCategoryController = void 0;
const common_1 = require("@nestjs/common");
const jwt_guard_1 = require("../auth/guards/jwt.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const prisma_service_1 = require("../../database/prisma/prisma.service");
let ShopCategoryController = class ShopCategoryController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getShopId(ownerId) {
        if (!ownerId)
            throw new common_1.NotFoundException('User ID not found in request');
        const shop = await this.prisma.shop.findFirst({ where: { ownerId } });
        if (!shop)
            throw new common_1.NotFoundException('Shop not found');
        return shop.id;
    }
    async create(req, name) {
        const shopId = await this.getShopId(req.user.id);
        return this.prisma.shopCategory.create({
            data: { name, shopId }
        });
    }
    async findAll(req) {
        const shopId = await this.getShopId(req.user.id);
        return this.prisma.shopCategory.findMany({
            where: { shopId, isActive: true },
            include: {
                _count: { select: { products: true } }
            }
        });
    }
    async update(req, id, body) {
        const shopId = await this.getShopId(req.user.id);
        const category = await this.prisma.shopCategory.findFirst({ where: { id, shopId } });
        if (!category)
            throw new common_1.NotFoundException('Danh mục không tồn tại');
        return this.prisma.shopCategory.update({
            where: { id },
            data: { ...body }
        });
    }
    async remove(req, id) {
        const shopId = await this.getShopId(req.user.id);
        const category = await this.prisma.shopCategory.findFirst({ where: { id, shopId } });
        if (!category)
            throw new common_1.NotFoundException('Danh mục không tồn tại');
        await this.prisma.product.updateMany({
            where: { shopCategoryId: id },
            data: { shopCategoryId: null }
        });
        return this.prisma.shopCategory.delete({ where: { id } });
    }
    async addProducts(req, id, productIds) {
        const shopId = await this.getShopId(req.user.id);
        const category = await this.prisma.shopCategory.findFirst({ where: { id, shopId } });
        if (!category)
            throw new common_1.NotFoundException('Danh mục không tồn tại');
        return this.prisma.product.updateMany({
            where: {
                id: { in: productIds },
                shopId: shopId
            },
            data: { shopCategoryId: id }
        });
    }
    async removeProducts(req, id, productIds) {
        const shopId = await this.getShopId(req.user.id);
        return this.prisma.product.updateMany({
            where: {
                id: { in: productIds },
                shopId: shopId,
                shopCategoryId: id
            },
            data: { shopCategoryId: null }
        });
    }
};
exports.ShopCategoryController = ShopCategoryController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)('name')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ShopCategoryController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ShopCategoryController.prototype, "findAll", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ShopCategoryController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ShopCategoryController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/products'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)('productIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Array]),
    __metadata("design:returntype", Promise)
], ShopCategoryController.prototype, "addProducts", null);
__decorate([
    (0, common_1.Delete)(':id/products'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)('productIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Array]),
    __metadata("design:returntype", Promise)
], ShopCategoryController.prototype, "removeProducts", null);
exports.ShopCategoryController = ShopCategoryController = __decorate([
    (0, common_1.Controller)('seller/shop-categories'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('SELLER'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ShopCategoryController);
//# sourceMappingURL=shop-category.controller.js.map