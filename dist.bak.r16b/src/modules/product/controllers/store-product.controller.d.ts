import { ProductReadService } from '../services/product-read.service';
import { PrismaService } from 'src/database/prisma/prisma.service';
export declare class StoreProductController {
    private readonly productReadService;
    private readonly prisma;
    constructor(productReadService: ProductReadService, prisma: PrismaService);
    getProducts(req: any, page: number, limit: number, search: string, categorySlug: string, minPrice: number, maxPrice: number, rating: number, sort: string, tag: string, deviceId: string): Promise<any>;
    getProductDetail(id: string): Promise<any>;
    syncSearchIndex(): Promise<void>;
    getRelated(id: string): Promise<{
        id: string;
        name: string;
        slug: string;
        rating: number;
        price: import("@prisma/client/runtime/library").Decimal;
        stock: number;
        images: import("@prisma/client").Prisma.JsonValue;
        salesCount: number;
    }[]>;
    getMoreFromShop(id: string): Promise<{
        id: string;
        name: string;
        slug: string;
        rating: number;
        price: import("@prisma/client/runtime/library").Decimal;
        stock: number;
        images: import("@prisma/client").Prisma.JsonValue;
        salesCount: number;
    }[]>;
    getBoughtTogether(id: string): Promise<{
        id: string;
        name: string;
        price: number;
        stock: number;
        images: any;
        slug: string;
        options: {
            name: string;
            values: {
                value: string;
                image: string | null;
            }[];
        }[];
        variants: {
            price: number;
            stock: number;
            id: string;
            productId: string;
            originalPrice: import("@prisma/client/runtime/library").Decimal | null;
            discountValue: import("@prisma/client/runtime/library").Decimal | null;
            sku: string | null;
            image: string | null;
            tierIndex: string;
        }[];
        description: string | null;
        shortDesc: import("@prisma/client").Prisma.JsonValue | null;
        originalPrice: import("@prisma/client/runtime/library").Decimal | null;
        reviewCount: number;
        systemTags: import("@prisma/client").Prisma.JsonValue;
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
    }[]>;
    getProductReviews(productId: string, page: number, limit: number, rating?: number): Promise<{
        data: ({
            user: {
                name: string | null;
                avatar: string | null;
            };
        } & {
            id: string;
            content: string | null;
            rating: number;
            images: import("@prisma/client").Prisma.JsonValue | null;
            userId: string;
            productId: string;
            orderId: string;
            createdAt: Date;
            updatedAt: Date;
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
        distribution: {
            1: number;
            2: number;
            3: number;
            4: number;
            5: number;
        };
    }>;
}
