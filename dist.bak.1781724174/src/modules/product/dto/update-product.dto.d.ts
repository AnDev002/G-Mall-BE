import { CreateProductDto } from './create-product.dto';
export declare enum DiscountType {
    PERCENT = "PERCENT"
}
export declare class ProductVariantDiscountDto {
    id: string;
    discountValue: number;
}
export declare class UpdateProductDiscountDto {
    discountType: DiscountType;
    discountValue: number;
    discountStartDate: string;
    discountEndDate: string;
    isDiscountActive: boolean;
    variants: ProductVariantDiscountDto[];
}
declare const UpdateProductDto_base: import("@nestjs/mapped-types").MappedType<Partial<CreateProductDto>>;
export declare class UpdateProductDto extends UpdateProductDto_base {
}
export {};
