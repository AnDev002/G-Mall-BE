import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';
import { VoucherType, VoucherScope } from '@prisma/client';

export class CreateVoucherDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsEnum(VoucherType)
  type: VoucherType;

  @IsEnum(VoucherScope)
  scope: VoucherScope;

  // [FIX M2 - wiki 0088] chặn sanity số tiền vô lý (giảm giá thực được cap ≤ subtotal ở
  // promotion.service). PERCENTAGE nên ≤100 nhưng validate chéo theo type phức tạp → service cap.
  @IsNumber()
  @Min(0)
  @Max(100_000_000)
  amount: number;

  @IsNumber()
  @Min(1)
  usageLimit: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsString({ each: true })
  productIds?: string[];

  // --- BỔ SUNG 2 TRƯỜNG NÀY ---
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscount?: number;
  // ----------------------------

  @IsOptional()
  @IsString({ each: true })
  categoryIds?: string[];
}