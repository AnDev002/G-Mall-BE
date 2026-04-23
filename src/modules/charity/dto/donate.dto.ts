import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class DonateDto {
  @IsString()
  fundId: string;

  @IsNumber({}, { message: 'Số tiền donation phải là số' })
  @Min(1000, { message: 'Số tiền tối thiểu 1.000đ' })
  amount: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;
}
