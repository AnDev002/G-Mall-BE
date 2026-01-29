import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GhnService {
  private readonly logger = new Logger(GhnService.name);
  private apiUrl: string;
  private token: string;
  private shopId: number;
  private defaultFromDistrictId = 1454; // Quận Thanh Xuân, Hà Nội (Đảm bảo ID này đúng với cấu hình shop của bạn)

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl = this.configService.get<string>('GHN_API_URL') || 'https://dev-online-gateway.ghn.vn/shiip/public-api';
    this.token = this.configService.get<string>('GHN_TOKEN')!;
    this.shopId = Number(this.configService.get<string>('GHN_SHOP_ID')) || 0;
  }

  private getHeaders() {
    return {
      token: this.token,
      shop_id: this.shopId,
      'Content-Type': 'application/json',
    };
  }

  // [FIX] Lấy service_id an toàn nhất
  async getServiceId(toDistrictId: number, fromDistrictId: number) {
    try {
        const url = `${this.apiUrl}/v2/shipping-order/available-services`;
        const payload = {
            shop_id: this.shopId,
            from_district: fromDistrictId, // 1454
            to_district: toDistrictId
        };

        const { data } = await firstValueFrom(
            this.httpService.post(url, payload, { headers: { token: this.token } }) 
        );
        
        // Log danh sách service tìm được để debug
        // this.logger.log(`GHN Services [${fromDistrictId}->${toDistrictId}]: ${JSON.stringify(data.data)}`);

        if (!data.data || data.data.length === 0) {
            return null;
        }

        // [QUAN TRỌNG] Ưu tiên lấy gói dịch vụ thường (ID 53320, 53321...) thay vì gói Hỏa tốc (nếu test xa)
        // Logic: Lấy gói đầu tiên trong danh sách (thường là gói phù hợp nhất)
        return data.data[0].service_id; 

    } catch (error: any) {
        this.logger.error(`Get Service Error: ${JSON.stringify(error.response?.data || error.message)}`);
        return null; 
    }
  }

  // 1. Tính phí vận chuyển
  async calculateFee(params: {
    toDistrictId: number;
    toWardCode: string;
    weight: number;
    insuranceValue: number;
  }) {
    try {
      // Bước 1: Lấy Service ID phù hợp cho tuyến đường này
      const serviceId = await this.getServiceId(params.toDistrictId, this.defaultFromDistrictId);
      
      if (!serviceId) {
          this.logger.warn(`Không tìm thấy gói vận chuyển cho tuyến ${this.defaultFromDistrictId} -> ${params.toDistrictId}`);
          return 30000; // Fallback fee
      }

      // Bước 2: Gọi API tính phí
      const url = `${this.apiUrl}/v2/shipping-order/fee`;
      const payload = {
        service_id: serviceId, // Dùng ID động vừa lấy
        insurance_value: params.insuranceValue,
        coupon: null,
        from_district_id: this.defaultFromDistrictId,
        to_district_id: params.toDistrictId,
        to_ward_code: params.toWardCode,
        height: 10, length: 10, width: 10, 
        weight: params.weight,
      };

      // Debug Payload nếu vẫn lỗi
      // console.log('GHN Calc Fee Payload:', JSON.stringify(payload));

      const { data } = await firstValueFrom(
        this.httpService.post(url, payload, { headers: this.getHeaders() }),
      );

      return data.data.total; 
    } catch (error: any) {
      this.logger.error(`GHN Fee Error: ${JSON.stringify(error.response?.data || error.message)}`);
      return 30000; // Fallback
    }
  }

  // 2. Tính thời gian giao hàng (Lead Time)
  async calculateExpectedDeliveryTime(params: { toDistrictId: number; toWardCode: string }) {
    try {
      const serviceId = await this.getServiceId(params.toDistrictId, this.defaultFromDistrictId);
      if (!serviceId) return null;

      const url = `${this.apiUrl}/v2/shipping-order/leadtime`;
      const payload = {
        from_district_id: this.defaultFromDistrictId,
        from_ward_code: "20314", // Mã phường của shop (Thanh Xuân Trung)
        to_district_id: params.toDistrictId,
        to_ward_code: params.toWardCode,
        service_id: serviceId, 
      };

      const { data } = await firstValueFrom(
        this.httpService.post(url, payload, { headers: this.getHeaders() }),
      );

      return data.data.leadtime; 
    } catch (error: any) {
      this.logger.error(`GHN LeadTime Error: ${JSON.stringify(error.response?.data || error.message)}`);
      return Math.floor(Date.now() / 1000) + 3 * 24 * 60 * 60; // Fallback 3 ngày
    }
  }

  // 3. Tạo đơn hàng (Dùng khi checkout)
  async createShippingOrder(orderData: any) {
    // Lưu ý: Cần bổ sung logic getServiceId tương tự như trên vào đây
    // để đảm bảo khi tạo đơn không bị lỗi route not found
    try {
        const serviceId = await this.getServiceId(orderData.to_district_id, this.defaultFromDistrictId);
        
        const url = `${this.apiUrl}/v2/shipping-order/create`;
        const payload = {
            ...orderData,
            payment_type_id: 2, 
            required_note: 'CHOXEMHANGKHONGTHU',
            service_id: serviceId || 53320, // Fallback nếu không tìm thấy
            from_district_id: this.defaultFromDistrictId,
        };

        const { data } = await firstValueFrom(
            this.httpService.post(url, payload, { headers: this.getHeaders() })
        );
        return data.data; 
    } catch (error: any) {
        this.logger.error('GHN Create Order Error:', error.response?.data || error.message);
        throw new BadRequestException('Không thể tạo đơn vận chuyển GHN');
    }
  }

  async getProvinces() {
    try {
      const url = `${this.apiUrl}/master-data/province`;
      const { data } = await firstValueFrom(
        this.httpService.get(url, { headers: { token: this.token } })
      );
      return data.data; // Trả về mảng [{ ProvinceID, ProvinceName, ... }]
    } catch (error) {
      return [];
    }
  }

  // 5. Lấy danh sách Quận/Huyện theo Tỉnh
  async getDistricts(provinceId: number) {
    try {
      const url = `${this.apiUrl}/master-data/district`;
      const { data } = await firstValueFrom(
        this.httpService.post(url, { province_id: provinceId }, { headers: { token: this.token } })
      );
      return data.data; // Trả về mảng [{ DistrictID, DistrictName, ... }]
    } catch (error) {
      return [];
    }
  }

  // 6. Lấy danh sách Phường/Xã theo Quận
  async getWards(districtId: number) {
    try {
      const url = `${this.apiUrl}/master-data/ward?district_id=${districtId}`;
      const { data } = await firstValueFrom(
        this.httpService.get(url, { headers: { token: this.token } })
      );
      return data.data; // Trả về mảng [{ WardCode, WardName, ... }]
    } catch (error) {
      return [];
    }
  }
}