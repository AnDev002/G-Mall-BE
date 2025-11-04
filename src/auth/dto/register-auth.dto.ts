// Backend/auth/dto/register-auth.dto.ts
import { IsNotEmpty, MinLength, IsString, IsEnum, IsOptional } from 'class-validator';

enum RoleDto {
  Admin = 'Admin',
  Donor = 'Donor',
}

export class RegisterAuthDto {
  // @IsString() // <-- SỬA: Xóa trường 'name'
  // @IsNotEmpty()
  // name: string; 

  @IsString()
  @IsNotEmpty()
  username: string; 

  @IsNotEmpty()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @IsEnum(RoleDto)
  @IsOptional()
  role?: RoleDto;
}