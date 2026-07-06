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
exports.GhnController = void 0;
const common_1 = require("@nestjs/common");
const ghn_service_1 = require("./ghn.service");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const jwt_guard_1 = require("../auth/guards/jwt.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const user_decorator_1 = require("../../common/decorators/user.decorator");
const shop_service_1 = require("../shop/shop.service");
const bulk_shipping_dto_1 = require("./dto/bulk-shipping.dto");
let GhnController = class GhnController {
    ghnService;
    shopService;
    constructor(ghnService, shopService) {
        this.ghnService = ghnService;
        this.shopService = shopService;
    }
    async calculateFee(body) {
        const total = await this.ghnService.calculateFee(body);
        return { total };
    }
    async calculateTime(body) {
        const leadtimeTimestamp = await this.ghnService.calculateExpectedDeliveryTime(body);
        return { leadtime: leadtimeTimestamp };
    }
    async getProvinces() {
        return this.ghnService.getProvinces();
    }
    async getDistricts(provinceId) {
        return this.ghnService.getDistricts(Number(provinceId));
    }
    async getWards(districtId) {
        return this.ghnService.getWards(Number(districtId));
    }
    async getShopIdOrThrow(userId) {
        const shop = await this.shopService.getShopByOwnerId(userId);
        if (!shop)
            throw new common_1.BadRequestException('Tài khoản chưa có Shop');
        return shop.id;
    }
    async bulkUpdateAddress(user, dto) {
        const shopId = await this.getShopIdOrThrow(user.id);
        const results = await this.ghnService.bulkUpdateAddress(shopId, dto);
        return {
            successCount: results.filter(r => r.ok).length,
            failCount: results.filter(r => !r.ok).length,
            results,
        };
    }
    async bulkChangePickupDate(user, dto) {
        const shopId = await this.getShopIdOrThrow(user.id);
        const results = await this.ghnService.bulkChangePickupDate(shopId, dto);
        return {
            successCount: results.filter(r => r.ok).length,
            failCount: results.filter(r => !r.ok).length,
            results,
        };
    }
    async bulkRequestPickup(user, dto) {
        const shopId = await this.getShopIdOrThrow(user.id);
        const results = await this.ghnService.bulkRequestPickup(shopId, dto);
        return {
            successCount: results.filter(r => r.ok).length,
            failCount: results.filter(r => !r.ok).length,
            results,
        };
    }
};
exports.GhnController = GhnController;
__decorate([
    (0, common_1.Post)('calculate-fee'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GhnController.prototype, "calculateFee", null);
__decorate([
    (0, common_1.Post)('calculate-time'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GhnController.prototype, "calculateTime", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('provinces'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], GhnController.prototype, "getProvinces", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('districts'),
    __param(0, (0, common_1.Query)('province_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GhnController.prototype, "getDistricts", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('wards'),
    __param(0, (0, common_1.Query)('district_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GhnController.prototype, "getWards", null);
__decorate([
    (0, common_1.Post)('seller/bulk/update-address'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.SELLER),
    __param(0, (0, user_decorator_1.User)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, bulk_shipping_dto_1.BulkUpdateAddressDto]),
    __metadata("design:returntype", Promise)
], GhnController.prototype, "bulkUpdateAddress", null);
__decorate([
    (0, common_1.Post)('seller/bulk/change-pickup-date'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.SELLER),
    __param(0, (0, user_decorator_1.User)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, bulk_shipping_dto_1.BulkChangePickupDateDto]),
    __metadata("design:returntype", Promise)
], GhnController.prototype, "bulkChangePickupDate", null);
__decorate([
    (0, common_1.Post)('seller/bulk/request-pickup'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.SELLER),
    __param(0, (0, user_decorator_1.User)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, bulk_shipping_dto_1.BulkRequestPickupDto]),
    __metadata("design:returntype", Promise)
], GhnController.prototype, "bulkRequestPickup", null);
exports.GhnController = GhnController = __decorate([
    (0, common_1.Controller)('ghn'),
    __metadata("design:paramtypes", [ghn_service_1.GhnService,
        shop_service_1.ShopService])
], GhnController);
//# sourceMappingURL=ghn.controller.js.map