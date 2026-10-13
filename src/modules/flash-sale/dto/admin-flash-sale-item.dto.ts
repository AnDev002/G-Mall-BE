import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AdminAddFlashSaleItemDto {
  @IsString()
  productId: string;

  // Bỏ trống = lấy biến thể đầu tiên của sản phẩm
  @IsOptional()
  @IsString()
  variantId?: string;

  @IsNumber()
  @Min(1)
  promoPrice: number;

  @IsNumber()
  @Min(1)
  promoStock: number;
}