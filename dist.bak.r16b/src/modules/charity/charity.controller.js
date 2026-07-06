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
exports.AdminCharityController = exports.CharityController = void 0;
const common_1 = require("@nestjs/common");
const charity_service_1 = require("./charity.service");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const jwt_guard_1 = require("../auth/guards/jwt.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const user_decorator_1 = require("../../common/decorators/user.decorator");
const create_fund_dto_1 = require("./dto/create-fund.dto");
const donate_dto_1 = require("./dto/donate.dto");
const redis_cache_interceptor_1 = require("../../common/interceptors/redis-cache.interceptor");
let CharityController = class CharityController {
    service;
    constructor(service) {
        this.service = service;
    }
    async listFunds(includeClosed) {
        return this.service.listFunds(includeClosed === 'true');
    }
    async getFund(slug) {
        return this.service.getFundBySlug(slug);
    }
    async listDonations(slug, limit) {
        const fund = await this.service.getFundBySlug(slug);
        return this.service.listDonationsForFund(fund.id, Number(limit) || 20);
    }
    async donate(user, dto) {
        return this.service.donate(user.id, dto);
    }
    async listActiveCampaigns() {
        return this.service.listActiveCampaignsForCheckout();
    }
};
exports.CharityController = CharityController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseInterceptors)(redis_cache_interceptor_1.RedisCacheInterceptor),
    (0, redis_cache_interceptor_1.CacheKey)('charity:funds'),
    (0, redis_cache_interceptor_1.CacheTTL)(30),
    (0, common_1.Get)('funds'),
    __param(0, (0, common_1.Query)('includeClosed')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CharityController.prototype, "listFunds", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseInterceptors)(redis_cache_interceptor_1.RedisCacheInterceptor),
    (0, redis_cache_interceptor_1.CacheKey)('charity:fund:slug'),
    (0, redis_cache_interceptor_1.CacheTTL)(30),
    (0, common_1.Get)('funds/:slug'),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CharityController.prototype, "getFund", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('funds/:slug/donations'),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], CharityController.prototype, "listDonations", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Post)('donate'),
    __param(0, (0, user_decorator_1.User)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, donate_dto_1.DonateDto]),
    __metadata("design:returntype", Promise)
], CharityController.prototype, "donate", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('campaigns/active'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CharityController.prototype, "listActiveCampaigns", null);
exports.CharityController = CharityController = __decorate([
    (0, common_1.Controller)('charity'),
    __metadata("design:paramtypes", [charity_service_1.CharityService])
], CharityController);
let AdminCharityController = class AdminCharityController {
    service;
    constructor(service) {
        this.service = service;
    }
    async listAllFunds() {
        return this.service.listFunds(true);
    }
    async createFund(dto) {
        return this.service.createFund(dto);
    }
    async updateFund(id, dto) {
        return this.service.updateFund(id, dto);
    }
    async listCampaigns(includeInactive) {
        return this.service.listCampaigns(includeInactive === 'true');
    }
    async createCampaign(dto) {
        return this.service.createCampaign(dto);
    }
    async updateCampaign(id, dto) {
        return this.service.updateCampaign(id, dto);
    }
    async deleteCampaign(id) {
        return this.service.deleteCampaign(id);
    }
};
exports.AdminCharityController = AdminCharityController;
__decorate([
    (0, common_1.Get)('funds'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminCharityController.prototype, "listAllFunds", null);
__decorate([
    (0, common_1.Post)('funds'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_fund_dto_1.CreateFundDto]),
    __metadata("design:returntype", Promise)
], AdminCharityController.prototype, "createFund", null);
__decorate([
    (0, common_1.Patch)('funds/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_fund_dto_1.UpdateFundDto]),
    __metadata("design:returntype", Promise)
], AdminCharityController.prototype, "updateFund", null);
__decorate([
    (0, common_1.Get)('campaigns'),
    __param(0, (0, common_1.Query)('includeInactive')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminCharityController.prototype, "listCampaigns", null);
__decorate([
    (0, common_1.Post)('campaigns'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminCharityController.prototype, "createCampaign", null);
__decorate([
    (0, common_1.Patch)('campaigns/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminCharityController.prototype, "updateCampaign", null);
__decorate([
    (0, common_1.Delete)('campaigns/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminCharityController.prototype, "deleteCampaign", null);
exports.AdminCharityController = AdminCharityController = __decorate([
    (0, common_1.Controller)('admin/charity'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    __metadata("design:paramtypes", [charity_service_1.CharityService])
], AdminCharityController);
//# sourceMappingURL=charity.controller.js.map