import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^0\d{9,10}$/, { message: 'Số điện thoại không hợp lệ' })
  phone: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  specificAddress: string;

  @IsInt()
  @IsNotEmpty()
  provinceId: number;

  @IsInt()
  @IsNotEmpty()
  districtId: number;

  @IsString()
  @IsNotEmpty()
  wardCode: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto extends CreateAddressDto {}