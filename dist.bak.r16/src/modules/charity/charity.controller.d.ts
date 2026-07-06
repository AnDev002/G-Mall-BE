import { CharityService } from './charity.service';
import { CreateFundDto, UpdateFundDto } from './dto/create-fund.dto';
import { DonateDto } from './dto/donate.dto';
export declare class CharityController {
    private readonly service;
    constructor(service: CharityService);
    listFunds(includeClosed?: string): Promise<{
        id: string;
        name: string;
        slug: string;
        description: string | null;
        image: string | null;
        goalAmount: import("@prisma/client/runtime/library").Decimal;
        currentAmount: import("@prisma/client/runtime/library").Decimal;
        status: import(".prisma/client").$Enums.CharityFundStatus;
        isPrimary: boolean;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    getFund(slug: string): Promise<{
        id: string;
        name: string;
        slug: string;
        description: string | null;
        image: string | null;
        goalAmount: import("@prisma/client/runtime/library").Decimal;
        currentAmount: import("@prisma/client/runtime/library").Decimal;
        status: import(".prisma/client").$Enums.CharityFundStatus;
        isPrimary: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    listDonations(slug: string, limit?: string): Promise<({
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
        amount: import("@prisma/client/runtime/library").Decimal;
        note: string | null;
        isAnonymous: boolean;
        createdAt: Date;
    })[]>;
    donate(user: any, dto: DonateDto): Promise<{
        id: string;
        fundId: string;
        userId: string | null;
        orderId: string | null;
        amount: import("@prisma/client/runtime/library").Decimal;
        note: string | null;
        isAnonymous: boolean;
        createdAt: Date;
    }>;
    listActiveCampaigns(): Promise<({
        funds: ({
            fund: {
                id: string;
                name: string;
                slug: string;
                description: string | null;
                image: string | null;
                goalAmount: import("@prisma/client/runtime/library").Decimal;
                currentAmount: import("@prisma/client/runtime/library").Decimal;
                status: import(".prisma/client").$Enums.CharityFundStatus;
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
}
export declare class AdminCharityController {
    private readonly service;
    constructor(service: CharityService);
    listAllFunds(): Promise<{
        id: string;
        name: string;
        slug: string;
        description: string | null;
        image: string | null;
        goalAmount: import("@prisma/client/runtime/library").Decimal;
        currentAmount: import("@prisma/client/runtime/library").Decimal;
        status: import(".prisma/client").$Enums.CharityFundStatus;
        isPrimary: boolean;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    createFund(dto: CreateFundDto): Promise<{
        id: string;
        name: string;
        slug: string;
        description: string | null;
        image: string | null;
        goalAmount: import("@prisma/client/runtime/library").Decimal;
        currentAmount: import("@prisma/client/runtime/library").Decimal;
        status: import(".prisma/client").$Enums.CharityFundStatus;
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
        goalAmount: import("@prisma/client/runtime/library").Decimal;
        currentAmount: import("@prisma/client/runtime/library").Decimal;
        status: import(".prisma/client").$Enums.CharityFundStatus;
        isPrimary: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    listCampaigns(includeInactive?: string): Promise<({
        funds: ({
            fund: {
                id: string;
                name: string;
                slug: string;
                description: string | null;
                image: string | null;
                goalAmount: import("@prisma/client/runtime/library").Decimal;
                currentAmount: import("@prisma/client/runtime/library").Decimal;
                status: import(".prisma/client").$Enums.CharityFundStatus;
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
    createCampaign(dto: any): Promise<{
        funds: ({
            fund: {
                id: string;
                name: string;
                slug: string;
                description: string | null;
                image: string | null;
                goalAmount: import("@prisma/client/runtime/library").Decimal;
                currentAmount: import("@prisma/client/runtime/library").Decimal;
                status: import(".prisma/client").$Enums.CharityFundStatus;
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
                goalAmount: import("@prisma/client/runtime/library").Decimal;
                currentAmount: import("@prisma/client/runtime/library").Decimal;
                status: import(".prisma/client").$Enums.CharityFundStatus;
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
}
