import { IsNotEmpty, IsString, IsEnum, IsEmail } from 'class-validator';

export class FriendRequestDto {
  @IsString()
  @IsNotEmpty()
  receiverId: string; // ID người muốn kết bạn
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
  @IsString()
  @IsNotEmpty()
  requestId: string; // ID của bản ghi Friendship

  @IsEnum(['ACCEPT', 'REJECT'])
  action: 'ACCEPT' | 'REJECT';
}