import { ArrayNotEmpty, IsArray, IsInt, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// Wiki 0039 BUG-BLOG-1: trước đây controller nhận `body: { items: ... }` raw,
// nếu thiếu items hoặc không phải array → 500 ở `items.map`. Dùng DTO + ValidationPipe
// → 400 đúng REST khi shape sai.
export class ReorderBlogItemDto {
  @IsString()
  id!: string;

  @IsInt()
  sortOrder!: number;
}

export class ReorderBlogDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ReorderBlogItemDto)
  items!: ReorderBlogItemDto[];
}
