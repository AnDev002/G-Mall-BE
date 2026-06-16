import { IsOptional, IsString } from 'class-validator';

/**
 * Wiki 0082 fix-3: controller cũ dùng `@Body() any` cho PATCH :id nên ValidationPipe
 * không enforce type/whitelist (field rác lọt vào prisma.update). DTO này khai báo
 * shape rõ ràng → whitelist strip field lạ, type sai bị reject 400 ở boundary.
 * Tất cả field optional vì update là partial.
 */
export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  filterKeys?: any;
}
