import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

// KHÔNG có code / scope / type: không cho sửa sau khi tạo.
export class UpdateVoucherDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100_000_000)
  amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  usageLimit?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderValue?: number;

  // 0 = bỏ giới hạn giảm tối đa
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscount?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString({ each: true })
  productIds?: string[];

  @IsOptional()
  @IsString({ each: true })
  categoryIds?: string[];
}