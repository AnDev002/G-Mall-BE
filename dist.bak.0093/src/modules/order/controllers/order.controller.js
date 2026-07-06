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
exports.OrderController = void 0;
const common_1 = require("@nestjs/common");
const jwt_guard_1 = require("../../auth/guards/jwt.guard");
const order_service_1 = require("../order.service");
const create_order_dto_1 = require("../dto/create-order.dto");
const client_1 = require("@prisma/client");
const submit_review_dto_1 = require("../dto/submit-review.dto");
const user_decorator_1 = require("../../../common/decorators/user.decorator");
const review_service_1 = require("../review.service");
let OrderController = class OrderController {
    orderService;
    reviewService;
    constructor(orderService, reviewService) {
        this.orderService = orderService;
        this.reviewService = reviewService;
    }
    async preview(req, dto) {
        return this.orderService.previewOrder(req.user.id, dto);
    }
    async create(req, dto) {
        const clientIp = req.ip || req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || null;
        const result = await this.orderService.createOrder(req.user.id, dto, clientIp);
        return {
            success: true,
            message: 'Đặt hàng thành công',
            orders: result.orders,
            paymentUrl: result.paymentUrl,
        };
    }
    async submitReview(user, dto) {
        return this.reviewService.submitReview(user.id, dto);
    }
    async findAll(req, status) {
        const filterStatus = (status === 'all' || !status) ? undefined : status.toUpperCase();
        return this.orderService.getUserOrders(req.user.id, filterStatus);
    }
    async getSellerOrders(req, status) {
        return this.orderService.getSellerOrders(req.user.id, status);
    }
    async confirmReceived(req, id) {
        return this.orderService.confirmOrderReceived(req.user.id, id);
    }
    async findOne(req, id) {
        return this.orderService.findOne(id, req.user.id);
    }
    async updateStatus(id, status, req) {
        return this.orderService.updateOrderStatus(id, req.user.id, status);
    }
    async getSellerOrderDetail(id, req) {
        return this.orderService.getSellerOrderDetail(id, req.user.id);
    }
    async cancelOrder(req, id) {
        return this.orderService.cancelOrder(req.user.id, id);
    }
};
exports.OrderController = OrderController;
__decorate([
    (0, common_1.Post)('preview'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_order_dto_1.CreateOrderDto]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "preview", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_order_dto_1.CreateOrderDto]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('review'),
    __param(0, (0, user_decorator_1.User)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, submit_review_dto_1.SubmitOrderReviewDto]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "submitReview", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('seller'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "getSellerOrders", null);
__decorate([
    (0, common_1.Post)(':id/confirm'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "confirmReceived", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('status')),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Get)('seller/:id'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "getSellerOrderDetail", null);
__decorate([
    (0, common_1.Patch)(':id/cancel'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "cancelOrder", null);
exports.OrderController = OrderController = __decorate([
    (0, common_1.Controller)('orders'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [order_service_1.OrderService,
        review_service_1.ReviewService])
], OrderController);
//# sourceMappingURL=order.controller.js.map