import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// Mỗi seller "đặt lấy hàng" hàng loạt tối đa 50 đơn / lượt — GHN API cũng có
// giới hạn rate, chia batch ở FE nếu cần.
const BULK_MAX = 50;

export class BulkUpdateAddressItemDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsString()
  @IsNotEmpty()
  recipientAddress!: string;

  @IsInt()
  districtId!: number;

  @IsString()
  @IsNotEmpty()
  wardCode!: string;

  @IsOptional()
  @IsInt()
  provinceId?: number;

  @IsOptional()
  @IsString()
  recipientName?: string;

  @IsOptional()
  @IsString()
  recipientPhone?: string;
}

export class BulkUpdateAddressDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_MAX)
  @ValidateNested({ each: true })
  @Type(() => BulkUpdateAddressItemDto)
  items!: BulkUpdateAddressItemDto[];
}

export class BulkChangePickupDateDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_MAX)
  @IsString({ each: true })
  orderIds!: string[];

  // ISO date string — chỉ chấp nhận date trong tương lai (validate ở service).
  @IsDateString()
  pickupDate!: string;
}

export class BulkRequestPickupDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_MAX)
  @IsString({ each: true })
  orderIds!: string[];
}
