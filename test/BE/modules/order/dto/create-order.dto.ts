// BE-110/modules/order/dto/create-order.dto.ts

import { IsBoolean, IsOptional, IsString, IsArray, ValidateNested, IsNumber, Min, IsObject, IsNotEmpty } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CartItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  variantId?: string;
}

export class CreateOrderDto {
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  }) 
  isBuyNow: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items?: CartItemDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  voucherIds?: string[];

  @IsOptional()
  @IsBoolean()
  useCoins?: boolean;

  @IsOptional()
  @IsBoolean()
  isGift?: boolean;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  paymentMethod: string;

  @IsOptional()
  @IsObject()
  receiverInfo?: any;

  // [FIX] Thêm senderInfo
  @IsOptional()
  @IsObject()
  senderInfo?: any;

  // [FIX] Thêm giftWrapIndex
  @IsOptional()
  @IsNumber()
  giftWrapIndex?: number;

  // [FIX] Thêm cardIndex
  @IsOptional()
  @IsNumber()
  cardIndex?: number;

  // Note có thể là String (gộp) hoặc Object (từng shop)
  @IsOptional()
  note?: string | Record<string, string>;

  @IsOptional()
  @IsNumber()
  shippingFee?: number;
}