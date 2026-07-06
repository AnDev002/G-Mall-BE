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
exports.PointController = void 0;
const common_1 = require("@nestjs/common");
const point_service_1 = require("./point.service");
const jwt_guard_1 = require("../../modules/auth/guards/jwt.guard");
const user_decorator_1 = require("../../common/decorators/user.decorator");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const roles_guard_1 = require("../../common/guards/roles.guard");
const client_1 = require("@prisma/client");
let PointController = class PointController {
    pointService;
    constructor(pointService) {
        this.pointService = pointService;
    }
    async getMyPointInfo(user) {
        return this.pointService.getMyPointInfo(user.id);
    }
    async getHistory(user) {
        return this.pointService.getHistory(user.id);
    }
    async checkIn(user) {
        return this.pointService.dailyCheckIn(user.id);
    }
    async initiateTransfer(user, body) {
        return this.pointService.initiateTransfer(user.id, body.receiverId, body.amount);
    }
    async getRate() {
        const rate = await this.pointService.getConversionRate();
        return { rate };
    }
    async updateConversionRate(body) {
        return this.pointService.updateConversionRate(body.amount);
    }
    async confirmTransfer(user, body) {
        return this.pointService.confirmTransfer(user.id, body.otp);
    }
};
exports.PointController = PointController;
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PointController.prototype, "getMyPointInfo", null);
__decorate([
    (0, common_1.Get)('history'),
    __param(0, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PointController.prototype, "getHistory", null);
__decorate([
    (0, common_1.Post)('check-in'),
    __param(0, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PointController.prototype, "checkIn", null);
__decorate([
    (0, common_1.Post)('transfer/init'),
    __param(0, (0, user_decorator_1.User)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PointController.prototype, "initiateTransfer", null);
__decorate([
    (0, common_1.Get)('rate'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PointController.prototype, "getRate", null);
__decorate([
    (0, common_1.Post)('rate'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PointController.prototype, "updateConversionRate", null);
__decorate([
    (0, common_1.Post)('transfer/confirm'),
    __param(0, (0, user_decorator_1.User)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PointController.prototype, "confirmTransfer", null);
exports.PointController = PointController = __decorate([
    (0, common_1.Controller)('points'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [point_service_1.PointService])
], PointController);
//# sourceMappingURL=point.controller.js.map