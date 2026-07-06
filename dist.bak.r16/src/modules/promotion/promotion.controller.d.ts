import { PromotionService } from "./promotion.service";
import type { User } from "@prisma/client";
import { CreateVoucherDto } from "./dto/create-voucher.dto";
export declare class CalculateCartDto {
    total: number;
    voucherCode?: string;
    items?: any[];
}
export declare class PromotionController {
    private readonly promotionService;
    constructor(promotionService: PromotionService);
    createVoucher(dto: CreateVoucherDto, user: User): Promise<{
        id: string;
        code: string;
        name: string;
        description: string | null;
        type: import("@prisma/client").$Enums.VoucherType;
        scope: import("@prisma/client").$Enums.VoucherScope;
        amount: import("@prisma/client/runtime/library").Decimal;
        maxDiscount: import("@prisma/client/runtime/library").Decimal | null;
        minOrderValue: import("@prisma/client/runtime/library").Decimal;
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
    getPublicSystemVouchers(): Promise<{
        id: string;
        code: string;
        name: string;
        description: string | null;
        type: import("@prisma/client").$Enums.VoucherType;
        scope: import("@prisma/client").$Enums.VoucherScope;
        amount: import("@prisma/client/runtime/library").Decimal;
        maxDiscount: import("@prisma/client/runtime/library").Decimal | null;
        minOrderValue: import("@prisma/client/runtime/library").Decimal;
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
    claimVoucher(code: string, user: User): Promise<{
        message: string;
    }>;
    calculateCart(dto: CalculateCartDto): Promise<{
        totalDiscount: number;
        appliedVouchers: any[];
    }>;
    getSellerVouchers(user: User): Promise<({
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
        amount: import("@prisma/client/runtime/library").Decimal;
        maxDiscount: import("@prisma/client/runtime/library").Decimal | null;
        minOrderValue: import("@prisma/client/runtime/library").Decimal;
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
    getMyVouchers(user: User): Promise<{
        savedAt: Date;
        userVoucherId: string;
        id: string;
        code: string;
        name: string;
        description: string | null;
        type: import("@prisma/client").$Enums.VoucherType;
        scope: import("@prisma/client").$Enums.VoucherScope;
        amount: import("@prisma/client/runtime/library").Decimal;
        maxDiscount: import("@prisma/client/runtime/library").Decimal | null;
        minOrderValue: import("@prisma/client/runtime/library").Decimal;
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
    createSystemVoucher(dto: CreateVoucherDto): Promise<{
        id: string;
        code: string;
        name: string;
        description: string | null;
        type: import("@prisma/client").$Enums.VoucherType;
        scope: import("@prisma/client").$Enums.VoucherScope;
        amount: import("@prisma/client/runtime/library").Decimal;
        maxDiscount: import("@prisma/client/runtime/library").Decimal | null;
        minOrderValue: import("@prisma/client/runtime/library").Decimal;
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
        amount: import("@prisma/client/runtime/library").Decimal;
        maxDiscount: import("@prisma/client/runtime/library").Decimal | null;
        minOrderValue: import("@prisma/client/runtime/library").Decimal;
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
    getAllVouchers(scope?: string, search?: string): Promise<({
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
        amount: import("@prisma/client/runtime/library").Decimal;
        maxDiscount: import("@prisma/client/runtime/library").Decimal | null;
        minOrderValue: import("@prisma/client/runtime/library").Decimal;
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
