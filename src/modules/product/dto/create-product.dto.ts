// BE-1.7/modules/product/dto/create-product.dto.ts
import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max, IsPositive, IsArray, ArrayUnique, ValidateNested, IsJSON, IsObject, MaxLength, IsIn } from 'class-validator';
import { Transform, Type } from 'class-transformer';

// Spec [0018]: Mô tả ngắn — block 6 fields hiển thị nhanh trên trang SP.
// Lưu thành Json trong Product.shortDesc. Tất cả optional, MaxLength tránh spam.
export class ShortDescDto {
  @IsOptional() @IsString() @MaxLength(200) brand?: string;
  @IsOptional() @IsString() @MaxLength(300) features?: string;
  @IsOptional() @IsString() @MaxLength(300) benefits?: string;
  @IsOptional() @IsString() @MaxLength(150) recipient?: string;
  @IsOptional() @IsString() @MaxLength(150) occasion?: string;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

// DTO cho nhóm phân loại (VD: Màu sắc -> [Đỏ, Xanh])
export class ProductTierDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  // wiki 0108: chặn hai lựa chọn TRÙNG TÊN trong cùng một phân loại. Trước đây
  // `tiers: [{ name: 'Màu', options: ['Đỏ', 'Đỏ'] }]` được nhận (201), và người mua nhìn
  // thấy hai ô "Đỏ" y hệt nhau trên trang sản phẩm — không cách nào biết chúng khác gì,
  // mà mỗi ô lại trỏ tới một SKU khác nhau với tồn kho và giá riêng.
  // So sánh sau khi cắt khoảng trắng và bỏ phân biệt hoa/thường: "Đỏ", "đỏ " là một.
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique((o: string) => String(o).trim().toLowerCase(), {
    message: 'Các lựa chọn trong cùng một phân loại không được trùng tên',
  })
  options: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}

// DTO cho từng biến thể SKU (VD: Màu Đỏ - Size S)
export class ProductVariantDto {
  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(0)
  stock: number;

  @IsOptional()
  @IsString()
  sku?: string;

  // [FIX] Thêm trường này để fix lỗi property 'imageUrl' does not exist
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsArray()
  @IsNumber({}, { each: true })
  tierIndex: number[]; // [0, 0] -> Option 0 của Tier 1 + Option 0 của Tier 2
}

export class CreateProductDto {
  // Trạng thái khi seller tạo: 'DRAFT' (lưu nháp, không gửi duyệt) hoặc
  // bỏ qua → BE để default 'PENDING'. Audit Seller #18 wiki 0061.
  @IsOptional()
  @IsString()
  @IsIn(['DRAFT', 'PENDING'])
  status?: 'DRAFT' | 'PENDING';

  // --- Cơ bản ---
  // wiki 0108: `@IsNotEmpty()` KHÔNG chặn chuỗi toàn khoảng trắng — `"   "` lọt qua và
  // tạo ra sản phẩm không tên (slug thành `----1787032643`), nằm giữa danh sách shop mà
  // không ai đọc được đó là gì. Cắt khoảng trắng TRƯỚC khi kiểm để `"   "` trở thành `""`
  // rồi bị `@IsNotEmpty()` bắt.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Tên sản phẩm không được để trống' })
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  categoryId: string;

  // wiki 0108: chặn giá vượt sức chứa của cột. `Product.price` là `decimal(65,30)` —
  // phần thập phân 30 chữ số nên phần nguyên chỉ còn 35 chữ số, và Prisma ném lỗi
  // "value out of range" thành 500 trước khi tới được DB. Đo trên prod: `price: 1e15`
  // → 500 "Lỗi xử lý dữ liệu". Một tỉ tỉ đồng cho một món quà là vô nghĩa, nên chặn ở
  // mức 1e12 (1 nghìn tỉ) — thừa sức cho mọi hàng hoá thật mà vẫn là 400 tử tế.
  @IsNumber()
  @IsPositive()
  @Max(1_000_000_000_000, { message: 'Giá sản phẩm vượt quá mức cho phép' })
  price: number; // Giá hiển thị mặc định

  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsString()
  brand?: string;

  // [NEW] Relation ID
  @IsOptional()
  @IsNumber()
  @IsPositive()
  brandId?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  // [round14 review-FIX] BỎ @IsUrl ở DTO (review MEDIUM): R2_PUBLIC_DOMAIN có thể cấu hình KHÔNG kèm
  // scheme → fileUrl schemeless → @IsUrl 400 chặn oan tạo/sửa sản phẩm. Hơn nữa @IsUrl KHÔNG thật sự
  // chặn SSRF (IP literal vẫn pass). Phòng SSRF THẬT nằm ở indexer.processor isAllowedImageUrl (validate
  // scheme http/https + chặn private/loopback/link-local IP + hostname đơn-nhãn nội bộ) — giữ ở đó,
  // DTO chỉ cần @IsString. (Lưu ý: chưa resolve DNS → DNS-rebinding là hardening tách riêng.)
  images?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  videos?: string[]; // Mảng URL video

  @IsOptional()
  @IsString()
  sizeChart?: string; // URL ảnh hoặc HTML

  // --- Chi tiết & SEO (Thương hiệu, Xuất xứ...) ---

  @IsOptional()
  @IsString()
  origin?: string; // Xuất xứ

  @IsOptional()
  @IsJSON() 
  attributes?: any; // Lưu JSON các thuộc tính khác (Chất liệu, Kiểu dáng...)

  // --- Vận chuyển (Giao diện Shopee bắt buộc nhập) ---
  @IsNumber()
  @Min(0)
  weight: number; // Gram

  @IsNumber()
  @Min(0)
  length: number; // cm

  @IsNumber()
  @Min(0)
  width: number; // cm

  @IsNumber()
  @Min(0)
  height: number; // cm

  // --- Phân loại hàng (Logic 2 cấp) ---
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductTierDto)
  tiers?: ProductTierDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variations?: ProductVariantDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  crossSellIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  systemTags?: string[];

  // Spec [0018]: 6-fields mô tả ngắn
  @IsOptional()
  @ValidateNested()
  @Type(() => ShortDescDto)
  shortDesc?: ShortDescDto;
}