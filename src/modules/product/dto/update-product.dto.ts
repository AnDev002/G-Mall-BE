import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';
import { IsEnum, IsNumber, IsOptional, IsDateString, IsBoolean, Min, Max, IsString, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum DiscountType {
  PERCENT = 'PERCENT',
}
export class ProductVariantDiscountDto {
  @ApiProperty()
  @IsString()
  id: string; // Cần ID để tìm variant trong DB

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100) // Wiki 0082: chặn giảm > 100% → giá âm
  discountValue: number; // % giảm giá
}
export class UpdateProductDiscountDto {
  @ApiProperty()
  @IsEnum(DiscountType)
  @IsOptional()
  discountType: DiscountType;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100) // Wiki 0082: chặn giảm > 100% → giá âm
  @IsOptional()
  discountValue: number;

  @ApiProperty()
  @IsDateString()
  @IsOptional()
  discountStartDate: string;

  @ApiProperty()
  @IsDateString()
  @IsOptional()
  discountEndDate: string;

  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  isDiscountActive: boolean;

  @ApiProperty({ type: [ProductVariantDiscountDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDiscountDto)
  variants: ProductVariantDiscountDto[];
}


export class UpdateProductDto extends PartialType(CreateProductDto) {}