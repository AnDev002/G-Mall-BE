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
exports.HomeSettingsController = void 0;
const common_1 = require("@nestjs/common");
const home_settings_service_1 = require("./home-settings.service");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const jwt_guard_1 = require("../../modules/auth/guards/jwt.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const public_decorator_1 = require("../../common/decorators/public.decorator");
let HomeSettingsController = class HomeSettingsController {
    homeSettingsService;
    constructor(homeSettingsService) {
        this.homeSettingsService = homeSettingsService;
    }
    getPublicLayout() {
        return this.homeSettingsService.getHomeLayout();
    }
    getAllForAdmin() {
        return this.homeSettingsService.getAllSections();
    }
    create(data) {
        return this.homeSettingsService.createSection(data);
    }
    reorder(body) {
        return this.homeSettingsService.reorderSections(body.ids);
    }
    update(id, data) {
        return this.homeSettingsService.updateSection(id, data);
    }
    delete(id) {
        return this.homeSettingsService.deleteSection(id);
    }
};
exports.HomeSettingsController = HomeSettingsController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('layout'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HomeSettingsController.prototype, "getPublicLayout", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HomeSettingsController.prototype, "getAllForAdmin", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], HomeSettingsController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('reorder'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], HomeSettingsController.prototype, "reorder", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], HomeSettingsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], HomeSettingsController.prototype, "delete", null);
exports.HomeSettingsController = HomeSettingsController = __decorate([
    (0, common_1.Controller)('home-settings'),
    __metadata("design:paramtypes", [home_settings_service_1.HomeSettingsService])
], HomeSettingsController);
//# sourceMappingURL=home-settings.controller.js.map