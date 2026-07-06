export declare class ShortDescDto {
    brand?: string;
    features?: string;
    benefits?: string;
    recipient?: string;
    occasion?: string;
    note?: string;
}
export declare class ProductTierDto {
    name: string;
    options: string[];
    images?: string[];
}
export declare class ProductVariantDto {
    price: number;
    stock: number;
    sku?: string;
    imageUrl?: string;
    tierIndex: number[];
}
export declare class CreateProductDto {
    status?: 'DRAFT' | 'PENDING';
    name: string;
    description: string;
    categoryId: string;
    price: number;
    stock?: number;
    brand?: string;
    brandId?: number;
    images?: string[];
    videos?: string[];
    sizeChart?: string;
    origin?: string;
    attributes?: any;
    weight: number;
    length: number;
    width: number;
    height: number;
    tiers?: ProductTierDto[];
    variations?: ProductVariantDto[];
    crossSellIds?: string[];
    systemTags?: string[];
    shortDesc?: ShortDescDto;
}
