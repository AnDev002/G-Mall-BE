import { IsString, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';

export class UpdateShopProfileDto {
  @IsOptional() // Để optional vì update có thể chỉ update 1 vài trường
  @IsString()
  @MinLength(3, { message: 'Tên Shop phải có ít nhất 3 ký tự' })
  @MaxLength(30, { message: 'Tên Shop tối đa 30 ký tự' })
  @Matches(
    /^[a-zA-Z0-9\sàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ_\-]+$/, 
    {
      message: 'Tên Shop không hợp lệ (cho phép chữ cái, số, khoảng trắng, gạch ngang, gạch dưới)',
    }
  )
  shopName?: string;

  @IsOptional()
  @IsString()
  pickupAddress?: string;

  // wiki 0108: `Shop.description` là kiểu `text` nên DB nhận thoải mái, nhưng form phía
  // người bán (Zod) chặn ở 500 ký tự — API thì không chặn gì. Ai gọi thẳng API sẽ lưu được
  // mô tả dài vô hạn, dài hơn cả thứ chính giao diện của họ cho phép sửa lại sau này.
  // Chốt cùng một con số ở cả hai đầu.
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Mô tả shop không được dài quá 500 ký tự' })
  description?: string;

  // --- CÁC TRƯỜNG ẢNH & GIẤY TỜ (Nhận URL string từ FE) ---
  
  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  cover?: string;

  @IsOptional()
  @IsString()
  businessLicenseFront?: string;

  @IsOptional()
  @IsString()
  businessLicenseBack?: string;

  @IsOptional()
  @IsString()
  salesLicense?: string;

  @IsOptional()
  @IsString()
  trademarkCert?: string;

  @IsOptional()
  @IsString()
  distributorCert?: string;
}