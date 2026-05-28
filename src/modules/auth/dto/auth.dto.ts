// src/auth/dto/auth.dto.ts
import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength, Length } from 'class-validator';

// Wiki 0064: MaxLength định nghĩa tường minh cho mọi field string —
// trước đây thiếu, 10KB name pass validation rồi crash Prisma (VARCHAR 255).
// Defense in depth: chặn ở DTO trước, BE không bao giờ thấy 500 từ DB.

export class RegisterDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty()
  @MaxLength(254) // RFC 5321 email length limit
  email: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  @MaxLength(128, { message: 'Mật khẩu không được dài quá 128 ký tự' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập họ tên' })
  @MaxLength(100, { message: 'Họ tên không được dài quá 100 ký tự' })
  name: string;
}

export class RegisterSellerDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  @MaxLength(128)
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập họ tên' })
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên Shop' })
  @MaxLength(150)
  shopName: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập số điện thoại' })
  @MaxLength(20)
  phoneNumber: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập địa chỉ lấy hàng' })
  @MaxLength(500)
  pickupAddress: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập Mã số thuế/CCCD' })
  @MaxLength(50)
  taxCode: string;
}

// Dùng cho Đăng nhập
export class LoginDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu' })
  password: string;
}

// Dùng cho Quên mật khẩu / Gửi lại OTP
export class SendOtpDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty()
  email: string;
}

// Dùng cho Xác thực OTP
export class VerifyOtpDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @Length(6, 6, { message: 'Mã OTP phải có 6 ký tự' })
  otp: string;
}