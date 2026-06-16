import { ArrayNotEmpty, IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ProductReviewItemDto {
  @IsNotEmpty()
  @IsString()
  productId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class SubmitOrderReviewDto {
  @IsNotEmpty()
  @IsString()
  orderId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  shopRating: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  shopComment?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ProductReviewItemDto)
  productReviews: ProductReviewItemDto[];
}