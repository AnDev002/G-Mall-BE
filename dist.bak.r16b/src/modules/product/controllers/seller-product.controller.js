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
exports.SellerProductController = void 0;
const common_1 = require("@nestjs/common");
const product_write_service_1 = require("../services/product-write.service");
const create_product_dto_1 = require("../dto/create-product.dto");
const update_product_dto_1 = require("../dto/update-product.dto");
const jwt_guard_1 = require("../../auth/guards/jwt.guard");
const roles_guard_1 = require("../../../common/guards/roles.guard");
const roles_decorator_1 = require("../../../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const user_decorator_1 = require("../../../common/decorators/user.decorator");
let SellerProductController = class SellerProductController {
    productWriteService;
    constructor(productWriteService) {
        this.productWriteService = productWriteService;
    }
    create(req, dto) {
        return this.productWriteService.create(req.user.id, dto);
    }
    update(req, id, dto) {
        return this.productWriteService.update(id, req.user.id, dto);
    }
    searchMyProducts(req, search, limit) {
        const limitNum = limit ? parseInt(limit) : 10;
        return this.productWriteService.searchMyProducts(req.user.id, search, limitNum);
    }
    async updateDiscount(user, id, dto) {
        return this.productWriteService.updateDiscount(user.id, id, dto);
    }
    async delete(req, id) {
        return this.productWriteService.deleteBySeller(req.user.id, id);
    }
    getMyProducts(req, status, page, limit, search, sortBy, sortOrder) {
        return this.productWriteService.findAllBySeller(req.user.id, status, {
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            search,
            sortBy,
            sortOrder,
        });
    }
    findOneForEdit(req, id) {
        return this.productWriteService.findOneForEdit(req.user.id, id);
    }
};
exports.SellerProductController = SellerProductController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_product_dto_1.CreateProductDto]),
    __metadata("design:returntype", void 0)
], SellerProductController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_product_dto_1.UpdateProductDto]),
    __metadata("design:returntype", void 0)
], SellerProductController.prototype, "update", null);
__decorate([
    (0, common_1.Get)('my-products'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('search')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], SellerProductController.prototype, "searchMyProducts", null);
__decorate([
    (0, common_1.Patch)(':id/discount'),
    __param(0, (0, user_decorator_1.User)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_product_dto_1.UpdateProductDiscountDto]),
    __metadata("design:returntype", Promise)
], SellerProductController.prototype, "updateDiscount", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SellerProductController.prototype, "delete", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('limit')),
    __param(4, (0, common_1.Query)('search')),
    __param(5, (0, common_1.Query)('sortBy')),
    __param(6, (0, common_1.Query)('sortOrder')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], SellerProductController.prototype, "getMyProducts", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SellerProductController.prototype, "findOneForEdit", null);
exports.SellerProductController = SellerProductController = __decorate([
    (0, common_1.Controller)('seller/products'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.SELLER),
    __metadata("design:paramtypes", [product_write_service_1.ProductWriteService])
], SellerProductController);
//# sourceMappingURL=seller-product.controller.js.map