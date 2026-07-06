import { OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { ProductCacheService } from './product-cache.service';
import { CategoryService } from '../../category/category.service';
import { Prisma } from '@prisma/client';
interface FindAllPublicDto {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    categorySlug?: string;
    brandId?: number;
    minPrice?: number;
    maxPrice?: number;
    rating?: number;
    sort?: string;
    tag?: string;
}
export declare class ProductReadService implements OnModuleInit {
    private readonly prisma;
    private readonly redis;
    private readonly productCache;
    private readonly categoryService;
    private readonly logger;
    constructor(prisma: PrismaService, redis: Redis, productCache: ProductCacheService, categoryService: CategoryService);
    onModuleInit(): Promise<void>;
    private getKeywordsFromTag;
    private cleanSystemTags;
    private escapeRediSearchText;
    private ensureSearchIndex;
    private getKeywordsFromDynamicConfig;
    syncAllProductsToRedis(): Promise<void>;
    syncProductToRedis(product: any): Promise<void>;
    findAllPublic(query: FindAllPublicDto): Promise<any>;
    getAdminProductSelector(query: any): Promise<{
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
    searchPublic(query: any): Promise<{
        data: {
            shop: {
                name: string;
            } | null;
            id: string;
            name: string;
            price: Prisma.Decimal;
            images: Prisma.JsonValue;
        }[];
    }>;
    removeProductFromRedis(id: string, name: string): Promise<void>;
    searchSuggestions(keyword: string): Promise<any>;
    findOnePublic(idOrSlug: string): Promise<any>;
    findRelated(productId: string): Promise<{
        id: string;
        name: string;
        slug: string;
        rating: number;
        price: Prisma.Decimal;
        stock: number;
        images: Prisma.JsonValue;
        salesCount: number;
    }[]>;
    findMoreFromShop(productId: string): Promise<{
        id: string;
        name: string;
        slug: string;
        rating: number;
        price: Prisma.Decimal;
        stock: number;
        images: Prisma.JsonValue;
        salesCount: number;
    }[]>;
    searchProductsForAdmin(query: string): Promise<{
        id: string;
        name: string;
        price: Prisma.Decimal;
        images: Prisma.JsonValue;
        variants: {
            id: string;
            productId: string;
            price: Prisma.Decimal;
            originalPrice: Prisma.Decimal | null;
            discountValue: Prisma.Decimal | null;
            stock: number;
            sku: string | null;
            image: string | null;
            tierIndex: string;
        }[];
    }[]>;
    findAllForSeller(sellerId: string, query: {
        page?: number;
        limit?: number;
        keyword?: string;
    }): Promise<{
        data: ({
            category: {
                id: string;
                name: string;
                slug: string;
                image: string | null;
                parentId: string | null;
                order: number;
                filterKeys: Prisma.JsonValue | null;
                createdAt: Date;
                updatedAt: Date;
            } | null;
            variants: {
                id: string;
                productId: string;
                price: Prisma.Decimal;
                originalPrice: Prisma.Decimal | null;
                discountValue: Prisma.Decimal | null;
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
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
            last_page: number;
        };
    }>;
    findShopProducts(shopId: string, query: {
        page?: number;
        limit?: number;
        sort?: string;
        categoryId?: string;
        minPrice?: number;
        maxPrice?: number;
        rating?: number;
    }): Promise<{
        data: {
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
        }[];
        meta: {
            total: number;
            page: number;
            limit: number;
            last_page: number;
        };
    }>;
    findBoughtTogether(productId: string): Promise<any>;
    getPersonalizedFeed(userId: string, page: number, limit: number): Promise<{
        data: any[];
        meta: {
            page: number;
            limit: number;
            total: number;
        };
    }>;
}
export {};
