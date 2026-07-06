import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateFlashSaleSessionDto } from './dto/create-flash-sale.dto';
import { UpdateFlashSaleSessionDto } from './dto/update-flash-sale.dto';
import { RegisterFlashSaleDto } from './dto/register-flash-sale.dto';
import { Prisma, User } from '@prisma/client';
export declare class FlashSaleService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private mapSessionStatus;
    getRegisteredProducts(sellerId: string, sessionId: string): Promise<({
        product: {
            id: string;
            name: string;
            slug: string;
            description: string | null;
            shortDesc: Prisma.JsonValue | null;
            price: Prisma.Decimal;
            originalPrice: Prisma.Decimal | null;
            stock: number;
            reviewCount: number;
            systemTags: Prisma.JsonValue;
            images: Prisma.JsonValue;
            status: import("@prisma/client").$Enums.ProductStatus;
            rejectReason: string | null;
            attributes: Prisma.JsonValue | null;
            tags: string | null;
            brandId: number | null;
            shopCategoryId: string | null;
            salesCount: number;
            rating: number;
            shopId: string | null;
            weight: number;
            sellerId: string | null;
            categoryId: string | null;
            discountType: import("@prisma/client").$Enums.DiscountType | null;
            discountValue: Prisma.Decimal | null;
            discountStartDate: Date | null;
            discountEndDate: Date | null;
            isDiscountActive: boolean;
            createdAt: Date;
            updatedAt: Date;
        };
        variant: {
            id: string;
            productId: string;
            price: Prisma.Decimal;
            originalPrice: Prisma.Decimal | null;
            discountValue: Prisma.Decimal | null;
            stock: number;
            sku: string | null;
            image: string | null;
            tierIndex: string;
        };
    } & {
        id: string;
        sessionId: string;
        productId: string;
        variantId: string;
        originalPrice: Prisma.Decimal;
        salePrice: Prisma.Decimal;
        stock: number;
        sold: number;
        status: import("@prisma/client").$Enums.FlashSaleProductStatus;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    findAvailableSessionsForSeller(): Promise<({
        _count: {
            products: number;
        };
    } & {
        id: string;
        startTime: Date;
        endTime: Date;
        status: import("@prisma/client").$Enums.FlashSaleStatus;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    getCurrentFlashSaleForBuyer(): Promise<{
        products: any[];
        timeStatus: string;
        id: string;
        startTime: Date;
        endTime: Date;
        status: import("@prisma/client").$Enums.FlashSaleStatus;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
    registerProducts(sellerId: string, dto: RegisterFlashSaleDto): Promise<{
        success: boolean;
        registeredCount: number;
    }>;
    registerProductsToFlashSale(user: User, dto: RegisterFlashSaleDto): Promise<{
        success: boolean;
        registeredCount: number;
        errors: never[];
    }>;
    createSession(dto: CreateFlashSaleSessionDto): Promise<{
        timeStatus: string;
        id: string;
        startTime: Date;
        endTime: Date;
        status: import("@prisma/client").$Enums.FlashSaleStatus;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findAll(date?: string): Promise<{
        timeStatus: string;
        id: string;
        startTime: Date;
        endTime: Date;
        status: import("@prisma/client").$Enums.FlashSaleStatus;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    update(id: string, dto: UpdateFlashSaleSessionDto): Promise<{
        timeStatus: string;
        id: string;
        startTime: Date;
        endTime: Date;
        status: import("@prisma/client").$Enums.FlashSaleStatus;
        createdAt: Date;
        updatedAt: Date;
    }>;
    remove(id: string): Promise<{
        id: string;
        startTime: Date;
        endTime: Date;
        status: import("@prisma/client").$Enums.FlashSaleStatus;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
