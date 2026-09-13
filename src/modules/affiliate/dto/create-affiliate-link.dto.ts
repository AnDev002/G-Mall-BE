import { IsString, IsNotEmpty } from 'class-validator';

/** wiki 0105 — lấy (hoặc tạo) link tiếp thị cho một sản phẩm. */
export class CreateAffiliateLinkDto {
  @IsString()
  @IsNotEmpty({ message: 'Thiếu mã sản phẩm.' })
  productId: string;
}
