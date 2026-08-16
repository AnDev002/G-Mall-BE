import {
  BadRequestException,
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

    return {
      registered: true,
      status: account.status,
      code: account.code,
      channel: account.channel,
      rejectReason: account.rejectReason,
      totalClicks: account.totalClicks,
      totalOrders: account.totalOrders,
      createdAt: account.createdAt,
      reviewedAt: account.reviewedAt,
    };
  }
}
