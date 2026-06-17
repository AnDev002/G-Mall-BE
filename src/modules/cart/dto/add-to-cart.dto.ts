import { IsNotEmpty, IsInt, IsString, Min, Max, IsOptional } from 'class-validator';

export class AddToCartDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  // [round15 FIX cart-variant] Biến thể trở thành first-class trong cart. Trước đây cart
  // chỉ keyed theo productId → các variant khác nhau của cùng SP bị gộp làm 1 và removeItem
  // xoá HẾT variant. Optional để backward-compat với item không có variant.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  productVariantId?: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  quantity: number;
}