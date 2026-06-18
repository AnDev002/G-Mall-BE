// BE-110/modules/order/dto/create-order.dto.ts

import { IsBoolean, IsOptional, IsString, IsArray, ValidateNested, IsNumber, IsInt, Min, IsObject, IsNotEmpty, IsIn } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CartItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  // Wiki 0075: @IsInt (không phải @IsNumber) — qty=1.5 lọt qua @IsNumber gây đơn +
  // kho số lẻ (VND không thập phân). Đồng bộ với cart add-to-cart/update (đã @IsInt).
  @IsInt()
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

  // [round15 FIX partial-coin] Số xu user CHỌN tiêu. Trước đây DTO không có field này → ValidationPipe
  // (whitelist:true) strip mất → BE luôn tiêu min(balance,50000,payable) bất kể user gõ bao nhiêu →
  // buyer mất xu không đồng ý. previewOrder cap lại theo min(balance,50000,payable) nên vẫn an toàn.
  @IsOptional()
  @IsInt()
  @Min(0)
  appliedCoins?: number;

  @IsOptional()
  @IsBoolean()
  isGift?: boolean;

  // [FIX P-KEY - wiki 0091] Trước đây chỉ @IsString → nhận mọi chuỗi; createOrder so sánh case-sensitive
  // ('cod'/'momo'/'pay2s') → method HOA/lạ ('MOMO','banking'...) lọt validation nhưng không khớp nhánh nào
  // → đơn PENDING không paymentUrl, không vận đơn, treated online-unpaid vĩnh viễn (đơn kẹt). Nay chuẩn hoá
  // chữ thường + whitelist: method hợp lệ bất kể HOA/thường, method lạ → 400 ngay (fail loud, không kẹt đơn).
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsIn(['cod', 'momo', 'pay2s'], { message: 'Phương thức thanh toán không hợp lệ' })
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