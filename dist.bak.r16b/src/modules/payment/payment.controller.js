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
var PaymentController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentController = void 0;
const common_1 = require("@nestjs/common");
const payment_service_1 = require("./payment.service");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const public_decorator_1 = require("../../common/decorators/public.decorator");
let PaymentController = PaymentController_1 = class PaymentController {
    paymentService;
    prisma;
    logger = new common_1.Logger(PaymentController_1.name);
    constructor(paymentService, prisma) {
        this.paymentService = paymentService;
        this.prisma = prisma;
    }
    hasExplicitPaymentFailure(body) {
        const statusStr = String(body?.status ?? body?.payment_status ?? body?.transactionStatus ?? '').toLowerCase();
        if (['failed', 'fail', 'cancelled', 'canceled', 'declined', 'expired'].includes(statusStr))
            return true;
        if (body?.resultCode !== undefined && body?.resultCode !== null && body?.resultCode !== '' &&
            Number.isFinite(Number(body.resultCode)) && Number(body.resultCode) !== 0)
            return true;
        return false;
    }
    async flagMoneyReceivedNoFulfillment(gateway, groupWhere, groupRef, paidAmount) {
        try {
            const cancelled = await this.prisma.order.findMany({
                where: { ...groupWhere, status: 'CANCELLED' },
                select: { id: true, paymentStatus: true },
            });
            if (cancelled.length === 0)
                return;
            this.logger.error(`[${gateway} IPN] MONEY-RECEIVED-NO-FULFILLMENT: group=${groupRef} đã CANCELLED nhưng cổng đã thu ` +
                `paid=${paidAmount}. CẦN HOÀN TIỀN THỦ CÔNG. orders=${cancelled.map((o) => o.id).join(',')}`);
            try {
                await this.prisma.order.updateMany({
                    where: { ...groupWhere, status: 'CANCELLED' },
                    data: { message: `[REFUND-NEEDED] ${gateway} đã thu ${paidAmount}đ trên đơn đã hủy` },
                });
            }
            catch { }
        }
        catch (e) {
            this.logger.warn(`[${gateway} IPN] flagMoneyReceivedNoFulfillment lỗi: ${e?.message}`);
        }
    }
    async handlePay2SIPN(body, res) {
        const isValid = this.paymentService.verifyPay2SSignature(body);
        if (!isValid) {
            this.logger.warn(`[Pay2S IPN] Invalid signature for body=${JSON.stringify(body)}`);
            return res.status(common_1.HttpStatus.BAD_REQUEST).send({ message: 'Invalid Signature' });
        }
        const orderId = body.orderId || body.order_id;
        if (!orderId) {
            return res.status(common_1.HttpStatus.BAD_REQUEST).send({ message: 'Missing orderId' });
        }
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            return res.status(common_1.HttpStatus.OK).send({ success: true });
        if (this.hasExplicitPaymentFailure(body)) {
            this.logger.warn(`[Pay2S IPN] not successful, skip PAID: status=${body?.status} resultCode=${body?.resultCode}`);
            return res.status(common_1.HttpStatus.OK).send({ success: true });
        }
        const groupWhere = order.paymentGroupId ? { paymentGroupId: order.paymentGroupId } : { id: orderId };
        const agg = await this.prisma.order.aggregate({ where: groupWhere, _sum: { totalAmount: true }, _count: true });
        const expected = Math.floor(Number(agg._sum.totalAmount ?? order.totalAmount));
        const paid = Math.floor(Number(body.amount ?? -1));
        if (!Number.isFinite(paid) || paid < 0) {
            this.logger.warn(`[Pay2S IPN] missing/invalid amount, skip PAID: group=${order.paymentGroupId ?? orderId} amount=${body?.amount}`);
            return res.status(common_1.HttpStatus.OK).send({ success: true });
        }
        const tolerance = (agg._count || 1) * 4 + 10;
        if (paid < expected - tolerance) {
            this.logger.warn(`[Pay2S IPN] underpayment group=${order.paymentGroupId ?? orderId} paid=${paid} < expected=${expected} (tol=${tolerance})`);
            return res.status(common_1.HttpStatus.BAD_REQUEST).send({ message: 'Amount mismatch' });
        }
        const upd = await this.prisma.order.updateMany({
            where: { ...groupWhere, paymentStatus: 'PENDING', status: { not: 'CANCELLED' } },
            data: { paymentStatus: 'PAID' },
        });
        if (upd.count === 0) {
            this.logger.log(`[Pay2S IPN] group=${order.paymentGroupId ?? orderId} đã xử lý`);
            await this.flagMoneyReceivedNoFulfillment('Pay2S', groupWhere, order.paymentGroupId ?? orderId, paid);
        }
        return res.status(common_1.HttpStatus.OK).send({ success: true });
    }
    async handleMomoIPN(body, res) {
        const isValid = this.paymentService.verifyMomoSignature(body);
        if (!isValid) {
            this.logger.warn(`[MoMo IPN] Invalid signature for orderId=${body?.orderId}`);
            return res.status(common_1.HttpStatus.BAD_REQUEST).send({ message: 'Invalid Signature' });
        }
        const orderId = body.orderId;
        if (!orderId) {
            return res.status(common_1.HttpStatus.BAD_REQUEST).send({ message: 'Missing orderId' });
        }
        const isSuccess = Number(body.resultCode) === 0;
        if (isSuccess) {
            const order = await this.prisma.order.findUnique({ where: { id: orderId } });
            if (!order)
                return res.status(common_1.HttpStatus.OK).send({ success: true });
            const groupWhere = order.paymentGroupId ? { paymentGroupId: order.paymentGroupId } : { id: orderId };
            const agg = await this.prisma.order.aggregate({ where: groupWhere, _sum: { totalAmount: true }, _count: true });
            const expected = Math.floor(Number(agg._sum.totalAmount ?? order.totalAmount));
            const paid = Math.floor(Number(body.amount ?? -1));
            if (!Number.isFinite(paid) || paid < 0) {
                this.logger.warn(`[MoMo IPN] missing/invalid amount, skip PAID: group=${order.paymentGroupId ?? orderId} amount=${body?.amount}`);
                return res.status(common_1.HttpStatus.OK).send({ success: true });
            }
            const tolerance = (agg._count || 1) * 4 + 10;
            if (paid < expected - tolerance) {
                this.logger.warn(`[MoMo IPN] underpayment group=${order.paymentGroupId ?? orderId} paid=${paid} < expected=${expected} (tol=${tolerance})`);
                return res.status(common_1.HttpStatus.BAD_REQUEST).send({ message: 'Amount mismatch' });
            }
            const upd = await this.prisma.order.updateMany({
                where: { ...groupWhere, paymentStatus: 'PENDING', status: { not: 'CANCELLED' } },
                data: { paymentStatus: 'PAID' },
            });
            if (upd.count === 0) {
                this.logger.log(`[MoMo IPN] group=${order.paymentGroupId ?? orderId} đã xử lý`);
                await this.flagMoneyReceivedNoFulfillment('MoMo', groupWhere, order.paymentGroupId ?? orderId, paid);
            }
        }
        else {
            this.logger.log(`[MoMo IPN] orderId=${orderId} resultCode=${body.resultCode} message=${body.message}`);
        }
        return res.status(common_1.HttpStatus.OK).send({ success: true });
    }
};
exports.PaymentController = PaymentController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('pay2s-ipn'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "handlePay2SIPN", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('momo-ipn'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "handleMomoIPN", null);
exports.PaymentController = PaymentController = PaymentController_1 = __decorate([
    (0, common_1.Controller)('payment'),
    __metadata("design:paramtypes", [payment_service_1.PaymentService,
        prisma_service_1.PrismaService])
], PaymentController);
//# sourceMappingURL=payment.controller.js.map