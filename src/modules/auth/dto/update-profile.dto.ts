import { IsOptional, IsString, MaxLength } from 'class-validator';

/** PUT /auth/profile — update buyer profile. Không đổi email/password ở đây. */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  gender?: string; // 'male' | 'female' | 'other' — schema chưa enum, nhận string free-form

  @IsOptional()
  @IsString()
  dob?: string; // ISO date string

  @IsOptional()
  @IsString()
  avatar?: string; // URL ảnh sau khi upload
}
