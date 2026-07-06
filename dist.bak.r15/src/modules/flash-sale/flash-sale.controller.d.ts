import { FlashSaleService } from './flash-sale.service';
import { CreateFlashSaleSessionDto } from './dto/create-flash-sale.dto';
import { UpdateFlashSaleSessionDto } from './dto/update-flash-sale.dto';
import { RegisterFlashSaleDto } from './dto/register-flash-sale.dto';
import { ShopService } from '../shop/shop.service';
export declare class FlashSaleController {
    private readonly flashSaleService;
    constructor(flashSaleService: FlashSaleService);
    create(createDto: CreateFlashSaleSessionDto): Promise<{
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
    update(id: string, updateDto: UpdateFlashSaleSessionDto): Promise<{
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
export declare class SellerFlashSaleController {
    private readonly flashSaleService;
    private readonly shopService;
    constructor(flashSaleService: FlashSaleService, shopService: ShopService);
    getAvailableSessions(): Promise<({
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
    getRegisteredProducts(user: any, sessionId: string): Promise<({
        product: {
            id: string;
            name: string;
            slug: string;
            description: string | null;
            shortDesc: import("@prisma/client").Prisma.JsonValue | null;
            price: import("@prisma/client/runtime/library").Decimal;
            originalPrice: import("@prisma/client/runtime/library").Decimal | null;
            stock: number;
            reviewCount: number;
            systemTags: import("@prisma/client").Prisma.JsonValue;
            images: import("@prisma/client").Prisma.JsonValue;
            status: import("@prisma/client").$Enums.ProductStatus;
            rejectReason: string | null;
            attributes: import("@prisma/client").Prisma.JsonValue | null;
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
            discountValue: import("@prisma/client/runtime/library").Decimal | null;
            discountStartDate: Date | null;
            discountEndDate: Date | null;
            isDiscountActive: boolean;
            createdAt: Date;
            updatedAt: Date;
        };
        variant: {
            id: string;
            productId: string;
            price: import("@prisma/client/runtime/library").Decimal;
            originalPrice: import("@prisma/client/runtime/library").Decimal | null;
            discountValue: import("@prisma/client/runtime/library").Decimal | null;
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
        originalPrice: import("@prisma/client/runtime/library").Decimal;
        salePrice: import("@prisma/client/runtime/library").Decimal;
        stock: number;
        sold: number;
        status: import("@prisma/client").$Enums.FlashSaleProductStatus;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    registerProducts(user: any, dto: RegisterFlashSaleDto): Promise<{
        success: boolean;
        registeredCount: number;
    }>;
}
export declare class StoreFlashSaleController {
    private readonly flashSaleService;
    constructor(flashSaleService: FlashSaleService);
    getCurrentSession(): Promise<{
        products: any[];
        timeStatus: string;
        id: string;
        startTime: Date;
        endTime: Date;
        status: import("@prisma/client").$Enums.FlashSaleStatus;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
}
