import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

/**
 * wiki 0105 — ghi nhận một lượt bấm link tiếp thị.
 *
 * Chỉ nhận đúng `code`. IP và user-agent lấy từ chính request chứ KHÔNG nhận qua body:
 * để client tự khai IP thì mọi phép chống gian lận dựa trên IP đều thành vô nghĩa.
 */
export class RecordClickDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code: string;
}
