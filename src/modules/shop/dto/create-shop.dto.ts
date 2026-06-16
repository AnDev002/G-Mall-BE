// src/modules/shop/dto/create-shop.dto.ts
import { Transform } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, IsNumber, MinLength, MaxLength } from 'class-validator';

export class CreateShopDto {
  // Wiki 0086: thêm giới hạn độ dài cho name khi đăng ký shop.
  // Trước đây name chỉ có @IsString nên tên quá dài có thể gây crash 500 (bypass DTO update vốn strict).
  @IsNotEmpty({ message: 'Tên Shop không được để trống' })
  @IsString()
  @MinLength(2, { message: 'Tên Shop phải có ít nhất 2 ký tự' })
  @MaxLength(100, { message: 'Tên Shop tối đa 100 ký tự' })
  name: string;

  // Wiki 0086: giới hạn độ dài địa chỉ lấy hàng để tránh dữ liệu quá khổ.
  @IsNotEmpty({ message: 'Địa chỉ lấy hàng không được để trống' })
  @IsString()
  @MaxLength(255, { message: 'Địa chỉ lấy hàng tối đa 255 ký tự' })
  pickupAddress: string;

  // Wiki 0086: giới hạn độ dài mô tả shop.
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Mô tả shop tối đa 1000 ký tự' })
  description?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsNotEmpty({ message: 'Province ID là bắt buộc' })
  @IsNumber()
  @Transform(({ value }) => Number(value)) // Đảm bảo convert sang số nếu gửi từ FormData
  provinceId: number;

  @IsNotEmpty({ message: 'District ID là bắt buộc' })
  @IsNumber()
  @Transform(({ value }) => Number(value))
  districtId: number;

  @IsNotEmpty({ message: 'Ward Code là bắt buộc' })
  @IsString()
  wardCode: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => value ? Number(value) : 0)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => value ? Number(value) : 0)
  lng?: number;
}