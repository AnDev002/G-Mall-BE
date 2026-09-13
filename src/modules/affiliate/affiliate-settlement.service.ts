import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { SystemSettingService } from '../../common/services/system-setting.service';
import { NotificationService } from '../notification/notification.service';

/** 'YYYY-MM' của tháng liền trước mốc `at`. */
function previousPeriod(at: Date): string {
  const d = new Date(at.getFullYear(), at.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Ngày đầu tháng chứa `at`, 00:00:00 — mốc chặn trên khi quét hoa hồng. */
function startOfMonth(at: Date): Date {
  return new Date(at.getFullYear(), at.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * wiki 0105 — CHỐT SỔ hoa hồng theo kỳ tháng.
 *
 * Khách yêu cầu: *"vào ngày xx hàng tháng thì tính lại, dashboard lại. Như thế cho chắc
 * chắn. Lúc đó mới là hoa hồng thật."*
 *
 * Vì sao không cộng thẳng vào ví lúc giao hàng: cộng tức thì nghĩa là kẻ gian có thể
 * rút tiền trước khi ai kịp phát hiện. Chốt theo kỳ biến việc chống gian lận từ "phải
 * bắt được ngay lập tức" thành "có cả tháng để rà" — an toàn hơn hẳn mà chỉ tốn thêm
 * một tác vụ định kỳ.
 */
@Injectable()
export class AffiliateSettlementService {
  private readonly logger = new Logger(AffiliateSettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemSetting: SystemSettingService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Chạy 02:00 MỖI NGÀY rồi tự kiểm hôm nay có phải ngày chốt không.
   *
   * Cố ý KHÔNG đặt lịch cron thẳng vào ngày N: `AFFILIATE_SETTLEMENT_DAY` nằm trong
   * SystemSetting để ban điều hành đổi được mà không cần deploy, còn biểu thức cron thì
   * cố định lúc khởi động. Quét hằng ngày + so ngày trong hàm là cách duy nhất để cấu
   * hình có hiệu lực ngay.
   *
   * Ngoài ra nếu máy chết đúng ngày chốt, hôm sau vẫn còn cơ hội — xem `runSettlement`:
   * điều kiện quét là "mọi khoản đã giao trước đầu tháng này", không phải "đúng tháng
   * trước", nên chạy trễ vẫn gom đủ.
   */
  @Cron('0 2 * * *', { name: 'affiliate-settlement' })
  async scheduledSettlement() {
    const day = await this.systemSetting.getNumber('AFFILIATE_SETTLEMENT_DAY', 5);
    const today = new Date().getDate();
    if (today !== Math.max(1, Math.min(28, Math.floor(day)))) return;

    this.logger.log('[Affiliate] tới ngày chốt sổ — bắt đầu chạy');
    try {
      const res = await this.runSettlement();
      this.logger.log(
        `[Affiliate] chốt sổ kỳ ${res.period}: ${res.accounts} người, ${res.items} khoản, tổng ${res.total}đ`,
      );
    } catch (e: any) {
      this.logger.error(`[Affiliate] chốt sổ THẤT BẠI: ${e?.message}`);
    }
  }

  /**
   * Chốt sổ. IDEMPOTENT — chạy lại vô hại nhờ `AffiliateSettlement @@unique([accountId, period])`.
   * Vừa là đích của tác vụ định kỳ, vừa là đích của nút bấm tay bên admin: nếu tác vụ nền
   * chết thì vẫn còn đường chốt, và bấm nhầm hai lần cũng không cộng tiền hai lần.
   */
  async runSettlement(now: Date = new Date()) {
    const period = previousPeriod(now);
    // QUAN TRỌNG: quét theo "đã giao TRƯỚC đầu tháng hiện tại" chứ KHÔNG phải "nằm đúng
    // trong tháng trước". Nếu tác vụ từng chạy hỏng vài tháng, những khoản cũ vẫn được
    // gom vào kỳ gần nhất thay vì nằm lại APPROVED vĩnh viễn. Đây là lỗi cực khó phát
    // hiện: không ai đi khiếu nại một khoản tiền mà họ không biết là mình có.
    const cutoff = startOfMonth(now);

    const pending = await this.prisma.affiliateCommission.findMany({
      where: { status: 'APPROVED', deliveredAt: { lt: cutoff } },
      select: { id: true, accountId: true, amount: true, orderId: true },
    });
    if (pending.length === 0) {
      return { period, accounts: 0, items: 0, total: 0, settlements: [] as any[] };
    }

    // Rà lại lần cuối: đơn đã huỷ sau khi giao (khiếu nại/hoàn) không được trả hoa hồng.
    const orderIds = [...new Set(pending.map((p) => p.orderId))];
    const cancelled = await this.prisma.order.findMany({
      where: { id: { in: orderIds }, status: 'CANCELLED' },
      select: { id: true },
    });
    const cancelledSet = new Set(cancelled.map((o) => o.id));

    const valid = pending.filter((p) => !cancelledSet.has(p.orderId));
    const dropped = pending.filter((p) => cancelledSet.has(p.orderId));
    if (dropped.length > 0) {
      await this.prisma.affiliateCommission.updateMany({
        where: { id: { in: dropped.map((d) => d.id) } },
        data: { status: 'CANCELLED', rejectReason: 'Đơn hàng đã huỷ trước kỳ chốt sổ' },
      });
      this.logger.warn(`[Affiliate] loại ${dropped.length} khoản của đơn đã huỷ khỏi kỳ ${period}`);
    }

    const byAccount = new Map<string, { ids: string[]; total: number }>();
    for (const c of valid) {
      const cur = byAccount.get(c.accountId) ?? { ids: [], total: 0 };
      cur.ids.push(c.id);
      cur.total += Number(c.amount);
      byAccount.set(c.accountId, cur);
    }

    const settlements: { accountId: string; amount: number; itemCount: number; skipped?: boolean }[] = [];
    let grandTotal = 0;
    let itemCount = 0;

    for (const [accountId, agg] of byAccount) {
      if (agg.total <= 0) continue;
      try {
        const done = await this.settleOneAccount(accountId, period, agg.ids, agg.total);
        settlements.push(done);
        if (!done.skipped) {
          grandTotal += done.amount;
          itemCount += done.itemCount;
        }
      } catch (e: any) {
        // Một người lỗi KHÔNG được kéo đổ cả kỳ — những người khác vẫn phải nhận tiền.
        this.logger.error(`[Affiliate] chốt sổ lỗi cho account=${accountId}: ${e?.message}`);
      }
    }

    return { period, accounts: settlements.filter((s) => !s.skipped).length, items: itemCount, total: grandTotal, settlements };
  }

  /** Chốt sổ cho MỘT người, trong một transaction riêng. */
  private async settleOneAccount(
    accountId: string,
    period: string,
    commissionIds: string[],
    total: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Khoá idempotent ở TẦNG DB. Chạy lại lần hai → unique violation → bắt và bỏ qua,
      // KHÔNG cộng ví lần nữa. An toàn nằm ở schema chứ không nằm ở sự cẩn thận của code.
      const existed = await tx.affiliateSettlement.findUnique({
        where: { accountId_period: { accountId, period } },
      });
      if (existed) {
        return { accountId, amount: Number(existed.amount), itemCount: existed.itemCount, skipped: true };
      }

      const account = await tx.affiliateAccount.findUnique({
        where: { id: accountId },
        select: { userId: true, status: true },
      });
      if (!account) throw new Error('Không tìm thấy hồ sơ tiếp thị');

      // Bị đình chỉ thì KHÔNG giải ngân — nhưng cũng không xoá sổ: giữ nguyên APPROVED
      // để nếu sau này được gỡ đình chỉ thì kỳ sau vẫn nhận được.
      if (account.status === 'SUSPENDED') {
        return { accountId, amount: 0, itemCount: 0, skipped: true };
      }

      const settlement = await tx.affiliateSettlement.create({
        data: {
          accountId,
          period,
          amount: new Prisma.Decimal(total),
          itemCount: commissionIds.length,
        },
      });

      // Chỉ đổi những dòng CÒN Ở APPROVED — chặn cửa sổ TOCTOU nếu có tiến trình khác
      // vừa huỷ/chốt chúng giữa lúc đọc và ghi.
      const moved = await tx.affiliateCommission.updateMany({
        where: { id: { in: commissionIds }, status: 'APPROVED' },
        data: { status: 'SETTLED', settlementId: settlement.id },
      });

      await tx.user.update({
        where: { id: account.userId },
        data: { walletBalance: { increment: total } },
      });
      await tx.walletTransaction.create({
        data: {
          userId: account.userId,
          amount: new Prisma.Decimal(total),
          type: 'AFFILIATE_COMMISSION',
          status: 'COMPLETED',
          referenceId: settlement.id,
          description: `Hoa hồng tiếp thị kỳ ${period}`,
        },
      });

      try {
        await this.notificationService.create(
          {
            userId: account.userId,
            type: 'SYSTEM',
            title: 'Hoa hồng tiếp thị đã được chốt',
            content: `Kỳ ${period}: ${total.toLocaleString('vi-VN')}đ đã vào ví của bạn và có thể rút.`,
            link: '/user/affiliate',
          },
          tx,
        );
      } catch (e: any) {
        // Không để lỗi thông báo cuốn ngược việc trả tiền.
        this.logger.warn(`[Affiliate] gửi thông báo chốt sổ lỗi: ${e?.message}`);
      }

      return { accountId, amount: total, itemCount: moved.count };
    }, { timeout: 20000, maxWait: 5000 });
  }

  /** Các kỳ đã chốt của một người tiếp thị. */
  async listMySettlements(userId: string) {
    const account = await this.prisma.affiliateAccount.findUnique({ where: { userId } });
    if (!account) return [];
    const rows = await this.prisma.affiliateSettlement.findMany({
      where: { accountId: account.id },
      orderBy: { period: 'desc' },
      take: 24,
    });
    return rows.map((r) => ({
      id: r.id,
      period: r.period,
      amount: Number(r.amount),
      itemCount: r.itemCount,
      settledAt: r.settledAt,
    }));
  }

  /** Admin bấm chốt tay. Cùng một hàm idempotent với tác vụ định kỳ. */
  async settleNow() {
    return this.runSettlement();
  }

  /** Ngày chốt sổ đang cấu hình — FE hiện cho người tiếp thị biết khi nào có tiền. */
  async getSettlementDay(): Promise<number> {
    const raw = await this.systemSetting.getNumber('AFFILIATE_SETTLEMENT_DAY', 5);
    return Math.max(1, Math.min(28, Math.floor(raw)));
  }
}
