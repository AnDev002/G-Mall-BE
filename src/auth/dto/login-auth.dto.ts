// Backend/auth/dto/login-auth.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginAuthDto {
  @IsString()
  @IsNotEmpty()
  username: string; // SỬA: từ email sang username

  @IsString()
  @IsNotEmpty()
  password: string;
}