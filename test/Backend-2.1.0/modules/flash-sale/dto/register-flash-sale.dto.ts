import { IsArray, IsNotEmpty, IsNumber, IsString, IsUUID, Min } from 'class-validator';

export class FlashSaleItemDto {
  @IsNotEmpty()
  @IsUUID()
  productId: string;

  @IsNotEmpty()
  @IsUUID()
  variantId: string;

  @IsNumber()
  @Min(1000)
  promoPrice: number;

  @IsNumber()
  @Min(1)
  promoStock: number;
}

export class RegisterFlashSaleDto {
  @IsNotEmpty()
  @IsUUID()
  sessionId: string;

  @IsArray()
  items: FlashSaleItemDto[];
}