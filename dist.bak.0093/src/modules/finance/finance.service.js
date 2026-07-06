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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinanceService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const pagination_util_1 = require("../../common/utils/pagination.util");
const client_1 = require("@prisma/client");
let FinanceService = class FinanceService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getRevenueStats(period) {
        const totalRevenueAgg = await this.prisma.order.aggregate({
            _sum: { totalAmount: true },
            where: { status: client_1.OrderStatus.DELIVERED },
        });
        const totalRevenue = Number(totalRevenueAgg._sum.totalAmount) || 0;
        const platformFee = totalRevenue * 0.05;
        const pendingPayoutAgg = await this.prisma.payoutRequest.aggregate({
            _sum: { amount: true },
            where: { status: client_1.PayoutStatus.PENDING },
        });
        let chartData = [];
        try {
            const since = new Date();
            since.setMonth(since.getMonth() - 11);
            since.setDate(1);
            since.setHours(0, 0, 0, 0);
            const rows = await this.prisma.$queryRawUnsafe(`SELECT DATE_FORMAT(createdAt, '%Y-%m') AS ym, COALESCE(SUM(totalAmount), 0) AS total
         FROM \`Order\`
         WHERE status = 'DELIVERED' AND createdAt >= ?
         GROUP BY ym
         ORDER BY ym ASC`, since);
            const map = new Map();
            for (const r of rows)
                map.set(r.ym, Number(r.total) || 0);
            for (let i = 0; i < 12; i++) {
                const d = new Date(since);
                d.setMonth(since.getMonth() + i);
                const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                chartData.push({ date: ym, value: map.get(ym) || 0 });
            }
        }
        catch (e) {
            chartData = [];
        }
        return {
            totalRevenue,
            platformFee,
            pendingPayout: Number(pendingPayoutAgg._sum.amount) || 0,
            chartData
        };
    }
    async getPayoutRequests(page, status) {
        const limit = 10;
        const _pg = (0, pagination_util_1.getPagination)(page, limit, { defaultLimit: 10 });
        page = _pg.page;
        const skip = _pg.skip;
        const where = {};
        if (status && status !== 'ALL') {
            where.status = status;
        }
        const [data, total] = await Promise.all([
            this.prisma.payoutRequest.findMany({
                where,
                skip,
                take: limit,
                include: { user: { select: { shopName: true, email: true } } },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.payoutRequest.count({ where }),
        ]);
        const mappedData = data.map(item => ({
            id: item.id,
            shopId: item.userId,
            shopName: item.user.shopName || item.user.email,
            amount: Number(item.amount),
            bankInfo: item.bankInfo,
            status: item.status,
            requestedAt: item.createdAt,
            processedAt: item.processedAt,
        }));
        return {
            data: mappedData,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        };
    }
    async requestPayout(userId, amount, bankInfo) {
        const amt = Math.floor(Number(amount));
        if (!amt || amt <= 0)
            throw new common_1.BadRequestException('Số tiền rút không hợp lệ');
        if (!bankInfo || !bankInfo.trim())
            throw new common_1.BadRequestException('Thiếu thông tin ngân hàng nhận tiền');
        return this.prisma.$transaction(async (tx) => {
            const debit = await tx.user.updateMany({
                where: { id: userId, walletBalance: { gte: amt } },
                data: { walletBalance: { decrement: amt } },
            });
            if (debit.count === 0)
                throw new common_1.BadRequestException('Số dư ví không đủ');
            const req = await tx.payoutRequest.create({
                data: { userId, amount: amt, bankInfo, status: client_1.PayoutStatus.PENDING },
            });
            await tx.walletTransaction.create({
                data: { userId, amount: -amt, type: client_1.WalletTransactionType.PAYOUT, status: 'PENDING', referenceId: req.id, description: `Yêu cầu rút tiền #${req.id}` },
            });
            return { success: true, id: req.id, amount: amt };
        });
    }
    async getMyWallet(userId) {
        const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { walletBalance: true } });
        return { walletBalance: Number(u?.walletBalance ?? 0) };
    }
    async getMyPayouts(userId) {
        const rows = await this.prisma.payoutRequest.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 });
        return rows.map((r) => ({ id: r.id, amount: Number(r.amount), bankInfo: r.bankInfo, status: r.status, reason: r.reason, requestedAt: r.createdAt, processedAt: r.processedAt }));
    }
    async approvePayout(id) {
        return this.prisma.$transaction(async (tx) => {
            const upd = await tx.payoutRequest.updateMany({
                where: { id, status: client_1.PayoutStatus.PENDING },
                data: { status: client_1.PayoutStatus.APPROVED, processedAt: new Date() },
            });
            if (upd.count === 0)
                throw new common_1.BadRequestException('Yêu cầu không hợp lệ hoặc đã xử lý');
            const _txUpd = await tx.walletTransaction.updateMany({
                where: { referenceId: id, type: client_1.WalletTransactionType.PAYOUT, status: 'PENDING' },
                data: { status: 'COMPLETED', description: `Approved payout #${id}` },
            });
            if (_txUpd.count === 0) {
                const _req = await tx.payoutRequest.findUnique({ where: { id } });
                if (_req) {
                    await tx.walletTransaction.create({
                        data: { userId: _req.userId, amount: -Number(_req.amount), type: client_1.WalletTransactionType.PAYOUT, status: 'COMPLETED', referenceId: id, description: `Payout #${id}` },
                    });
                }
            }
            return { success: true };
        });
    }
    async rejectPayout(id, reason) {
        return this.prisma.$transaction(async (tx) => {
            const upd = await tx.payoutRequest.updateMany({
                where: { id, status: client_1.PayoutStatus.PENDING },
                data: { status: client_1.PayoutStatus.REJECTED, reason, processedAt: new Date() },
            });
            if (upd.count === 0)
                throw new common_1.BadRequestException('Yêu cầu không hợp lệ hoặc đã xử lý');
            const request = await tx.payoutRequest.findUnique({ where: { id } });
            await tx.user.update({ where: { id: request.userId }, data: { walletBalance: { increment: Number(request.amount) } } });
            await tx.walletTransaction.updateMany({
                where: { referenceId: id, type: client_1.WalletTransactionType.PAYOUT, status: 'PENDING' },
                data: { status: 'FAILED', description: `Rejected payout #${id}` },
            });
            await tx.walletTransaction.create({
                data: { userId: request.userId, amount: Number(request.amount), type: client_1.WalletTransactionType.REFUND, status: 'COMPLETED', referenceId: id, description: `Refund rejected payout #${id}: ${reason}` },
            });
            return { success: true };
        });
    }
};
exports.FinanceService = FinanceService;
exports.FinanceService = FinanceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FinanceService);
//# sourceMappingURL=finance.service.js.map