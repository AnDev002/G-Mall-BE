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
exports.ContentController = void 0;
const common_1 = require("@nestjs/common");
const content_service_1 = require("./content.service");
const content_dto_1 = require("./dto/content.dto");
const jwt_guard_1 = require("../../modules/auth/guards/jwt.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const public_decorator_1 = require("../../common/decorators/public.decorator");
let ContentController = class ContentController {
    contentService;
    constructor(contentService) {
        this.contentService = contentService;
    }
    async getBanners(location) {
        return this.contentService.getBanners(location);
    }
    async getConfig(key) {
        return this.contentService.getConfig(key);
    }
    async getAllBannersAdmin() {
        return this.contentService.getAllBannersAdmin();
    }
    async createBanner(dto) {
        return this.contentService.createBanner(dto);
    }
    async reorderBanners(body) {
        return this.contentService.reorderBanners(body);
    }
    async updateBanner(id, dto) {
        return this.contentService.updateBanner(id, dto);
    }
    async deleteBanner(id) {
        return this.contentService.deleteBanner(id);
    }
    async saveConfig(dto) {
        return this.contentService.saveConfig(dto);
    }
};
exports.ContentController = ContentController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('banners'),
    __param(0, (0, common_1.Query)('location')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ContentController.prototype, "getBanners", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('config/:key'),
    __param(0, (0, common_1.Param)('key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ContentController.prototype, "getConfig", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, common_1.Get)('admin/banners'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ContentController.prototype, "getAllBannersAdmin", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, common_1.Post)('admin/banners'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [content_dto_1.CreateBannerDto]),
    __metadata("design:returntype", Promise)
], ContentController.prototype, "createBanner", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, common_1.Patch)('admin/banners/reorder'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [content_dto_1.ReorderBannersDto]),
    __metadata("design:returntype", Promise)
], ContentController.prototype, "reorderBanners", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, common_1.Patch)('admin/banners/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, content_dto_1.UpdateBannerDto]),
    __metadata("design:returntype", Promise)
], ContentController.prototype, "updateBanner", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, common_1.Delete)('admin/banners/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ContentController.prototype, "deleteBanner", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, common_1.Post)('admin/config'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [content_dto_1.SaveConfigDto]),
    __metadata("design:returntype", Promise)
], ContentController.prototype, "saveConfig", null);
exports.ContentController = ContentController = __decorate([
    (0, common_1.Controller)('content'),
    __metadata("design:paramtypes", [content_service_1.ContentService])
], ContentController);
//# sourceMappingURL=content.controller.js.map