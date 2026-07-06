import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisService } from '../../database/redis/redis.service';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { Prisma, VoucherScope } from '@prisma/client';
export declare class PromotionService {
    private prisma;
    private redisService;
    constructor(prisma: PrismaService, redisService: RedisService);
    calculateMultiShopVouchers(voucherIds: string[], shopGroups: Record<string, any>): Promise<{
        shopDiscounts: Record<string, number>;
        systemDiscount: number;
        freeshipDiscount: number;
        appliedVouchers: any[];
    }>;
    validateAndCalculateVouchers(voucherIds: string[], orderTotal: number, items: any[]): Promise<{
        totalDiscount: number;
        appliedVouchers: any[];
    }>;
    getPublicSystemVouchers(): Promise<{
        id: string;
        code: string;
        name: string;
        description: string | null;
        type: import("@prisma/client").$Enums.VoucherType;
        scope: import("@prisma/client").$Enums.VoucherScope;
        amount: Prisma.Decimal;
        maxDiscount: Prisma.Decimal | null;
        minOrderValue: Prisma.Decimal;
        usageLimit: number;
        usageCount: number;
        userUsageLimit: number;
        startDate: Date;
        endDate: Date;
        isActive: boolean;
        shopId: string | null;
        sellerId: string | null;
        createdAt: Date;
        updatedAt: Date;
        version: number;
    }[]>;
    calculateDiscount(dto: any): Promise<{
        totalDiscount: number;
        appliedVouchers: any[];
    }>;
    createShopVoucher(sellerId: string, dto: CreateVoucherDto): Promise<{
        id: string;
        code: string;
        name: string;
        description: string | null;
        type: import("@prisma/client").$Enums.VoucherType;
        scope: import("@prisma/client").$Enums.VoucherScope;
        amount: Prisma.Decimal;
        maxDiscount: Prisma.Decimal | null;
        minOrderValue: Prisma.Decimal;
        usageLimit: number;
        usageCount: number;
        userUsageLimit: number;
        startDate: Date;
        endDate: Date;
        isActive: boolean;
        shopId: string | null;
        sellerId: string | null;
        createdAt: Date;
        updatedAt: Date;
        version: number;
    }>;
    createSystemVoucher(dto: CreateVoucherDto): Promise<{
        id: string;
        code: string;
        name: string;
        description: string | null;
        type: import("@prisma/client").$Enums.VoucherType;
        scope: import("@prisma/client").$Enums.VoucherScope;
        amount: Prisma.Decimal;
        maxDiscount: Prisma.Decimal | null;
        minOrderValue: Prisma.Decimal;
        usageLimit: number;
        usageCount: number;
        userUsageLimit: number;
        startDate: Date;
        endDate: Date;
        isActive: boolean;
        shopId: string | null;
        sellerId: string | null;
        createdAt: Date;
        updatedAt: Date;
        version: number;
    }>;
    claimVoucher(userId: string, code: string): Promise<{
        message: string;
    }>;
    getShopVouchers(sellerId: string): Promise<({
        _count: {
            orders: number;
            userVouchers: number;
        };
    } & {
        id: string;
        code: string;
        name: string;
        description: string | null;
        type: import("@prisma/client").$Enums.VoucherType;
        scope: import("@prisma/client").$Enums.VoucherScope;
        amount: Prisma.Decimal;
        maxDiscount: Prisma.Decimal | null;
        minOrderValue: Prisma.Decimal;
        usageLimit: number;
        usageCount: number;
        userUsageLimit: number;
        startDate: Date;
        endDate: Date;
        isActive: boolean;
        shopId: string | null;
        sellerId: string | null;
        createdAt: Date;
        updatedAt: Date;
        version: number;
    })[]>;
    getMyVouchers(userId: string): Promise<{
        savedAt: Date;
        userVoucherId: string;
        id: string;
        code: string;
        name: string;
        description: string | null;
        type: import("@prisma/client").$Enums.VoucherType;
        scope: import("@prisma/client").$Enums.VoucherScope;
        amount: Prisma.Decimal;
        maxDiscount: Prisma.Decimal | null;
        minOrderValue: Prisma.Decimal;
        usageLimit: number;
        usageCount: number;
        userUsageLimit: number;
        startDate: Date;
        endDate: Date;
        isActive: boolean;
        shopId: string | null;
        sellerId: string | null;
        createdAt: Date;
        updatedAt: Date;
        version: number;
    }[]>;
    getSystemVouchers(): Promise<({
        _count: {
            orders: number;
            userVouchers: number;
        };
    } & {
        id: string;
        code: string;
        name: string;
        description: string | null;
        type: import("@prisma/client").$Enums.VoucherType;
        scope: import("@prisma/client").$Enums.VoucherScope;
        amount: Prisma.Decimal;
        maxDiscount: Prisma.Decimal | null;
        minOrderValue: Prisma.Decimal;
        usageLimit: number;
        usageCount: number;
        userUsageLimit: number;
        startDate: Date;
        endDate: Date;
        isActive: boolean;
        shopId: string | null;
        sellerId: string | null;
        createdAt: Date;
        updatedAt: Date;
        version: number;
    })[]>;
    getAllVouchers(filter: {
        scope?: VoucherScope;
        search?: string;
    }): Promise<({
        _count: {
            orders: number;
            userVouchers: number;
        };
        seller: {
            id: string;
            shopName: string | null;
        } | null;
    } & {
        id: string;
        code: string;
        name: string;
        description: string | null;
        type: import("@prisma/client").$Enums.VoucherType;
        scope: import("@prisma/client").$Enums.VoucherScope;
        amount: Prisma.Decimal;
        maxDiscount: Prisma.Decimal | null;
        minOrderValue: Prisma.Decimal;
        usageLimit: number;
        usageCount: number;
        userUsageLimit: number;
        startDate: Date;
        endDate: Date;
        isActive: boolean;
        shopId: string | null;
        sellerId: string | null;
        createdAt: Date;
        updatedAt: Date;
        version: number;
    })[]>;
}
