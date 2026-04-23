import { IsEnum, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { CharityFundStatus } from '@prisma/client';

export class CreateFundDto {
  @IsString()
  @MinLength(3, { message: 'Tên quỹ tối thiểu 3 ký tự' })
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Mục tiêu quỹ phải là số' })
  @Min(0)
  goalAmount?: number;
}

export class UpdateFundDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  goalAmount?: number;

  @IsOptional()
  @IsEnum(CharityFundStatus)
  status?: CharityFundStatus;
}
