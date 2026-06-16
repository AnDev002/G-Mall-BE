import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// MIME whitelist dùng chung cho presign + validate phần mở rộng file.
export const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

// Allow-list folder: chỉ cho phép upload vào các thư mục đã định nghĩa, tránh
// path traversal / ghi đè key tuỳ ý.
export const ALLOWED_FOLDERS = ['products', 'avatars', 'banners', 'blogs'];

export class PresignDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(ALLOWED_MIMES, { message: 'Định dạng ảnh không hỗ trợ' })
  fileType: string;
}

export class UploadUrlDto extends PresignDto {
  @IsOptional()
  @IsString()
  @IsIn(ALLOWED_FOLDERS, { message: 'Thư mục không hợp lệ' })
  folder?: string;
}
