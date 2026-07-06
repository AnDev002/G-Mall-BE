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
exports.PromotionController = exports.CalculateCartDto = void 0;
const common_1 = require("@nestjs/common");
const promotion_service_1 = require("./promotion.service");
const jwt_guard_1 = require("../auth/guards/jwt.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const client_1 = require("@prisma/client");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const user_decorator_1 = require("../../common/decorators/user.decorator");
const create_voucher_dto_1 = require("./dto/create-voucher.dto");
const public_decorator_1 = require("../../common/decorators/public.decorator");
class CalculateCartDto {
    total;
    voucherCode;
    items;
}
exports.CalculateCartDto = CalculateCartDto;
let PromotionController = class PromotionController {
    promotionService;
    constructor(promotionService) {
        this.promotionService = promotionService;
    }
    async createVoucher(dto, user) {
        return this.promotionService.createShopVoucher(user.id, dto);
    }
    async getPublicSystemVouchers() {
        return this.promotionService.getPublicSystemVouchers();
    }
    async claimVoucher(code, user) {
        return this.promotionService.claimVoucher(user.id, code);
    }
    async calculateCart(dto) {
        return this.promotionService.calculateDiscount(dto);
    }
    async getSellerVouchers(user) {
        return this.promotionService.getShopVouchers(user.id);
    }
    async getMyVouchers(user) {
        return this.promotionService.getMyVouchers(user.id);
    }
    async createSystemVoucher(dto) {
        return this.promotionService.createSystemVoucher(dto);
    }
    async getSystemVouchers() {
        return this.promotionService.getSystemVouchers();
    }
    async getAllVouchers(scope, search) {
        const voucherScope = scope ? scope : undefined;
        return this.promotionService.getAllVouchers({ scope: voucherScope, search });
    }
};
exports.PromotionController = PromotionController;
__decorate([
    (0, common_1.Post)('seller/create'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.SELLER),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_voucher_dto_1.CreateVoucherDto, Object]),
    __metadata("design:returntype", Promise)
], PromotionController.prototype, "createVoucher", null);
__decorate([
    (0, common_1.Get)('public/system-vouchers'),
    (0, public_decorator_1.Public)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PromotionController.prototype, "getPublicSystemVouchers", null);
__decorate([
    (0, common_1.Post)(':code/claim'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('code')),
    __param(1, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PromotionController.prototype, "claimVoucher", null);
__decorate([
    (0, common_1.Post)('calculate'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CalculateCartDto]),
    __metadata("design:returntype", Promise)
], PromotionController.prototype, "calculateCart", null);
__decorate([
    (0, common_1.Get)('seller'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.SELLER),
    __param(0, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PromotionController.prototype, "getSellerVouchers", null);
__decorate([
    (0, common_1.Get)('my-vouchers'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PromotionController.prototype, "getMyVouchers", null);
__decorate([
    (0, common_1.Post)('admin/create'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_voucher_dto_1.CreateVoucherDto]),
    __metadata("design:returntype", Promise)
], PromotionController.prototype, "createSystemVoucher", null);
__decorate([
    (0, common_1.Get)('admin/system-vouchers'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PromotionController.prototype, "getSystemVouchers", null);
__decorate([
    (0, common_1.Get)('admin/all'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Query)('scope')),
    __param(1, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], PromotionController.prototype, "getAllVouchers", null);
exports.PromotionController = PromotionController = __decorate([
    (0, common_1.Controller)('promotions'),
    __metadata("design:paramtypes", [promotion_service_1.PromotionService])
], PromotionController);
//# sourceMappingURL=promotion.controller.js.map