import { ProductWriteService } from '../services/product-write.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDiscountDto, UpdateProductDto } from '../dto/update-product.dto';
import { Role } from '@prisma/client';
interface UserEntity {
    id: string;
    email: string;
    role: Role;
}
export declare class SellerProductController {
    private readonly productWriteService;
    constructor(productWriteService: ProductWriteService);
    create(req: any, dto: CreateProductDto): Promise<({
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
    update(req: any, id: string, dto: UpdateProductDto): Promise<{
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
    searchMyProducts(req: any, search: string, limit: string): Promise<{
        id: string;
        name: string;
        price: import("@prisma/client/runtime/library").Decimal;
        stock: number;
        images: import("@prisma/client").Prisma.JsonValue;
    }[]>;
    updateDiscount(user: UserEntity, id: string, dto: UpdateProductDiscountDto): Promise<{
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
    delete(req: any, id: string): Promise<{
        count: number;
        message?: undefined;
    } | {
        count: number;
        message: string;
    }>;
    getMyProducts(req: any, status: string, page?: string, limit?: string, search?: string, sortBy?: string, sortOrder?: 'asc' | 'desc'): Promise<{
        data: ({
            _count: {
                variants: number;
            };
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
            limit: number;
            counts: Record<string, number>;
        };
    }>;
    findOneForEdit(req: any, id: string): Promise<{
        price: number;
        originalPrice: number | null;
        brand: any;
        origin: any;
        videos: any;
        sizeChart: any;
        length: number;
        width: number;
        height: number;
        crossSellProducts: {
            id: string;
        }[];
        crossSells: {
            relatedProductId: string;
        }[];
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
        id: string;
        name: string;
        slug: string;
        description: string | null;
        shortDesc: import("@prisma/client").Prisma.JsonValue | null;
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
}
export {};
