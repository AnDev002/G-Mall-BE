// Backend/user/dto/create-user.dto.ts
import { IsNotEmpty, MinLength, IsString, IsEnum, IsOptional } from 'class-validator';

enum RoleDto {
  Admin = 'Admin',
  Donor = 'Donor',
}

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @IsEnum(RoleDto)
  @IsNotEmpty()
  role: RoleDto;
  
  // Trường 'name' đã bị xóa vì nó không tồn tại trong schema Prisma (Lỗi 4)
}