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
  async approvePayout(id: string) {
    const request = await this.prisma.payoutRequest.findUnique({ where: { id } });
    if (!request || request.status !== PayoutStatus.PENDING) {
      throw new BadRequestException('Yêu cầu không hợp lệ hoặc đã xử lý');
    }

    // Cập nhật status -> APPROVED
    await this.prisma.payoutRequest.update({
      where: { id },
      data: {
        status: PayoutStatus.APPROVED,
        processedAt: new Date(),
      },
    });

    // Tạo log giao dịch hệ thống (Optional)
    await this.prisma.walletTransaction.create({
      data: {
        userId: request.userId,
        amount: -request.amount, // Ghi nhận dòng tiền đi ra
        type: WalletTransactionType.PAYOUT,
        status: 'COMPLETED',
        referenceId: request.id,
        description: `Admin approved payout #${request.id}`,
      }
    });

    return { success: true };
  }

  // API 4: Từ chối rút tiền (Hoàn lại tiền vào ví Seller)
  async rejectPayout(id: string, reason: string) {
    const request = await this.prisma.payoutRequest.findUnique({ where: { id } });
    if (!request || request.status !== PayoutStatus.PENDING) {
      throw new BadRequestException('Yêu cầu không hợp lệ');
    }

    // 1. Cập nhật status -> REJECTED
    await this.prisma.payoutRequest.update({
      where: { id },
      data: {
        status: PayoutStatus.REJECTED,
        reason,
        processedAt: new Date(),
      },
    });

    // 2. Hoàn tiền lại ví cho Seller
    await this.prisma.user.update({
      where: { id: request.userId },
      data: {
        walletBalance: { increment: request.amount }
      }
    });

    // 3. Log giao dịch hoàn tiền
    await this.prisma.walletTransaction.create({
      data: {
        userId: request.userId,
        amount: request.amount,
        type: WalletTransactionType.REFUND,
        status: 'COMPLETED',
        referenceId: request.id,
        description: `Refund rejected payout #${request.id}: ${reason}`,
      }
    });

    return { success: true };
  }
}