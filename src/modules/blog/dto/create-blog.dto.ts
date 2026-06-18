// BE-4.0/modules/blog/dto/create-blog.dto.ts
import { IsString, IsOptional, IsArray, IsBoolean, IsEnum, IsUUID } from 'class-validator';

export class CreateBlogDto {
  @IsString()
  title: string;

  @IsString()
  content: string;

  // [FIX wiki 0092] thumbnail OPTIONAL — schema là `thumbnail String?` (nullable) và FE/UI xử lý thiếu
  // ảnh (BlogCard có nhánh no-thumbnail). Trước đây @IsString() bắt buộc → đăng bài không có ảnh bị 400
  // → "đăng bài không hiện". Khớp lại contract với schema.
  @IsOptional()
  @IsString()
  thumbnail?: string;

  @IsOptional() @IsString()
  slug?: string; // Nếu không gửi, BE tự generate từ title

  @IsOptional()
  @IsUUID() // Validate định dạng UUID cho categoryId
  categoryId?: string;

  @IsOptional()
  @IsString() 
  // @IsEnum(BlogPostStatus) 
  status?: string;

  // SEO Info
  @IsOptional() @IsString()
  metaTitle?: string;

  @IsOptional() @IsString()
  metaDescription?: string;

  @IsOptional() @IsArray()
  keywords?: string[];

  @IsOptional() @IsBoolean()
  noIndex?: boolean;

  @IsOptional() @IsArray()
  relatedProductIds?: string[];
}