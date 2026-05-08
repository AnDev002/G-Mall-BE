import { IsNotEmpty, IsString, IsEnum, IsEmail, IsUUID } from 'class-validator';

export class FriendRequestDto {
  // Fix B-NEW-10/11 (wiki 0027): @IsUUID strict format check để tránh số hoặc
  // string ngắn lọt qua tới Prisma -> 500 crash. @IsString cũ cho phép cả number
  // (vì global ValidationPipe có enableImplicitConversion).
  @IsUUID('all', { message: 'receiverId phải là UUID hợp lệ' })
  @IsNotEmpty()
  receiverId: string;
}
export class InviteByEmailDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Vui lòng nhập email' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập lời nhắn' })
  message: string;
}
export class HandleRequestDto {
  @IsUUID('all', { message: 'requestId phải là UUID hợp lệ' })
  @IsNotEmpty()
  requestId: string;

  @IsEnum(['ACCEPT', 'REJECT'])
  action: 'ACCEPT' | 'REJECT';
}