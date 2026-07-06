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
exports.AdminUsersController = void 0;
const common_1 = require("@nestjs/common");
const admin_users_service_1 = require("../admin-users.service");
const jwt_guard_1 = require("../../auth/guards/jwt.guard");
const roles_guard_1 = require("../../../common/guards/roles.guard");
const roles_decorator_1 = require("../../../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const user_decorator_1 = require("../../../common/decorators/user.decorator");
const admin_users_dto_1 = require("../dto/admin-users.dto");
let AdminUsersController = class AdminUsersController {
    adminUsersService;
    constructor(adminUsersService) {
        this.adminUsersService = adminUsersService;
    }
    async getSellers(page, limit, search) {
        return this.adminUsersService.getSellers({
            page: Number(page) || 1,
            limit: Number(limit) || 10,
            search,
        });
    }
    async getSellerDetail(id) {
        return this.adminUsersService.getSellerDetail(id);
    }
    async toggleBan(req, id, body) {
        return this.adminUsersService.toggleBanShop(req.user.userId, id, body.isBanned, body.reason);
    }
    async getUsers(page, limit, search, role, minPoints, maxPoints, industryId) {
        return this.adminUsersService.getAllUsers({
            page: Number(page) || 1,
            limit: Number(limit) || 10,
            search,
            role,
            minPoints: minPoints ? Number(minPoints) : undefined,
            maxPoints: maxPoints ? Number(maxPoints) : undefined,
            industryId
        });
    }
    createUser(adminId, dto) {
        return this.adminUsersService.createUser(adminId, dto);
    }
    toggleBanUser(adminId, userId, dto) {
        return this.adminUsersService.toggleBanUser(adminId, userId, dto.isBanned, dto.reason);
    }
    async getPendingShops(page, limit) {
        return this.adminUsersService.getPendingShops(Number(page) || 1, Number(limit) || 10);
    }
    async approveShop(req, shopId) {
        return this.adminUsersService.approveShop(req.user.userId, shopId);
    }
    async rejectShop(req, shopId, body) {
        return this.adminUsersService.rejectShop(req.user.userId, shopId, body.reason);
    }
    async getShopUpdateRequests(page = 1, limit = 10) {
        return this.adminUsersService.getShopUpdateRequests(Number(page), Number(limit));
    }
    async approveShopUpdate(req, shopId) {
        return this.adminUsersService.approveShopUpdate(req.user.id, shopId);
    }
    async deleteUser(adminId, userId) {
        return this.adminUsersService.deleteUser(adminId, userId);
    }
};
exports.AdminUsersController = AdminUsersController;
__decorate([
    (0, common_1.Get)('sellers'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, String]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "getSellers", null);
__decorate([
    (0, common_1.Get)('sellers/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "getSellerDetail", null);
__decorate([
    (0, common_1.Patch)(':id/ban-status'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "toggleBan", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('search')),
    __param(3, (0, common_1.Query)('role')),
    __param(4, (0, common_1.Query)('minPoints')),
    __param(5, (0, common_1.Query)('maxPoints')),
    __param(6, (0, common_1.Query)('industryId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "getUsers", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, user_decorator_1.User)('userId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, admin_users_dto_1.CreateUserDto]),
    __metadata("design:returntype", void 0)
], AdminUsersController.prototype, "createUser", null);
__decorate([
    (0, common_1.Patch)(':id/ban'),
    __param(0, (0, user_decorator_1.User)('userId')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, admin_users_dto_1.ToggleBanUserDto]),
    __metadata("design:returntype", void 0)
], AdminUsersController.prototype, "toggleBanUser", null);
__decorate([
    (0, common_1.Get)('pending-shops'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "getPendingShops", null);
__decorate([
    (0, common_1.Patch)(':id/approve'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "approveShop", null);
__decorate([
    (0, common_1.Patch)(':id/reject'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "rejectShop", null);
__decorate([
    (0, common_1.Get)('shop-updates'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "getShopUpdateRequests", null);
__decorate([
    (0, common_1.Post)('approve-update/:shopId'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('shopId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "approveShopUpdate", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, user_decorator_1.User)('userId')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "deleteUser", null);
exports.AdminUsersController = AdminUsersController = __decorate([
    (0, common_1.Controller)('admin/users'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __metadata("design:paramtypes", [admin_users_service_1.AdminUsersService])
], AdminUsersController);
//# sourceMappingURL=admin-users.controller.js.map