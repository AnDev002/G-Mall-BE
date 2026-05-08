import { IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Fix B-NEW-5 (wiki 0029): controller cũ dùng `@Body() any` nên empty body
 * lọt qua tới service.create -> generateSlug(undefined) crash 500.
 * DTO này validate name bắt buộc -> ValidationPipe reject 400 ở boundary.
 */
export class CreateCategoryDto {
  @IsString()
  @MinLength(1, { message: 'Tên category là bắt buộc' })
  name: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  filterKeys?: any;
}
