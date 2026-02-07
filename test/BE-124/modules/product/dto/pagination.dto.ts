// BE/product/dto/pagination.dto.ts
import { IsOptional, IsInt, Min, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}
export class FindAllPublicDto extends PaginationDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsString()
    categorySlug?: string;

    @IsOptional()
    @IsString()
    sort?: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    minPrice?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    maxPrice?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    rating?: number;

    @IsOptional()
    @IsString()
    tag?: string; // [QUAN TRỌNG] Thêm trường này
}