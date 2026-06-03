import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CharityFundStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { SystemSettingService } from '../../common/services/system-setting.service';
import { CreateFundDto, UpdateFundDto } from './dto/create-fund.dto';
import { DonateDto } from './dto/donate.dto';
import { RedisService } from '../../database/redis/redis.service';

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
  private readonly logger = new Logger(CharityService.name);

  constructor(
    private prisma: PrismaService,
    private systemSetting: SystemSettingService,
    private redis: RedisService,
  ) {}

  // Wiki 0039: gọi sau mọi mutation fund để invalidate cache GET /charity/funds
  // (đặt @CacheTTL(30)). Trước fix: admin tạo fund mới → user thấy list cũ 30s.
  private async invalidateFundsCache() {
    try {
      await this.redis.delByPattern('charity:funds:*');
      await this.redis.delByPattern('charity:fund:slug:*');
    } catch (e) {
      this.logger.warn(`Failed to invalidate funds cache: ${(e as Error).message}`);
    }
  }

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

    const created = await this.prisma.charityFund.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        image: dto.image,
        goalAmount: dto.goalAmount ?? 0,
      },
    });
    await this.invalidateFundsCache();
    return created;
  }

  async updateFund(id: string, dto: UpdateFundDto) {
    const existing = await this.prisma.charityFund.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy quỹ');

    const updated = await this.prisma.charityFund.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        description: dto.description ?? existing.description,
        image: dto.image ?? existing.image,
        goalAmount: dto.goalAmount ?? existing.goalAmount,
        status: dto.status ?? existing.status,
      },
    });
    await this.invalidateFundsCache();
    return updated;
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

    const donation = await this.prisma.$transaction(async (tx) => {
      const d = await tx.donation.create({
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

      return d;
    });
    // currentAmount đã đổi → invalidate cache để list trả số mới ngay
    await this.invalidateFundsCache();
    return donation;
  }

  // ===========================================================================
  // AUTO-TRIGGER: trích 1% phí hoa hồng vào quỹ khi đơn DELIVERED
  // Spec [0018]:
  //   - Nguồn: phí hoa hồng sàn (commission), không phải doanh thu shop.
  //   - Tỷ lệ trích = CHARITY_COMMISSION_RATE (mặc định 1%).
  //   - Quỹ: campaign user chọn lúc checkout > quỹ primary.
  //   - Trích NGAY khi DELIVERED. Nếu đơn refund/cancel sau, rollback.
  //   - Idempotent qua `Donation.orderId @unique` — gọi 2 lần sẽ throw constraint.
  // ===========================================================================
  async processOrderDelivered(
    tx: Prisma.TransactionClient,
    params: {
      orderId: string;
      orderTotal: number;
      campaignFundId?: string;
    },
  ) {
    // 1. Read config từ SystemSetting
    const charityRate = await this.systemSetting.getNumber('CHARITY_COMMISSION_RATE', 0.01);

    // 2. Tính số tiền trích.
    // Wiki 0075: trích THẲNG orderTotal * charityRate. Công thức cũ nhân qua
    // (charityRate / commissionRate) = 0.01/0.05 = 0.19999…(lỗi dấu phẩy động) →
    // floor hụt 1đ (vd total 153.400: đúng 1.534, cũ ra 1.533 → quỹ thiếu so với 1%).
    // Note gốc đã xác nhận 2 cách tương đương; chọn cách trực tiếp để khỏi sai số.
    const donationAmount = Math.floor(params.orderTotal * charityRate);

    if (donationAmount <= 0) return null;

    // 3. Chọn quỹ: campaign nếu có, không thì primary
    let fundId = params.campaignFundId;
    if (!fundId) {
      const primary = await tx.charityFund.findFirst({
        where: { isPrimary: true, status: 'ACTIVE' },
      });
      if (!primary) {
        this.logger.warn(`[Charity] Không có quỹ primary để nhận đóng góp đơn ${params.orderId}`);
        return null;
      }
      fundId = primary.id;
    }

    // 4. Idempotent check (Donation.orderId @unique handle, nhưng skip sớm tránh constraint error)
    const existing = await tx.donation.findUnique({ where: { orderId: params.orderId } });
    if (existing) return existing;

    // 5. Tạo donation + bump fund.currentAmount
    const donation = await tx.donation.create({
      data: {
        fundId,
        orderId: params.orderId,
        amount: new Prisma.Decimal(donationAmount),
        note: 'Đóng góp tự động từ đơn hàng',
      },
    });
    await tx.charityFund.update({
      where: { id: fundId },
      data: { currentAmount: { increment: new Prisma.Decimal(donationAmount) } },
    });

    this.logger.log(`[Charity] Auto-trích ${donationAmount}đ từ đơn ${params.orderId} vào quỹ ${fundId}`);
    return donation;
  }

  // ===========================================================================
  // CAMPAIGN — Spec [0018]: nhóm nhiều quỹ chạy song song trong khoảng thời gian.
  // Khi user checkout, được chọn 1 campaign đang ACTIVE để đóng góp; không
  // chọn -> primary fund (xem processOrderDelivered).
  // ===========================================================================

  async listCampaigns(includeInactive = false) {
    return this.prisma.charityCampaign.findMany({
      where: includeInactive ? undefined : { isActive: true },
      include: { funds: { include: { fund: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listActiveCampaignsForCheckout() {
    const now = new Date();
    return this.prisma.charityCampaign.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      include: { funds: { include: { fund: true } } },
      orderBy: { endDate: 'asc' },
    });
  }

  async createCampaign(dto: {
    name: string;
    description?: string;
    banner?: string;
    startDate: string;
    endDate: string;
    fundIds?: string[];
  }) {
    const baseSlug = slugify(dto.name);
    let slug = baseSlug;
    let attempt = 1;
    while (await this.prisma.charityCampaign.findUnique({ where: { slug } })) {
      attempt += 1;
      slug = `${baseSlug}-${attempt}`;
      if (attempt > 50) throw new BadRequestException('Không tạo được slug duy nhất');
    }

    return this.prisma.charityCampaign.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        banner: dto.banner,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        funds: dto.fundIds && dto.fundIds.length > 0
          ? { create: dto.fundIds.map(fid => ({ fundId: fid })) }
          : undefined,
      },
      include: { funds: { include: { fund: true } } },
    });
  }

  async updateCampaign(id: string, dto: any) {
    const existing = await this.prisma.charityCampaign.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy campaign');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.charityCampaign.update({
        where: { id },
        data: {
          name: dto.name ?? existing.name,
          description: dto.description ?? existing.description,
          banner: dto.banner ?? existing.banner,
          startDate: dto.startDate ? new Date(dto.startDate) : existing.startDate,
          endDate: dto.endDate ? new Date(dto.endDate) : existing.endDate,
          isActive: dto.isActive ?? existing.isActive,
        },
      });

      // Sync fundIds nếu gửi lên
      if (Array.isArray(dto.fundIds)) {
        await tx.charityCampaignFund.deleteMany({ where: { campaignId: id } });
        if (dto.fundIds.length > 0) {
          await tx.charityCampaignFund.createMany({
            data: dto.fundIds.map((fid: string) => ({ campaignId: id, fundId: fid })),
          });
        }
      }

      return tx.charityCampaign.findUnique({
        where: { id },
        include: { funds: { include: { fund: true } } },
      });
    });
  }

  async deleteCampaign(id: string) {
    const existing = await this.prisma.charityCampaign.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy campaign');
    // FK CharityCampaignFund onDelete:Cascade — Donation không liên kết Campaign trực tiếp,
    // nên xóa campaign không ảnh hưởng lịch sử donation.
    return this.prisma.charityCampaign.delete({ where: { id } });
  }

  /**
   * Rollback donation khi đơn bị cancel/refund sau khi đã trích.
   */
  async rollbackOrderDonation(tx: Prisma.TransactionClient, orderId: string) {
    const donation = await tx.donation.findUnique({ where: { orderId } });
    if (!donation) return null;

    await tx.charityFund.update({
      where: { id: donation.fundId },
      data: { currentAmount: { decrement: donation.amount } },
    });
    await tx.donation.delete({ where: { id: donation.id } });

    this.logger.log(`[Charity] Rollback donation ${donation.id} do đơn ${orderId} bị refund/cancel`);
    return donation;
  }
}
