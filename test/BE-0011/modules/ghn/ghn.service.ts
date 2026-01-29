import { Injectable, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GhnService {
  private apiUrl: string;
  private token: string;
  private shopId: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    // Thêm dấu ! ở cuối và định nghĩa kiểu <string>
    this.apiUrl = this.configService.get<string>('GHN_API_URL')!;
    this.token = this.configService.get<string>('GHN_TOKEN')!;
    
    // Với shopId, nên fallback về 0 nếu không tìm thấy để tránh NaN
    this.shopId = Number(this.configService.get<string>('GHN_SHOP_ID')) || 0;
  }

  private getHeaders() {
    return {
      token: this.token,
      shop_id: this.shopId,
      'Content-Type': 'application/json',
    };
  }

  // 1. Tính phí vận chuyển
  async calculateFee(params: {
    toDistrictId: number;
    toWardCode: string;
    weight: number; // gram
    insuranceValue: number; // Giá trị đơn hàng để tính bảo hiểm
  }) {
    try {
      const url = `${this.apiUrl}/v2/shipping-order/fee`;
      const payload = {
        service_type_id: 2, // 2 = E-commerce Delivery (Chuẩn), hoặc gọi API get services để lấy động
        insurance_value: params.insuranceValue,
        coupon: null,
        from_district_id: 1454, // Ví dụ: Quận Thanh Xuân (Cấu hình cứng hoặc lấy từ Shop Setting)
        to_district_id: params.toDistrictId,
        to_ward_code: params.toWardCode,
        height: 10, length: 10, width: 10, // Kích thước hộp (nên tính toán dựa trên items)
        weight: params.weight,
      };

      const { data } = await firstValueFrom(
        this.httpService.post(url, payload, { headers: this.getHeaders() }),
      );

      return data.data.total; // Trả về tổng phí ship
    } catch (error) {
      console.error('GHN Fee Error:', error.response?.data || error.message);
      return 30000; // Fallback nếu lỗi (hoặc throw exception tùy business)
    }
  }

  // 2. Tạo đơn hàng trên GHN
  async createShippingOrder(orderData: any) {
    try {
        const url = `${this.apiUrl}/v2/shipping-order/create`;
        const { data } = await firstValueFrom(
            this.httpService.post(url, orderData, { headers: this.getHeaders() })
        );
        return data.data; // Chứa order_code, total_fee...
    } catch (error) {
        console.error('GHN Create Order Error:', error.response?.data || error.message);
        throw new BadRequestException('Không thể tạo đơn vận chuyển GHN: ' + JSON.stringify(error.response?.data));
    }
  }
}