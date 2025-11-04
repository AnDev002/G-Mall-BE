// src/product/dto/create-product.dto.ts
import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';
import { Prisma } from '@prisma/client';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  brand?: string;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  price: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  stock: number;

  @IsString()
  @IsOptional()
  category?: string;

  // --- SỬA LỖI TẠI ĐÂY ---
  // Đổi 'Prisma.JsonValue' thành 'any' để tương thích
  @IsOptional()
  attributes?: any;

  @IsString()
  @IsOptional()
  image_url?: string;
}