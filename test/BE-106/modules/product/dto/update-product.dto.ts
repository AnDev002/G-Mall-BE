import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';
import { IsEnum, IsNumber, IsOptional, IsDateString, IsBoolean, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum DiscountType {
  PERCENT = 'PERCENT',
  AMOUNT = 'AMOUNT',
}

export class UpdateProductDiscountDto {
  @ApiProperty()
  @IsEnum(DiscountType)
  @IsOptional()
  discountType: DiscountType;

  @ApiProperty()
  @IsNumber()
  @Min(0)
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
}


export class UpdateProductDto extends PartialType(CreateProductDto) {}