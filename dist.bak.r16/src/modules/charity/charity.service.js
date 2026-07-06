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
var CharityService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CharityService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const system_setting_service_1 = require("../../common/services/system-setting.service");
const redis_service_1 = require("../../database/redis/redis.service");
function slugify(s) {
    return s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}
let CharityService = CharityService_1 = class CharityService {
    prisma;
    systemSetting;
    redis;
    logger = new common_1.Logger(CharityService_1.name);
    constructor(prisma, systemSetting, redis) {
        this.prisma = prisma;
        this.systemSetting = systemSetting;
        this.redis = redis;
    }
    async invalidateFundsCache() {
        try {
            await this.redis.delByPattern('charity:funds:*');
            await this.redis.delByPattern('charity:fund:slug:*');
        }
        catch (e) {
            this.logger.warn(`Failed to invalidate funds cache: ${e.message}`);
        }
    }
    async listFunds(includeClosed = false) {
        return this.prisma.charityFund.findMany({
            where: includeClosed ? undefined : { status: client_1.CharityFundStatus.ACTIVE },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getFundBySlug(slug) {
        const fund = await this.prisma.charityFund.findUnique({ where: { slug } });
        if (!fund)
            throw new common_1.NotFoundException('Không tìm thấy quỹ');
        return fund;
    }
    async listDonationsForFund(fundId, limit = 20) {
        return this.prisma.donation.findMany({
            where: { fundId },
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { id: true, name: true, avatar: true } },
            },
        });
    }
    async createFund(dto) {
        const baseSlug = slugify(dto.name);
        let slug = baseSlug;
        let attempt = 1;
        while (await this.prisma.charityFund.findUnique({ where: { slug } })) {
            attempt += 1;
            slug = `${baseSlug}-${attempt}`;
            if (attempt > 50) {
                throw new common_1.BadRequestException('Không tạo được slug duy nhất cho quỹ này');
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
    async updateFund(id, dto) {
        const existing = await this.prisma.charityFund.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException('Không tìm thấy quỹ');
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
    async donate(userId, dto) {
        const fund = await this.prisma.charityFund.findUnique({
            where: { id: dto.fundId },
        });
        if (!fund)
            throw new common_1.NotFoundException('Quỹ không tồn tại');
        if (fund.status !== client_1.CharityFundStatus.ACTIVE) {
            throw new common_1.BadRequestException('Quỹ không nhận donation tại thời điểm này');
        }
        const donation = await this.prisma.$transaction(async (tx) => {
            const d = await tx.donation.create({
                data: {
                    fundId: dto.fundId,
                    userId,
                    amount: new client_1.Prisma.Decimal(dto.amount),
                    note: dto.note,
                    isAnonymous: dto.isAnonymous ?? false,
                },
            });
            await tx.charityFund.update({
                where: { id: dto.fundId },
                data: {
                    currentAmount: { increment: new client_1.Prisma.Decimal(dto.amount) },
                },
            });
            return d;
        });
        await this.invalidateFundsCache();
        return donation;
    }
    async processOrderDelivered(tx, params) {
        const charityRate = await this.systemSetting.getNumber('CHARITY_COMMISSION_RATE', 0.01);
        const donationAmount = Math.floor(params.orderTotal * charityRate);
        if (donationAmount <= 0)
            return null;
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
        const existing = await tx.donation.findUnique({ where: { orderId: params.orderId } });
        if (existing)
            return existing;
        const donation = await tx.donation.create({
            data: {
                fundId,
                orderId: params.orderId,
                amount: new client_1.Prisma.Decimal(donationAmount),
                note: 'Đóng góp tự động từ đơn hàng',
            },
        });
        await tx.charityFund.update({
            where: { id: fundId },
            data: { currentAmount: { increment: new client_1.Prisma.Decimal(donationAmount) } },
        });
        this.logger.log(`[Charity] Auto-trích ${donationAmount}đ từ đơn ${params.orderId} vào quỹ ${fundId}`);
        return donation;
    }
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
    async createCampaign(dto) {
        const baseSlug = slugify(dto.name);
        let slug = baseSlug;
        let attempt = 1;
        while (await this.prisma.charityCampaign.findUnique({ where: { slug } })) {
            attempt += 1;
            slug = `${baseSlug}-${attempt}`;
            if (attempt > 50)
                throw new common_1.BadRequestException('Không tạo được slug duy nhất');
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
    async updateCampaign(id, dto) {
        const existing = await this.prisma.charityCampaign.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException('Không tìm thấy campaign');
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
            if (Array.isArray(dto.fundIds)) {
                await tx.charityCampaignFund.deleteMany({ where: { campaignId: id } });
                if (dto.fundIds.length > 0) {
                    await tx.charityCampaignFund.createMany({
                        data: dto.fundIds.map((fid) => ({ campaignId: id, fundId: fid })),
                    });
                }
            }
            return tx.charityCampaign.findUnique({
                where: { id },
                include: { funds: { include: { fund: true } } },
            });
        });
    }
    async deleteCampaign(id) {
        const existing = await this.prisma.charityCampaign.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException('Không tìm thấy campaign');
        return this.prisma.charityCampaign.delete({ where: { id } });
    }
    async rollbackOrderDonation(tx, orderId) {
        const donation = await tx.donation.findUnique({ where: { orderId } });
        if (!donation)
            return null;
        await tx.charityFund.update({
            where: { id: donation.fundId },
            data: { currentAmount: { decrement: donation.amount } },
        });
        await tx.donation.delete({ where: { id: donation.id } });
        this.logger.log(`[Charity] Rollback donation ${donation.id} do đơn ${orderId} bị refund/cancel`);
        return donation;
    }
};
exports.CharityService = CharityService;
exports.CharityService = CharityService = CharityService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        system_setting_service_1.SystemSettingService,
        redis_service_1.RedisService])
], CharityService);
//# sourceMappingURL=charity.service.js.map