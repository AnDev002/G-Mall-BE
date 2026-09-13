import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * wiki 0105 — admin duyệt hồ sơ tiếp thị.
 *
 * CỐ Ý không cho quay về `PENDING`: hồ sơ đã xử lý mà bị đẩy ngược lại hàng chờ thì
 * mất dấu vết ai đã quyết định điều gì, và `reviewedById`/`reviewedAt` thành vô nghĩa.
 * Muốn dừng một người tiếp thị thì dùng `SUSPENDED`, đó mới là trạng thái đúng nghĩa.
 */
export class ReviewAffiliateDto {
  @IsIn(['APPROVED', 'REJECTED', 'SUSPENDED'])
  status!: 'APPROVED' | 'REJECTED' | 'SUSPENDED';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectReason?: string;
}
