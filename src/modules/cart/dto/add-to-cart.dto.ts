import { IsNotEmpty, IsInt, IsString, Min, Max } from 'class-validator';

export class AddToCartDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  quantity: number;
}