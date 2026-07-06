import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { SystemSettingService } from '../../common/services/system-setting.service';
import { CreateFundDto, UpdateFundDto } from './dto/create-fund.dto';
import { DonateDto } from './dto/donate.dto';
import { RedisService } from '../../database/redis/redis.service';
export declare class CharityService {
    private prisma;
    private systemSetting;
    private redis;
    private readonly logger;
    constructor(prisma: PrismaService, systemSetting: SystemSettingService, redis: RedisService);
    private invalidateFundsCache;
    listFunds(includeClosed?: boolean): Promise<{
        id: string;
        name: string;
        slug: string;
        description: string | null;
        image: string | null;
        goalAmount: Prisma.Decimal;
        currentAmount: Prisma.Decimal;
        status: import("@prisma/client").$Enums.CharityFundStatus;
        isPrimary: boolean;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    getFundBySlug(slug: string): Promise<{
        id: string;
        name: string;
        slug: string;
        description: string | null;
        image: string | null;
        goalAmount: Prisma.Decimal;
        currentAmount: Prisma.Decimal;
        status: import("@prisma/client").$Enums.CharityFundStatus;
        isPrimary: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    listDonationsForFund(fundId: string, limit?: number): Promise<({
        user: {
            id: string;
            name: string | null;
            avatar: string | null;
        } | null;
    } & {
        id: string;
        fundId: string;
        userId: string | null;
        orderId: string | null;
        amount: Prisma.Decimal;
        note: string | null;
        isAnonymous: boolean;
        createdAt: Date;
    })[]>;
    createFund(dto: CreateFundDto): Promise<{
        id: string;
        name: string;
        slug: string;
        description: string | null;
        image: string | null;
        goalAmount: Prisma.Decimal;
        currentAmount: Prisma.Decimal;
        status: import("@prisma/client").$Enums.CharityFundStatus;
        isPrimary: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    updateFund(id: string, dto: UpdateFundDto): Promise<{
        id: string;
        name: string;
        slug: string;
        description: string | null;
        image: string | null;
        goalAmount: Prisma.Decimal;
        currentAmount: Prisma.Decimal;
        status: import("@prisma/client").$Enums.CharityFundStatus;
        isPrimary: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    donate(userId: string | null, dto: DonateDto): Promise<{
        id: string;
        fundId: string;
        userId: string | null;
        orderId: string | null;
        amount: Prisma.Decimal;
        note: string | null;
        isAnonymous: boolean;
        createdAt: Date;
    }>;
    processOrderDelivered(tx: Prisma.TransactionClient, params: {
        orderId: string;
        orderTotal: number;
        campaignFundId?: string;
    }): Promise<{
        id: string;
        fundId: string;
        userId: string | null;
        orderId: string | null;
        amount: Prisma.Decimal;
        note: string | null;
        isAnonymous: boolean;
        createdAt: Date;
    } | null>;
    listCampaigns(includeInactive?: boolean): Promise<({
        funds: ({
            fund: {
                id: string;
                name: string;
                slug: string;
                description: string | null;
                image: string | null;
                goalAmount: Prisma.Decimal;
                currentAmount: Prisma.Decimal;
                status: import("@prisma/client").$Enums.CharityFundStatus;
                isPrimary: boolean;
                createdAt: Date;
                updatedAt: Date;
            };
        } & {
            campaignId: string;
            fundId: string;
        })[];
    } & {
        id: string;
        name: string;
        slug: string;
        description: string | null;
        banner: string | null;
        startDate: Date;
        endDate: Date;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    listActiveCampaignsForCheckout(): Promise<({
        funds: ({
            fund: {
                id: string;
                name: string;
                slug: string;
                description: string | null;
                image: string | null;
                goalAmount: Prisma.Decimal;
                currentAmount: Prisma.Decimal;
                status: import("@prisma/client").$Enums.CharityFundStatus;
                isPrimary: boolean;
                createdAt: Date;
                updatedAt: Date;
            };
        } & {
            campaignId: string;
            fundId: string;
        })[];
    } & {
        id: string;
        name: string;
        slug: string;
        description: string | null;
        banner: string | null;
        startDate: Date;
        endDate: Date;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    createCampaign(dto: {
        name: string;
        description?: string;
        banner?: string;
        startDate: string;
        endDate: string;
        fundIds?: string[];
    }): Promise<{
        funds: ({
            fund: {
                id: string;
                name: string;
                slug: string;
                description: string | null;
                image: string | null;
                goalAmount: Prisma.Decimal;
                currentAmount: Prisma.Decimal;
                status: import("@prisma/client").$Enums.CharityFundStatus;
                isPrimary: boolean;
                createdAt: Date;
                updatedAt: Date;
            };
        } & {
            campaignId: string;
            fundId: string;
        })[];
    } & {
        id: string;
        name: string;
        slug: string;
        description: string | null;
        banner: string | null;
        startDate: Date;
        endDate: Date;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    updateCampaign(id: string, dto: any): Promise<({
        funds: ({
            fund: {
                id: string;
                name: string;
                slug: string;
                description: string | null;
                image: string | null;
                goalAmount: Prisma.Decimal;
                currentAmount: Prisma.Decimal;
                status: import("@prisma/client").$Enums.CharityFundStatus;
                isPrimary: boolean;
                createdAt: Date;
                updatedAt: Date;
            };
        } & {
            campaignId: string;
            fundId: string;
        })[];
    } & {
        id: string;
        name: string;
        slug: string;
        description: string | null;
        banner: string | null;
        startDate: Date;
        endDate: Date;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }) | null>;
    deleteCampaign(id: string): Promise<{
        id: string;
        name: string;
        slug: string;
        description: string | null;
        banner: string | null;
        startDate: Date;
        endDate: Date;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    rollbackOrderDonation(tx: Prisma.TransactionClient, orderId: string): Promise<{
        id: string;
        fundId: string;
        userId: string | null;
        orderId: string | null;
        amount: Prisma.Decimal;
        note: string | null;
        isAnonymous: boolean;
        createdAt: Date;
    } | null>;
}
