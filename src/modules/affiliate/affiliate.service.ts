import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RegisterAffiliateDto } from './dto/register-affiliate.dto';

/**
 * wiki 0105 — hồ sơ NGƯỜI TIẾP THỊ (affiliate sản phẩm).
 *
 * KHÔNG liên quan tới `PointService.getAffiliateStats` (hệ referral cũ, thưởng xu khi
 * giới thiệu NGƯỜI). Hai hệ chạy song song và cố ý tách rời: referral gắn vào người
 * (1-1 vĩnh viễn), affiliate gắn vào giao dịch (n-n, lặp vô hạn).
 */
@Injectable()
export class AffiliateService {
  private readonly logger = new Logger(AffiliateService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sinh mã người tiếp thị.
   *
   * Có vòng thử lại vì `code` là UNIQUE ở tầng DB — xác suất trùng cực thấp nhưng nếu
   * trùng mà không thử lại thì user nhận 500 không hiểu vì sao. Thà thử 5 lần rồi báo
   * lỗi tử tế còn hơn để cột UNIQUE ném ra lỗi thô.
   */
  private async generateCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = 'AF' + Math.random().toString(36).slice(2, 9).toUpperCase();
      const dup = await this.prisma.affiliateAccount.findUnique({ where: { code } });
      if (!dup) return code;
    }
    throw new InternalServerErrorException('Không tạo được mã tiếp thị, vui lòng thử lại.');
  }

  async register(userId: string, dto: RegisterAffiliateDto) {
    const existing = await this.prisma.affiliateAccount.findUnique({ where: { userId } });

    if (existing) {
      // Bị từ chối thì cho nộp lại. Nếu chặn vĩnh viễn, một lần bị từ chối là user hết
      // đường bổ sung thông tin — mà lý do từ chối thường chỉ là khai thiếu.
      if (existing.status === 'REJECTED') {
        const updated = await this.prisma.affiliateAccount.update({
          where: { userId },
          data: {
            status: 'PENDING',
            channel: dto.channel ?? null,
            note: dto.note ?? null,
            rejectReason: null,
            reviewedAt: null,
            reviewedById: null,
          },
        });
        return { status: updated.status, code: updated.code };
      }

      throw new BadRequestException(
        existing.status === 'SUSPENDED'
          ? 'Tài khoản tiếp thị của bạn đang bị đình chỉ.'
          : 'Bạn đã đăng ký chương trình tiếp thị rồi.',
      );
    }

    const created = await this.prisma.affiliateAccount.create({
      data: {
        userId,
        code: await this.generateCode(),
        channel: dto.channel ?? null,
        note: dto.note ?? null,
      },
    });
    this.logger.log(`[Affiliate] hồ sơ mới ${created.code} của user ${userId.slice(0, 8)}`);
    return { status: created.status, code: created.code };
  }

  /**
   * Trả `registered: false` thay vì ném 404 khi chưa đăng ký.
   *
   * "Chưa đăng ký" là trạng thái hợp lệ chứ không phải lỗi — FE dùng chính lời đáp này
   * để quyết định hiện form đăng ký hay hiện bảng điều khiển. Ném 404 sẽ buộc FE bắt
   * lỗi để suy ra trạng thái bình thường, và mọi log lỗi sẽ đầy 404 vô hại.
   */
  async getMe(userId: string) {
    const account = await this.prisma.affiliateAccount.findUnique({ where: { userId } });
    if (!account) return { registered: false, status: null };

    const [grouped, user, clickAgg] = await Promise.all([
      // TIỀN LUÔN CỘNG TỪ SỔ CÁI. Không có cột tổng nào để đọc — số dư denormalize là
      // nguồn drift kinh điển: một nhánh quên cập nhật là sổ lệch vĩnh viễn.
      this.prisma.affiliateCommission.groupBy({
        by: ['status'],
        where: { accountId: account.id },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { walletBalance: true } }),
      this.prisma.affiliateLink.aggregate({
        where: { accountId: account.id },
        _sum: { clicks: true },
        _count: { _all: true },
      }),
    ]);

    const sumOf = (s: string) =>
      Number(grouped.find((g) => g.status === s)?._sum.amount ?? 0);
    const countOf = (s: string) =>
      Number(grouped.find((g) => g.status === s)?._count._all ?? 0);

    return {
      registered: true,
      status: account.status,
      code: account.code,
      channel: account.channel,
      rejectReason: account.rejectReason,
      createdAt: account.createdAt,
      reviewedAt: account.reviewedAt,

      totalClicks: Number(clickAgg._sum.clicks ?? 0),
      totalLinks: clickAgg._count._all,
      totalOrders: countOf('PENDING') + countOf('APPROVED') + countOf('SETTLED'),

      // Ba con số hiển thị, hai trạng thái tiền: chưa rút được / rút được.
      balance: {
        // "Khách chưa nhận hàng" — đơn còn có thể huỷ.
        waitingDelivery: sumOf('PENDING'),
        // "Đã chắc, đợi tới kỳ chốt sổ" — sàn đang giữ.
        provisional: sumOf('APPROVED'),
        // "Hoa hồng thật" — đã chốt sổ, nằm trong ví, rút được.
        available: Number(user?.walletBalance ?? 0),
        settledLifetime: sumOf('SETTLED'),
      },
    };
  }

  /** Sổ hoa hồng chi tiết, lọc theo trạng thái. */
  async getCommissions(userId: string, status?: string, rawPage?: string) {
    const account = await this.prisma.affiliateAccount.findUnique({ where: { userId } });
    if (!account) return { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } };

    const page = Math.max(1, Number(rawPage) || 1);
    const limit = 20;
    const valid = ['PENDING', 'APPROVED', 'SETTLED', 'CANCELLED', 'REJECTED'];

    const where: any = { accountId: account.id };
    if (status && status !== 'ALL') {
      if (!valid.includes(status)) {
        throw new BadRequestException('Trạng thái lọc không hợp lệ.');
      }
      where.status = status;
    }

    const [rows, total] = await Promise.all([
      this.prisma.affiliateCommission.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { link: { select: { code: true } } },
      }),
      this.prisma.affiliateCommission.count({ where }),
    ]);

    const productIds = [...new Set(rows.map((r) => r.productId))];
    const products = productIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true, images: true },
        })
      : [];
    const productById = new Map(products.map((p) => [p.id, p]));

    return {
      data: rows.map((r) => {
        const p = productById.get(r.productId);
        return {
          id: r.id,
          orderId: r.orderId,
          status: r.status,
          // Decimal → Number: Prisma serialize Decimal thành CHUỖI, FE mất dấu phân
          // cách và phép cộng thành nối chuỗi (bug đã gặp ở wiki 0103).
          baseAmount: Number(r.baseAmount),
          rate: Number(r.rate),
          amount: Number(r.amount),
          rejectReason: r.rejectReason,
          deliveredAt: r.deliveredAt,
          createdAt: r.createdAt,
          linkCode: r.link?.code ?? null,
          product: {
            id: r.productId,
            name: p?.name ?? '(sản phẩm đã bị gỡ)',
            image: Array.isArray(p?.images) ? (p!.images as any)[0] ?? null : null,
          },
        };
      }),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Ném lỗi nếu user chưa phải người tiếp thị ĐÃ DUYỆT.
   *
   * Dùng làm cổng chặn cho những hành động chỉ dành cho người tiếp thị — đặc biệt là
   * RÚT TIỀN: không có chốt này thì `/affiliate/payout` trở thành cổng rút tiền mở cho
   * mọi tài khoản đã đăng nhập.
   */
  async requireApprovedAffiliate(userId: string) {
    const account = await this.prisma.affiliateAccount.findUnique({ where: { userId } });
    if (!account || account.status !== 'APPROVED') {
      throw new ForbiddenException('Bạn chưa phải người tiếp thị đã được duyệt.');
    }
    return account;
  }
}
