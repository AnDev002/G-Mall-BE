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
exports.SellerFinanceController = void 0;
const common_1 = require("@nestjs/common");
const finance_service_1 = require("./finance.service");
const jwt_guard_1 = require("../auth/guards/jwt.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
let SellerFinanceController = class SellerFinanceController {
    financeService;
    constructor(financeService) {
        this.financeService = financeService;
    }
    async getMyWallet(req) {
        return this.financeService.getMyWallet(req.user.userId || req.user.id);
    }
    async getMyPayouts(req) {
        return this.financeService.getMyPayouts(req.user.userId || req.user.id);
    }
    async requestPayout(req, body) {
        return this.financeService.requestPayout(req.user.userId || req.user.id, body?.amount, body?.bankInfo);
    }
};
exports.SellerFinanceController = SellerFinanceController;
__decorate([
    (0, common_1.Get)('wallet'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SellerFinanceController.prototype, "getMyWallet", null);
__decorate([
    (0, common_1.Get)('payouts'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SellerFinanceController.prototype, "getMyPayouts", null);
__decorate([
    (0, common_1.Post)('payout'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SellerFinanceController.prototype, "requestPayout", null);
exports.SellerFinanceController = SellerFinanceController = __decorate([
    (0, common_1.Controller)('seller/finance'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.SELLER),
    __metadata("design:paramtypes", [finance_service_1.FinanceService])
], SellerFinanceController);
//# sourceMappingURL=seller-finance.controller.js.map