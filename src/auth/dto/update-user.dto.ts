// Backend/user/dto/update-user.dto.ts
import { IsString, IsEnum, IsOptional, MinLength } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

// Lấy tất cả trừ password
class UpdateUserFields extends PartialType(CreateUserDto) {
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}

export class UpdateUserDto extends UpdateUserFields {}