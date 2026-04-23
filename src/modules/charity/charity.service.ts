import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CharityFundStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateFundDto, UpdateFundDto } from './dto/create-fund.dto';
import { DonateDto } from './dto/donate.dto';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

@Injectable()
export class CharityService {
  constructor(private prisma: PrismaService) {}

  // --- Public: đọc quỹ ---

  /**
   * List quỹ đang ACTIVE (mặc định) hoặc tất cả (nếu includeClosed=true).
   * Dùng cho cả trang /charity (user) và /admin/charity (admin xem nhiều filter hơn).
   */
  async listFunds(includeClosed = false) {
    return this.prisma.charityFund.findMany({
      where: includeClosed ? undefined : { status: CharityFundStatus.ACTIVE },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getFundBySlug(slug: string) {
    const fund = await this.prisma.charityFund.findUnique({ where: { slug } });
    if (!fund) throw new NotFoundException('Không tìm thấy quỹ');
    return fund;
  }

  async listDonationsForFund(fundId: string, limit = 20) {
    return this.prisma.donation.findMany({
      where: { fundId },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        // Ẩn identity nếu donation anonymous
        user: { select: { id: true, name: true, avatar: true } },
      },
    });
  }

  // --- Admin: CRUD quỹ ---

  async createFund(dto: CreateFundDto) {
    const baseSlug = slugify(dto.name);
    // Handle trùng slug bằng cách thêm suffix `-2`, `-3`...
    let slug = baseSlug;
    let attempt = 1;
    while (await this.prisma.charityFund.findUnique({ where: { slug } })) {
      attempt += 1;
      slug = `${baseSlug}-${attempt}`;
      if (attempt > 50) {
        throw new BadRequestException('Không tạo được slug duy nhất cho quỹ này');
      }
    }

    return this.prisma.charityFund.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        image: dto.image,
        goalAmount: dto.goalAmount ?? 0,
      },
    });
  }

  async updateFund(id: string, dto: UpdateFundDto) {
    const existing = await this.prisma.charityFund.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy quỹ');

    return this.prisma.charityFund.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        description: dto.description ?? existing.description,
        image: dto.image ?? existing.image,
        goalAmount: dto.goalAmount ?? existing.goalAmount,
        status: dto.status ?? existing.status,
      },
    });
  }

  // --- User: donate ---

  /**
   * Tạo Donation + bump currentAmount trong 1 transaction để snapshot
   * không drift khỏi SUM(Donation.amount) thực tế.
   *
   * userId=null cho donation ẩn danh hoặc guest (không login). Hiện
   * endpoint yêu cầu auth, nhưng service để mở để tương lai có guest flow.
   */
  async donate(userId: string | null, dto: DonateDto) {
    const fund = await this.prisma.charityFund.findUnique({
      where: { id: dto.fundId },
    });
    if (!fund) throw new NotFoundException('Quỹ không tồn tại');
    if (fund.status !== CharityFundStatus.ACTIVE) {
      throw new BadRequestException('Quỹ không nhận donation tại thời điểm này');
    }

    return this.prisma.$transaction(async (tx) => {
      const donation = await tx.donation.create({
        data: {
          fundId: dto.fundId,
          userId,
          amount: new Prisma.Decimal(dto.amount),
          note: dto.note,
          isAnonymous: dto.isAnonymous ?? false,
        },
      });

      await tx.charityFund.update({
        where: { id: dto.fundId },
        data: {
          currentAmount: { increment: new Prisma.Decimal(dto.amount) },
        },
      });

      return donation;
    });
  }
}
