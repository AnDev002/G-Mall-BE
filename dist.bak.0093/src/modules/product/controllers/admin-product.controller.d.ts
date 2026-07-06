import { ProductWriteService } from '../services/product-write.service';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { ProductReadService } from '../services/product-read.service';
import { CategoryService } from '../../category/category.service';
import { ProductAutoTagService, TagRule } from '../services/product-auto-tag.service';
export declare class AdminProductController {
    private readonly productWriteService;
    private readonly prisma;
    private readonly productReadService;
    private readonly categoryService;
    private readonly productAutoTagService;
    constructor(productWriteService: ProductWriteService, prisma: PrismaService, productReadService: ProductReadService, categoryService: CategoryService, productAutoTagService: ProductAutoTagService);
    findAll(status: string, page: string, limit: string, search: string, categoryId: string): Promise<{
        data: ({
            shop: {
                id: string;
                name: string;
                avatar: string | null;
            } | null;
            category: {
                id: string;
                name: string;
            } | null;
            _count: {
                variants: number;
            };
            brandRel: {
                id: number;
                name: string;
            } | null;
        } & {
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
        })[];
        meta: {
            total: number;
            page: number;
            totalPages: number;
        };
    }>;
    bulkApprove(body: {
        ids: string[];
        status: 'ACTIVE' | 'REJECTED';
        reason?: string;
    }): Promise<{
        count: number;
    }>;
    updateSystemTags(id: string, body: {
        systemTags: string[];
    }): Promise<{
        shop: {
            id: string;
            name: string;
            avatar: string | null;
        } | null;
        category: {
            id: string;
            name: string;
            slug: string;
            image: string | null;
            parentId: string | null;
            order: number;
            filterKeys: import("@prisma/client").Prisma.JsonValue | null;
            createdAt: Date;
            updatedAt: Date;
        } | null;
    } & {
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
    }>;
    approveProduct(id: string, body: {
        status: 'ACTIVE' | 'REJECTED';
        reason?: string;
    }): Promise<{
        shop: {
            id: string;
            name: string;
            avatar: string | null;
        } | null;
        variants: {
            id: string;
            productId: string;
            price: import("@prisma/client/runtime/library").Decimal;
            originalPrice: import("@prisma/client/runtime/library").Decimal | null;
            discountValue: import("@prisma/client/runtime/library").Decimal | null;
            stock: number;
            sku: string | null;
            image: string | null;
            tierIndex: string;
        }[];
    } & {
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
    }>;
    getProductSelector(query: any): Promise<{
        data: {
            price: number;
            images: string[];
            shop: {
                id: string;
                name: string;
            } | null;
            id: string;
            name: string;
        }[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    search(query: any): Promise<{
        data: {
            shop: {
                name: string;
            } | null;
            id: string;
            name: string;
            price: import("@prisma/client/runtime/library").Decimal;
            images: import("@prisma/client").Prisma.JsonValue;
        }[];
    }>;
    deleteAllProducts(): Promise<{
        count: number;
        message: string;
    }>;
    searchForBlog(query: string): Promise<{
        id: string;
        name: string;
        price: import("@prisma/client/runtime/library").Decimal;
        images: import("@prisma/client").Prisma.JsonValue;
        variants: {
            id: string;
            productId: string;
            price: import("@prisma/client/runtime/library").Decimal;
            originalPrice: import("@prisma/client/runtime/library").Decimal | null;
            discountValue: import("@prisma/client/runtime/library").Decimal | null;
            stock: number;
            sku: string | null;
            image: string | null;
            tierIndex: string;
        }[];
    }[]>;
    deleteProduct(id: string): Promise<{
        count: number;
        message?: undefined;
    } | {
        count: number;
        message: string;
    }>;
    triggerAutoTag(body: {
        rules: TagRule[];
    }): Promise<{
        updatedCount: number;
    }>;
    bulkDeleteProduct(body: {
        ids: string[];
    }): Promise<{
        count: number;
        message?: undefined;
    } | {
        count: number;
        message: string;
    }>;
    findOne(id: string): Promise<({
        shop: {
            id: string;
            name: string;
            slug: string;
            description: string | null;
            avatar: string | null;
            coverImage: string | null;
            pickupAddress: string | null;
            provinceId: number | null;
            districtId: number | null;
            wardCode: string | null;
            lat: number | null;
            lng: number | null;
            categoryId: string | null;
            status: import("@prisma/client").$Enums.ShopStatus;
            banReason: string | null;
            reviewCount: number;
            decoration: import("@prisma/client").Prisma.JsonValue | null;
            pendingDetails: import("@prisma/client").Prisma.JsonValue | null;
            rating: number;
            totalSales: number;
            ownerId: string;
            address: string | null;
            licenseImage: string | null;
            taxCode: string | null;
            businessLicenseFront: string | null;
            businessLicenseBack: string | null;
            salesLicense: string | null;
            trademarkCert: string | null;
            distributorCert: string | null;
            createdAt: Date;
            updatedAt: Date;
        } | null;
        category: {
            id: string;
            name: string;
            slug: string;
            image: string | null;
            parentId: string | null;
            order: number;
            filterKeys: import("@prisma/client").Prisma.JsonValue | null;
            createdAt: Date;
            updatedAt: Date;
        } | null;
        options: ({
            values: {
                id: string;
                optionId: string;
                value: string;
                image: string | null;
                position: number;
            }[];
        } & {
            id: string;
            productId: string;
            name: string;
            position: number;
        })[];
        variants: {
            id: string;
            productId: string;
            price: import("@prisma/client/runtime/library").Decimal;
            originalPrice: import("@prisma/client/runtime/library").Decimal | null;
            discountValue: import("@prisma/client/runtime/library").Decimal | null;
            stock: number;
            sku: string | null;
            image: string | null;
            tierIndex: string;
        }[];
    } & {
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
    }) | null>;
}
