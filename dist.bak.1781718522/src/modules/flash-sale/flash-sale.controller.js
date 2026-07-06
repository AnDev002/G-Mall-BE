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
exports.StoreFlashSaleController = exports.SellerFlashSaleController = exports.FlashSaleController = void 0;
const common_1 = require("@nestjs/common");
const flash_sale_service_1 = require("./flash-sale.service");
const create_flash_sale_dto_1 = require("./dto/create-flash-sale.dto");
const update_flash_sale_dto_1 = require("./dto/update-flash-sale.dto");
const register_flash_sale_dto_1 = require("./dto/register-flash-sale.dto");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const jwt_guard_1 = require("../../modules/auth/guards/jwt.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const user_decorator_1 = require("../../common/decorators/user.decorator");
const shop_service_1 = require("../shop/shop.service");
const public_decorator_1 = require("../../common/decorators/public.decorator");
let FlashSaleController = class FlashSaleController {
    flashSaleService;
    constructor(flashSaleService) {
        this.flashSaleService = flashSaleService;
    }
    create(createDto) {
        return this.flashSaleService.createSession(createDto);
    }
    findAll(date) {
        return this.flashSaleService.findAll(date);
    }
    update(id, updateDto) {
        return this.flashSaleService.update(id, updateDto);
    }
    remove(id) {
        return this.flashSaleService.remove(id);
    }
};
exports.FlashSaleController = FlashSaleController;
__decorate([
    (0, common_1.Post)('sessions'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_flash_sale_dto_1.CreateFlashSaleSessionDto]),
    __metadata("design:returntype", void 0)
], FlashSaleController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('sessions'),
    __param(0, (0, common_1.Query)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FlashSaleController.prototype, "findAll", null);
__decorate([
    (0, common_1.Patch)('sessions/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_flash_sale_dto_1.UpdateFlashSaleSessionDto]),
    __metadata("design:returntype", void 0)
], FlashSaleController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)('sessions/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FlashSaleController.prototype, "remove", null);
exports.FlashSaleController = FlashSaleController = __decorate([
    (0, common_1.Controller)('admin/flash-sale'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __metadata("design:paramtypes", [flash_sale_service_1.FlashSaleService])
], FlashSaleController);
let SellerFlashSaleController = class SellerFlashSaleController {
    flashSaleService;
    shopService;
    constructor(flashSaleService, shopService) {
        this.flashSaleService = flashSaleService;
        this.shopService = shopService;
    }
    getAvailableSessions() {
        return this.flashSaleService.findAvailableSessionsForSeller();
    }
    async getRegisteredProducts(user, sessionId) {
        const shop = await this.shopService.getShopByOwnerId(user.id);
        if (!shop)
            throw new common_1.BadRequestException('Shop not found');
        return this.flashSaleService.getRegisteredProducts(shop.id, sessionId);
    }
    async registerProducts(user, dto) {
        const shop = await this.shopService.getShopByOwnerId(user.id);
        if (!shop) {
            throw new common_1.BadRequestException('Tài khoản này chưa tạo Cửa hàng!');
        }
        return this.flashSaleService.registerProducts(shop.id, dto);
    }
};
exports.SellerFlashSaleController = SellerFlashSaleController;
__decorate([
    (0, common_1.Get)('sessions'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SellerFlashSaleController.prototype, "getAvailableSessions", null);
__decorate([
    (0, common_1.Get)('sessions/:sessionId/products'),
    __param(0, (0, user_decorator_1.User)()),
    __param(1, (0, common_1.Param)('sessionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SellerFlashSaleController.prototype, "getRegisteredProducts", null);
__decorate([
    (0, common_1.Post)('register'),
    __param(0, (0, user_decorator_1.User)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, register_flash_sale_dto_1.RegisterFlashSaleDto]),
    __metadata("design:returntype", Promise)
], SellerFlashSaleController.prototype, "registerProducts", null);
exports.SellerFlashSaleController = SellerFlashSaleController = __decorate([
    (0, common_1.Controller)('seller/flash-sale'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.SELLER),
    __metadata("design:paramtypes", [flash_sale_service_1.FlashSaleService, shop_service_1.ShopService])
], SellerFlashSaleController);
let StoreFlashSaleController = class StoreFlashSaleController {
    flashSaleService;
    constructor(flashSaleService) {
        this.flashSaleService = flashSaleService;
    }
    getCurrentSession() {
        return this.flashSaleService.getCurrentFlashSaleForBuyer();
    }
};
exports.StoreFlashSaleController = StoreFlashSaleController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('current'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StoreFlashSaleController.prototype, "getCurrentSession", null);
exports.StoreFlashSaleController = StoreFlashSaleController = __decorate([
    (0, common_1.Controller)('store/flash-sale'),
    __metadata("design:paramtypes", [flash_sale_service_1.FlashSaleService])
], StoreFlashSaleController);
//# sourceMappingURL=flash-sale.controller.js.map