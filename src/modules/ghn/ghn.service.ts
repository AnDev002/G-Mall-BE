import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from 'src/database/prisma/prisma.service';
import {
  BulkUpdateAddressDto,
  BulkChangePickupDateDto,
  BulkRequestPickupDto,
} from './dto/bulk-shipping.dto';

export interface BulkResult {
  orderId: string;
  ok: boolean;
  message?: string;
  shippingOrderCode?: string;
}

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
    private readonly prisma: PrismaService,
  ) {
    this.apiUrl = this.configService.get<string>('GHN_API_URL') || 'https://dev-online-gateway.ghn.vn/shiip/public-api';
    this.token = this.configService.get<string>('GHN_TOKEN')!;
    this.shopId = Number(this.configService.get<string>('GHN_SHOP_ID')) || 0;
  }

  // Có cấu hình GHN thật hay chưa — quyết định branch real-call vs mock.
  private hasRealCredentials(): boolean {
    return !!this.token && this.shopId > 0;
  }

  // Helper assert tất cả orderId thuộc về shop của seller (security: ngăn seller A
  // bulk-action lên đơn của seller B). Trả về danh sách order đầy đủ field cần.
  private async assertOrdersBelongToShop(orderIds: string[], shopId: string) {
    const orders = await this.prisma.order.findMany({
      where: { id: { in: orderIds }, shopId },
      select: {
        id: true,
        shippingOrderCode: true,
        recipientName: true,
        recipientPhone: true,
        recipientAddress: true,
        districtId: true,
        wardCode: true,
        provinceId: true,
        totalAmount: true,
        items: {
          select: {
            quantity: true,
            price: true,
            product: { select: { name: true, weight: true } },
          },
        },
      },
    });
    if (orders.length !== orderIds.length) {
      const found = new Set(orders.map(o => o.id));
      const missing = orderIds.filter(id => !found.has(id));
      throw new NotFoundException(
        `Không tìm thấy hoặc không có quyền với đơn: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}`,
      );
    }
    return orders;
  }

  private getHeaders() {
    // GHN docs (api.ghn.vn id=63/82): header BẮT BUỘC `Token` + `ShopId` (PascalCase).
    // Wiki 0078: trước gửi `shop_id` (snake_case) → GHN coi như THIẾU ShopId →
    // fee/leadtime/create-order lỗi. (`shop_id` != `ShopId` dù header case-insensitive.)
    return {
      Token: this.token,
      ShopId: this.shopId,
      'Content-Type': 'application/json',
    };
  }

  // [FIX] Lấy service_id an toàn nhất
  async getServiceId(toDistrictId: number, fromDistrictId: number, weight: number) {
    try {
        const url = `${this.apiUrl}/v2/shipping-order/available-services`;
        const payload = {
            shop_id: this.shopId,
            from_district: fromDistrictId, 
            to_district: toDistrictId,
            weight: weight || 200 // Truyền weight để GHN lọc gói phù hợp
        };

        const { data } = await firstValueFrom(
            this.httpService.post(url, payload, { headers: { token: this.token } }) 
        );

        if (!data.data || data.data.length === 0) {
            return null;
        }

        // [QUAN TRỌNG] Tìm gói E-Commerce (service_type_id = 2)
        // Gói thường (Standard) hoặc Thương mại điện tử
        const ecommerceService = data.data.find((s: any) => s.service_type_id === 2);
        
        // Nếu có gói chuẩn thì dùng, không thì mới fallback về cái đầu tiên
        return ecommerceService ? ecommerceService.service_id : data.data[0].service_id; 

    } catch (error: any) {
        this.logger.error(`Get Service Error: ${JSON.stringify(error.response?.data || error.message)}`);
        return null; 
    }
  }

  // [FIX 2] Truyền weight vào getServiceId
  async calculateFee(params: {
    toDistrictId: number;
    toWardCode: string;
    weight: number;
    insuranceValue: number;
  }) {
    try {
      // Gọi getServiceId với cân nặng thực tế
      const serviceId = await this.getServiceId(
          params.toDistrictId, 
          this.defaultFromDistrictId, 
          params.weight
      );
      
      if (!serviceId) {
          this.logger.warn(`Không tìm thấy gói vận chuyển cho tuyến ${this.defaultFromDistrictId} -> ${params.toDistrictId}`);
          return 30000; 
      }

      // Gọi API tính phí
      const url = `${this.apiUrl}/v2/shipping-order/fee`;
      const payload = {
        service_id: serviceId,
        insurance_value: params.insuranceValue,
        coupon: null,
        from_district_id: this.defaultFromDistrictId,
        to_district_id: params.toDistrictId,
        to_ward_code: params.toWardCode,
        height: 10, length: 10, width: 10, 
        weight: params.weight,
      };

      const { data } = await firstValueFrom(
        this.httpService.post(url, payload, { headers: this.getHeaders() }),
      );

      return data.data.total; 
    } catch (error: any) {
      // Log lỗi chi tiết để debug nếu cần
      // console.log('GHN Fee Error Detail:', JSON.stringify(error.response?.data));
      this.logger.error(`GHN Fee Error: ${JSON.stringify(error.response?.data || error.message)}`);
      return 30000; 
    }
  }

  // 2. Tính thời gian giao hàng (Lead Time)
  async calculateExpectedDeliveryTime(params: { toDistrictId: number; toWardCode: string }) {
    try {
      // Mặc định truyền 200g để lấy thời gian ước tính
      const serviceId = await this.getServiceId(params.toDistrictId, this.defaultFromDistrictId, 200);
      if (!serviceId) return null;

      const url = `${this.apiUrl}/v2/shipping-order/leadtime`;
      const payload = {
        from_district_id: this.defaultFromDistrictId,
        from_ward_code: "20314", 
        to_district_id: params.toDistrictId,
        to_ward_code: params.toWardCode,
        service_id: serviceId, 
      };

      const { data } = await firstValueFrom(
        this.httpService.post(url, payload, { headers: this.getHeaders() }),
      );

      return data.data.leadtime; 
    } catch (error: any) {
      return Math.floor(Date.now() / 1000) + 3 * 24 * 60 * 60; 
    }
  }

  // [FIX 3] Truyền weight vào khi tạo đơn thật
  async createShippingOrder(orderData: any) {
    // Spec wiki 0064: STUB-by-default. Có GHN_TOKEN + GHN_SHOP_ID → gọi GHN thật;
    // chưa cấu hình → fallback MOCK ở cuối hàm (cho dev/staging). Wiki 0076: bỏ
    // comment khối real-call (trước đây bị /* */ nên LUÔN trả mock dù đã có key).
    if (this.hasRealCredentials()) {
    try {
        const totalWeight = orderData.weight || 200;
        const serviceId = await this.getServiceId(
            orderData.to_district_id, 
            this.defaultFromDistrictId,
            totalWeight
        );
        
        const url = `${this.apiUrl}/v2/shipping-order/create`;
        const payload = {
            ...orderData,
            payment_type_id: 2, 
            required_note: 'CHOXEMHANGKHONGTHU',
            service_id: serviceId || 53320, 
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

    // --- FALLBACK MOCK (chưa cấu hình GHN_TOKEN/GHN_SHOP_ID — dev/staging) ---
    this.logger.warn(`[MOCK GHN] Chưa cấu hình GHN_TOKEN/GHN_SHOP_ID → giả lập đơn cho: ${orderData.to_name}`);
    
    // Trả về dữ liệu giả giống hệt cấu trúc GHN trả về thật
    // Để OrderService không bị lỗi khi đọc 'order_code' hay 'total_fee'
    return {
        order_code: 'MOCK_GHN_' + Date.now(), // Mã đơn giả: MOCK_GHN_17000000...
        total_fee: 35000, // Phí ship giả định
        expected_delivery_time: new Date().toISOString(),
        status: 'ready_to_pick',
        // Thêm các trường khác nếu cần
    };
  }

  async getProvinces() {
    try {
      const url = `${this.apiUrl}/master-data/province`;
      const { data } = await firstValueFrom(
        this.httpService.get(url, { headers: { token: this.token } })
      );
      return data.data; // Trả về mảng [{ ProvinceID, ProvinceName, ... }]
    } catch (error) {
      console.error('Lỗi lấy Tỉnh/Thành GHN:', error?.response?.data || error.message);
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
      console.error(`Lỗi lấy Quận/Huyện (Province: ${provinceId}):`, error?.response?.data || error.message);
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
      console.error(`Lỗi lấy Phường/Xã (District: ${districtId}):`, error?.response?.data || error.message);
      return [];
    }
  }

  // =====================================================================
  // BULK SHIPPING OPERATIONS (audit 0053 Seller #1, #2)
  // Pattern: mỗi method trả về `BulkResult[]` — FE hiển thị progress per-order
  // và biết đơn nào fail. Không throw aggregate error vì 1 đơn lỗi không nên
  // chặn 49 đơn còn lại.
  // =====================================================================

  // 1. SỬA ĐỊA CHỈ HÀNG LOẠT.
  // DB write trong transaction; GHN call best-effort (nếu shippingOrderCode đã có).
  async bulkUpdateAddress(shopId: string, dto: BulkUpdateAddressDto): Promise<BulkResult[]> {
    const ids = dto.items.map(i => i.orderId);
    const orders = await this.assertOrdersBelongToShop(ids, shopId);
    const orderMap = new Map(orders.map(o => [o.id, o]));

    const results: BulkResult[] = [];
    for (const item of dto.items) {
      const order = orderMap.get(item.orderId)!;
      try {
        // 1a. Cập nhật DB
        await this.prisma.order.update({
          where: { id: item.orderId },
          data: {
            recipientAddress: item.recipientAddress,
            districtId: item.districtId,
            wardCode: item.wardCode,
            ...(item.provinceId ? { provinceId: item.provinceId } : {}),
            ...(item.recipientName ? { recipientName: item.recipientName } : {}),
            ...(item.recipientPhone ? { recipientPhone: item.recipientPhone } : {}),
          },
        });

        // 1b. Nếu đã có shippingOrderCode → gọi GHN update (best-effort, không
        // rollback DB nếu GHN fail — local là source of truth, GHN sync async).
        if (order.shippingOrderCode && this.hasRealCredentials()) {
          try {
            const url = `${this.apiUrl}/v2/shipping-order/update`;
            const payload = {
              order_code: order.shippingOrderCode,
              to_name: item.recipientName || order.recipientName,
              to_phone: item.recipientPhone || order.recipientPhone,
              to_address: item.recipientAddress,
              to_ward_code: item.wardCode,
              to_district_id: item.districtId,
            };
            await firstValueFrom(this.httpService.post(url, payload, { headers: this.getHeaders() }));
          } catch (ghnErr: any) {
            this.logger.warn(`[GHN sync] update address fail orderId=${item.orderId}: ${ghnErr.message}`);
          }
        }
        results.push({ orderId: item.orderId, ok: true });
      } catch (err: any) {
        results.push({ orderId: item.orderId, ok: false, message: err.message });
      }
    }
    return results;
  }

  // 2. ĐỔI NGÀY LẤY HÀNG HÀNG LOẠT.
  // GHN gọi update với `pick_time` (Unix timestamp). Vì BE chưa persist pickupDate,
  // chỉ gọi GHN API; nếu chưa có shippingOrderCode → bỏ qua (đơn mới chưa giao GHN).
  async bulkChangePickupDate(shopId: string, dto: BulkChangePickupDateDto): Promise<BulkResult[]> {
    const pickupTs = Math.floor(new Date(dto.pickupDate).getTime() / 1000);
    const nowTs = Math.floor(Date.now() / 1000);
    if (pickupTs <= nowTs) {
      throw new BadRequestException('Ngày lấy hàng phải trong tương lai');
    }

    const orders = await this.assertOrdersBelongToShop(dto.orderIds, shopId);
    const results: BulkResult[] = [];

    for (const order of orders) {
      try {
        if (!order.shippingOrderCode) {
          results.push({
            orderId: order.id,
            ok: false,
            message: 'Đơn chưa được tạo phiếu GHN — bấm "Yêu cầu lấy hàng" trước',
          });
          continue;
        }

        if (!this.hasRealCredentials()) {
          // MOCK: log + giả lập thành công cho dev / staging.
          this.logger.log(`[MOCK GHN] bulkChangePickupDate orderId=${order.id} → ${dto.pickupDate}`);
          results.push({ orderId: order.id, ok: true, message: '(mock) Cập nhật thành công' });
          continue;
        }

        const url = `${this.apiUrl}/v2/shipping-order/update`;
        const payload = {
          order_code: order.shippingOrderCode,
          pick_time: pickupTs,
        };
        const { data } = await firstValueFrom(
          this.httpService.post(url, payload, { headers: this.getHeaders() }),
        );
        if (data?.code === 200 || data?.message === 'Success') {
          results.push({ orderId: order.id, ok: true });
        } else {
          results.push({ orderId: order.id, ok: false, message: data?.message || 'GHN từ chối' });
        }
      } catch (err: any) {
        const ghnMsg = err?.response?.data?.message || err.message;
        results.push({ orderId: order.id, ok: false, message: ghnMsg });
      }
    }
    return results;
  }

  // 3. YÊU CẦU ĐƠN VỊ VẬN CHUYỂN ĐẾN LẤY HÀNG HÀNG LOẠT.
  // Mỗi đơn chưa có shippingOrderCode → gọi createShippingOrder. Persist code
  // vào DB. Skip đơn đã có code.
  async bulkRequestPickup(shopId: string, dto: BulkRequestPickupDto): Promise<BulkResult[]> {
    const orders = await this.assertOrdersBelongToShop(dto.orderIds, shopId);
    const results: BulkResult[] = [];

    for (const order of orders) {
      try {
        if (order.shippingOrderCode) {
          results.push({
            orderId: order.id,
            ok: true,
            shippingOrderCode: order.shippingOrderCode,
            message: 'Đã có phiếu GHN, bỏ qua',
          });
          continue;
        }
        if (!order.districtId || !order.wardCode) {
          results.push({
            orderId: order.id,
            ok: false,
            message: 'Đơn thiếu địa chỉ giao (districtId/wardCode)',
          });
          continue;
        }

        const weight = order.items.reduce(
          (acc, it) => acc + (Number(it.product?.weight) || 200) * it.quantity,
          0,
        );

        const ghnPayload = {
          to_name: order.recipientName,
          to_phone: order.recipientPhone,
          to_address: order.recipientAddress,
          to_district_id: order.districtId,
          to_ward_code: order.wardCode,
          cod_amount: Math.floor(Number(order.totalAmount)),
          weight,
          items: order.items.map(it => ({
            name: it.product?.name || 'SP',
            quantity: it.quantity,
            price: Number(it.price),
            weight: Number(it.product?.weight) || 200,
          })),
        };

        const ghnResp = await this.createShippingOrder(ghnPayload);
        const code = ghnResp?.order_code;
        if (code) {
          await this.prisma.order.update({
            where: { id: order.id },
            data: { shippingOrderCode: code, status: 'CONFIRMED' },
          });
          results.push({ orderId: order.id, ok: true, shippingOrderCode: code });
        } else {
          results.push({ orderId: order.id, ok: false, message: 'GHN không trả về mã đơn' });
        }
      } catch (err: any) {
        results.push({ orderId: order.id, ok: false, message: err.message });
      }
    }
    return results;
  }
}