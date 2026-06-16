import { IsOptional, IsString } from 'class-validator';

/**
 * Wiki 0082 fix-3: batch-update cũ nhận `@Body() items: any[]` nên không có
 * validation — id thiếu / field rác / type sai đều lọt tới service.
 * DTO này validate từng item; controller dùng ParseArrayPipe({ items: ... })
 * (có sẵn trong @nestjs/common, không thêm package) để validate mảng top-level.
 */
export class UpdateCategoryBatchItemDto {
  @IsString()
  id!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}
