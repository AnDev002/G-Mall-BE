import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';
import { IsEnum, IsNumber, IsOptional, IsDateString, IsBoolean, Min, Max, IsString, IsIn, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum DiscountType {
  PERCENT = 'PERCENT',
}
export class ProductVariantDiscountDto {
  @ApiProperty()
  @IsString()
  id: string; // Cần ID để tìm variant trong DB

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100) // Wiki 0082: chặn giảm > 100% → giá âm
  discountValue: number; // % giảm giá
}
export class UpdateProductDiscountDto {
  @ApiProperty()
  @IsEnum(DiscountType)
  @IsOptional()
  discountType: DiscountType;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100) // Wiki 0082: chặn giảm > 100% → giá âm
  @IsOptional()
  discountValue: number;

  @ApiProperty()
  @IsDateString()
  @IsOptional()
  discountStartDate: string;

  @ApiProperty()
  @IsDateString()
  @IsOptional()
  discountEndDate: string;

  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  isDiscountActive: boolean;

  @ApiProperty({ type: [ProductVariantDiscountDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDiscountDto)
  variants: ProductVariantDiscountDto[];
}


// wiki 0108: bỏ `status` thừa hưởng từ CreateProductDto rồi khai lại rộng hơn.
// Không thể ghi đè trực tiếp vì TS coi đó là thu hẹp kiểu không tương thích.
export class UpdateProductDto extends PartialType(OmitType(CreateProductDto, ['status'] as const)) {
  /**
   * wiki 0108 — cho phép người bán TỰ ẨN sản phẩm.
   *
   * `CreateProductDto.status` khai `@IsIn(['DRAFT','PENDING'])`, và lớp này kế thừa qua
   * `PartialType` nên `PATCH /seller/products/:id` với `status: 'HIDDEN'` bị 400
   * "status must be one of DRAFT, PENDING". Kết quả: giao diện người bán CÓ tab
   * "Chưa được đăng" ứng với `HIDDEN` nhưng không có đường nào đưa sản phẩm vào đó —
   * người bán không tạm ẩn được hàng (hết hàng, sai giá, đang sửa ảnh...).
   *
   * Chính schema đã ghi `HIDDEN // Seller tự ẩn` — tức là thiết kế vốn có ý cho phép.
   *
   * VẪN KHÔNG cho `ACTIVE` và `REJECTED`: đó là quyền của admin. Người bán tự đặt
   * `ACTIVE` sẽ vượt mặt vòng duyệt.
   */
  @IsOptional()
  @IsString()
  @IsIn(['DRAFT', 'PENDING', 'HIDDEN'])
  status?: 'DRAFT' | 'PENDING' | 'HIDDEN';

  /**
   * wiki 0095 B3 — cờ opt-in: "tiers/variations trong payload này là ĐẦY ĐỦ và
   * cố ý, hãy ghi đè phân loại của sản phẩm".
   *
   * Bắt buộc phải có cờ vì ValidationPipe chạy `whitelist: true` và vì client CŨ
   * luôn gửi `tiers: []` (form sửa không prefill được) — không có cờ thì một cú
   * bấm Lưu từ bản FE cũ sẽ xoá sạch SKU của sản phẩm.
   */
  @IsOptional()
  @IsBoolean()
  syncVariants?: boolean;
}
/**
 * wiki 0105 — seller bật/tắt affiliate và đặt % hoa hồng cho MỘT sản phẩm.
 *
 * `rate` là tỉ lệ THẬP PHÂN (0.05 = 5%), không phải số phần trăm — giao diện nhập
 * theo % rồi chia 100 trước khi gửi. Trần thật kiểm ở service vì nó đọc từ
 * SystemSetting (`AFFILIATE_MAX_RATE`), DTO không với tới được.
 */
export class UpdateProductAffiliateDto {
  @ApiProperty({ description: 'Bật hay tắt tiếp thị liên kết cho sản phẩm này' })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({ required: false, description: 'Tỉ lệ hoa hồng dạng thập phân, ví dụ 0.05 = 5%' })
  @IsOptional()
  @IsNumber()
  rate?: number;
}
