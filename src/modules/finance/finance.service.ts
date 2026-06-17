import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { getPagination } from 'src/common/utils/pagination.util';
import { OrderStatus, PayoutStatus, WalletTransactionType } from '@prisma/client';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  // API 1: Thống kê doanh thu (Giả định đơn DELIVERED là doanh thu thực)
  async getRevenueStats(period: string) {
    // 1. Tổng GMV (Gross Merchandise Value) toàn sàn
    const totalRevenueAgg = await this.prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { status: OrderStatus.DELIVERED },
    });
    
    const totalRevenue = Number(totalRevenueAgg._sum.totalAmount) || 0;

    // 2. Tính toán "Phí sàn" (Giả sử sàn thu 5% mỗi đơn)
    // Trong thực tế, bạn nên lưu field `platformFee` trong Order model
    const platformFee = totalRevenue * 0.05; 

    // 3. Số tiền đang chờ giải ngân (Payout PENDING)
    const pendingPayoutAgg = await this.prisma.payoutRequest.aggregate({
      _sum: { amount: true },
      where: { status: PayoutStatus.PENDING },
    });

    // 4. Chart Data — group by tháng cho 12 tháng gần nhất.
    //    MySQL DATE_FORMAT trả 'YYYY-MM'. Raw SQL vì Prisma group-by không
    //    hỗ trợ format date trực tiếp.
    let chartData: { date: string; value: number }[] = [];
    try {
      const since = new Date();
      since.setMonth(since.getMonth() - 11);
      since.setDate(1);
      since.setHours(0, 0, 0, 0);

      const rows = await this.prisma.$queryRawUnsafe<
        { ym: string; total: any }[]
      >(
        `SELECT DATE_FORMAT(createdAt, '%Y-%m') AS ym, COALESCE(SUM(totalAmount), 0) AS total
         FROM \`Order\`
         WHERE status = 'DELIVERED' AND createdAt >= ?
         GROUP BY ym
         ORDER BY ym ASC`,
        since,
      );

      // Fill các tháng thiếu = 0 để biểu đồ liên tục, không nhảy gap.
      const map = new Map<string, number>();
      for (const r of rows) map.set(r.ym, Number(r.total) || 0);
      for (let i = 0; i < 12; i++) {
        const d = new Date(since);
        d.setMonth(since.getMonth() + i);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        chartData.push({ date: ym, value: map.get(ym) || 0 });
      }
    } catch (e) {
      // Fallback nhẹ nếu raw SQL fail (DB không hỗ trợ DATE_FORMAT...)
      chartData = [];
    }

    return {
      totalRevenue,
      platformFee,
      pendingPayout: Number(pendingPayoutAgg._sum.amount) || 0,
      chartData
    };
  }

  // API 2: Lấy danh sách rút tiền
  async getPayoutRequests(page: number, status?: string) {
    // Wiki 0074: clamp page (page=-1 → skip âm → Prisma 500).
    const limit = 10;
    const _pg = getPagination(page, limit, { defaultLimit: 10 });
    page = _pg.page;
    const skip = _pg.skip;
    
    const where: any = {};
    if (status && status !== 'ALL') {
      where.status = status as PayoutStatus;
    }

    const [data, total] = await Promise.all([
      this.prisma.payoutRequest.findMany({
        where,
        skip,
        take: limit,
        include: { user: { select: { shopName: true, email: true } } }, // Lấy tên Shop
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payoutRequest.count({ where }),
    ]);

    // Map data về format FE cần
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

  // API 3: Duyệt rút tiền (Trừ tiền trong ví Seller - Logic: Đã trừ lúc tạo request hay trừ lúc duyệt?)
  // THƯỜNG GẶP: Seller tạo request -> Tiền bị trừ (hoặc đóng băng). Admin duyệt -> Status thành Approved.
  // Ở đây giả sử: Tiền đã bị trừ khỏi ví khả dụng khi Seller bấm "Rút tiền". Admin chỉ confirm status.
  // Wiki 0084: SELLER tạo yêu cầu rút tiền — ESCROW (trừ ví ngay) atomic, chống overdraw.
  async requestPayout(userId: string, amount: number, bankInfo: string) {
    const amt = Math.floor(Number(amount));
    if (!amt || amt <= 0) throw new BadRequestException('Số tiền rút không hợp lệ');
    if (!bankInfo || !bankInfo.trim()) throw new BadRequestException('Thiếu thông tin ngân hàng nhận tiền');
    return this.prisma.$transaction(async (tx) => {
      const debit = await tx.user.updateMany({
        where: { id: userId, walletBalance: { gte: amt } },
        data: { walletBalance: { decrement: amt } },
      });
      if (debit.count === 0) throw new BadRequestException('Số dư ví không đủ');
      const req = await tx.payoutRequest.create({
        data: { userId, amount: amt, bankInfo, status: PayoutStatus.PENDING },
      });
      await tx.walletTransaction.create({
        data: { userId, amount: -amt, type: WalletTransactionType.PAYOUT, status: 'PENDING', referenceId: req.id, description: `Yêu cầu rút tiền #${req.id}` },
      });
      return { success: true, id: req.id, amount: amt };
    });
  }

  async getMyWallet(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { walletBalance: true } });
    return { walletBalance: Number(u?.walletBalance ?? 0) };
  }

  async getMyPayouts(userId: string) {
    const rows = await this.prisma.payoutRequest.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 });
    return rows.map((r) => ({ id: r.id, amount: Number(r.amount), bankInfo: r.bankInfo, status: r.status, reason: r.reason, requestedAt: r.createdAt, processedAt: r.processedAt }));
  }

  // Wiki 0084: ADMIN duyệt — ATOMIC transition (chống double-approve TOCTOU). Tiền đã escrow lúc
  // seller tạo request → approve chỉ đổi status + ghi log (không trừ ví lần nữa).
  async approvePayout(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const upd = await tx.payoutRequest.updateMany({
        where: { id, status: PayoutStatus.PENDING },
        data: { status: PayoutStatus.APPROVED, processedAt: new Date() },
      });
      if (upd.count === 0) throw new BadRequestException('Yêu cầu không hợp lệ hoặc đã xử lý');
      // [round14 FIX L3] KHÔNG tạo WalletTransaction mới (double-debit trong ledger).
      // Tiền đã trừ ví + ghi 1 dòng PAYOUT PENDING lúc seller tạo request → approve
      // chỉ chuyển dòng đó sang COMPLETED để ledger sum khớp walletBalance.
      const _txUpd = await tx.walletTransaction.updateMany({
        where: { referenceId: id, type: WalletTransactionType.PAYOUT, status: 'PENDING' },
        data: { status: 'COMPLETED', description: `Approved payout #${id}` },
      });
      // [round14 review-FIX] Legacy: request tạo TRƯỚC round14 không có dòng PAYOUT/PENDING đối ứng →
      // count===0 → ghi 1 dòng PAYOUT COMPLETED (amount ÂM) để debit được ghi nhận, ledger khớp ví.
      if (_txUpd.count === 0) {
        const _req = await tx.payoutRequest.findUnique({ where: { id } });
        if (_req) {
          await tx.walletTransaction.create({
            data: { userId: _req.userId, amount: -Number(_req.amount), type: WalletTransactionType.PAYOUT, status: 'COMPLETED', referenceId: id, description: `Payout #${id}` },
          });
        }
      }
      return { success: true };
    });
  }

  // Wiki 0084: ADMIN từ chối — ATOMIC transition + HOÀN tiền đã escrow. Chỉ hoàn khi transition
  // thành công (count===1) → chống double-refund / mint tiền (lỗ hổng cũ: refund không debit).
  async rejectPayout(id: string, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const upd = await tx.payoutRequest.updateMany({
        where: { id, status: PayoutStatus.PENDING },
        data: { status: PayoutStatus.REJECTED, reason, processedAt: new Date() },
      });
      if (upd.count === 0) throw new BadRequestException('Yêu cầu không hợp lệ hoặc đã xử lý');
      const request = await tx.payoutRequest.findUnique({ where: { id } });
      await tx.user.update({ where: { id: request!.userId }, data: { walletBalance: { increment: Number(request!.amount) } } });
      // [round14 review-FIX] Đóng dòng PAYOUT/PENDING escrow → FAILED (trước đây để PENDING vĩnh viễn
      // khiến tổng ledger lệch). REFUND +amt bên dưới đối ứng -amt PAYOUT đã FAILED → ledger cân.
      await tx.walletTransaction.updateMany({
        where: { referenceId: id, type: WalletTransactionType.PAYOUT, status: 'PENDING' },
        data: { status: 'FAILED', description: `Rejected payout #${id}` },
      });
      await tx.walletTransaction.create({
        data: { userId: request!.userId, amount: Number(request!.amount), type: WalletTransactionType.REFUND, status: 'COMPLETED', referenceId: id, description: `Refund rejected payout #${id}: ${reason}` },
      });
      return { success: true };
    });
  }
}