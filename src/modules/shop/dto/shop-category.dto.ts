import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * wiki 0108: `shop-category.controller` trước đây nhận thẳng `@Body('name') name: string`
 * — KHÔNG có DTO nào, nên `ValidationPipe` không có gì để kiểm. Hậu quả đo được trên prod:
 * tạo được danh mục với `name: ""` (HTTP 201), và tạo được hai danh mục trùng tên trong
 * cùng một shop. Danh mục không tên thì người mua thấy một mục trống trên trang gian hàng.
 */
export class CreateShopCategoryDto {
  // Cắt khoảng trắng TRƯỚC khi kiểm: `@IsNotEmpty()` không chặn `"   "`.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Tên danh mục không được để trống' })
  @MaxLength(150, { message: 'Tên danh mục không được dài quá 150 ký tự' })
  name: string;
}

export class UpdateShopCategoryDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Tên danh mục không được để trống' })
  @MaxLength(150)
  name?: string;

  @IsOptional()
  isActive?: boolean;
}
