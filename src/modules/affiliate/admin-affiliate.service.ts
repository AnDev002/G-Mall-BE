import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AffiliateAccountStatus, Prisma } from '@prisma/client';
import { ReviewAffiliateDto } from './dto/review-affiliate.dto';

const PAGE_SIZE = 20;
const VALID_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'];

/**
 * wiki 0105 — duyệt hồ sơ tiếp thị.
 *
 * Tách khỏi `AffiliateService` vì hai file phục vụ hai vai khác nhau và sẽ phình theo
 * hai hướng khác nhau: bên người tiếp thị sắp có link/hoa hồng (GĐ2–3), bên admin sắp
 * có đối soát/chốt sổ (GĐ4). Gộp chung thì mỗi lần sửa phải đọc cả nửa không liên quan.
 */
@Injectable()
export class AdminAffiliateService {
  constructor(private readonly prisma: PrismaService) {}

  async listAccounts(status?: string, rawPage?: string) {
    // Trang âm/rác → skip âm → Prisma ném 500. Kẹp lại như các màn admin khác (wiki 0074).
    const page = Math.max(1, Number(rawPage) || 1);

    const where: Prisma.AffiliateAccountWhereInput = {};
    if (status && status !== 'ALL') {
      if (!VALID_STATUSES.includes(status)) {
        throw new BadRequestException('Trạng thái lọc không hợp lệ.');
      }
      where.status = status as AffiliateAccountStatus;
    }

    const [rows, total] = await Promise.all([
      this.prisma.affiliateAccount.findMany({
        where,
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true, name: true, phone: true } } },
      }),
      this.prisma.affiliateAccount.count({ where }),
    ]);

    return {
      data: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        email: r.user?.email ?? null,
        name: r.user?.name ?? null,
        phone: r.user?.phone ?? null,
        code: r.code,
        status: r.status,
        channel: r.channel,
        note: r.note,
        rejectReason: r.rejectReason,
        createdAt: r.createdAt,
        reviewedAt: r.reviewedAt,
      })),
      meta: { page, limit: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) },
    };
  }

  async review(adminId: string, id: string, dto: ReviewAffiliateDto) {
    const account = await this.prisma.affiliateAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('Không tìm thấy hồ sơ tiếp thị.');

    // Từ chối/đình chỉ mà không nêu lý do thì người dùng không biết phải sửa gì, và bộ
    // phận hỗ trợ không có căn cứ trả lời khi họ khiếu nại. Bắt buộc ở tầng service chứ
    // không phải chỉ ở giao diện — giao diện bỏ qua được, service thì không.
    if (dto.status !== 'APPROVED' && !dto.rejectReason?.trim()) {
      throw new BadRequestException('Cần nêu lý do khi từ chối hoặc đình chỉ.');
    }

    const updated = await this.prisma.affiliateAccount.update({
      where: { id },
      data: {
        status: dto.status as AffiliateAccountStatus,
        rejectReason: dto.status === 'APPROVED' ? null : dto.rejectReason!.trim(),
        reviewedAt: new Date(),
        reviewedById: adminId,
      },
    });

    return { id: updated.id, status: updated.status, code: updated.code };
  }
}
