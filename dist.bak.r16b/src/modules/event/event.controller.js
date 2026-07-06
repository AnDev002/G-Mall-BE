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
exports.EventController = void 0;
const common_1 = require("@nestjs/common");
const daily_service_1 = require("./daily.service");
const gacha_service_1 = require("../game/gacha.service");
const jwt_guard_1 = require("../../modules/auth/guards/jwt.guard");
const user_decorator_1 = require("../../common/decorators/user.decorator");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const roles_guard_1 = require("../../common/guards/roles.guard");
const client_1 = require("@prisma/client");
let EventController = class EventController {
    dailyService;
    gachaService;
    constructor(dailyService, gachaService) {
        this.dailyService = dailyService;
        this.gachaService = gachaService;
    }
    async dailyCheckIn(user) {
        return this.dailyService.checkIn(user.id);
    }
    async getStatus(user) {
        const dailyStatus = await this.dailyService.getDailyStatus(user.id);
        const gachaStatus = await this.gachaService.getTodaySpinStatus(user.id);
        return {
            isCheckedInToday: dailyStatus.isCheckedInToday,
            hasSpunToday: gachaStatus.hasSpun,
            currentStreak: dailyStatus.currentStreak,
        };
    }
    async resetTest(user) {
        if (process.env.NODE_ENV === 'production')
            throw new common_1.ForbiddenException();
        return this.dailyService.resetDailyTest(user.id);
    }
};
exports.EventController = EventController;
__decorate([
    (0, common_1.Post)('daily-checkin'),
    __param(0, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EventController.prototype, "dailyCheckIn", null);
__decorate([
    (0, common_1.Get)('status'),
    __param(0, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EventController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Post)('reset-test'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EventController.prototype, "resetTest", null);
exports.EventController = EventController = __decorate([
    (0, common_1.Controller)('events'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [daily_service_1.DailyService,
        gacha_service_1.GachaService])
], EventController);
//# sourceMappingURL=event.controller.js.map