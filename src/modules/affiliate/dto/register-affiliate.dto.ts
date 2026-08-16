import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * wiki 0105 — đăng ký tham gia chương trình tiếp thị liên kết.
 *
 * Cả hai trường đều không bắt buộc: rào cản càng thấp thì càng nhiều người đăng ký,
 * còn việc lọc người xấu đã có admin duyệt ở bước sau. Chúng chỉ tồn tại để admin có
 * căn cứ quyết định chứ không phải để chặn.
 */
export class RegisterAffiliateDto {
  /** Kênh chia sẻ tự khai (Facebook / TikTok / Zalo…). */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  channel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
