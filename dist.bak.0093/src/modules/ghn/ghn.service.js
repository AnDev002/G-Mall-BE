"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var GhnService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GhnService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const config_1 = require("@nestjs/config");
const rxjs_1 = require("rxjs");
const prisma_service_1 = require("../../database/prisma/prisma.service");
let GhnService = GhnService_1 = class GhnService {
    httpService;
    configService;
    prisma;
    logger = new common_1.Logger(GhnService_1.name);
    apiUrl;
    token;
    shopId;
    defaultFromDistrictId = 1454;
    constructor(httpService, configService, prisma) {
        this.httpService = httpService;
        this.configService = configService;
        this.prisma = prisma;
        this.apiUrl = this.configService.get('GHN_API_URL') || 'https://dev-online-gateway.ghn.vn/shiip/public-api';
        this.token = this.configService.get('GHN_TOKEN');
        this.shopId = Number(this.configService.get('GHN_SHOP_ID')) || 0;
    }
    hasRealCredentials() {
        return !!this.token && this.shopId > 0;
    }
    async assertOrdersBelongToShop(orderIds, shopId) {
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
                paymentMethod: true,
                paymentStatus: true,
                status: true,
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
            throw new common_1.NotFoundException(`Không tìm thấy hoặc không có quyền với đơn: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}`);
        }
        return orders;
    }
    getHeaders() {
        return {
            Token: this.token,
            ShopId: this.shopId,
            'Content-Type': 'application/json',
        };
    }
    async getServiceId(toDistrictId, fromDistrictId, weight) {
        try {
            const url = `${this.apiUrl}/v2/shipping-order/available-services`;
            const payload = {
                shop_id: this.shopId,
                from_district: fromDistrictId,
                to_district: toDistrictId,
                weight: weight || 200
            };
            const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.post(url, payload, { headers: { token: this.token } }));
            if (!data.data || data.data.length === 0) {
                return null;
            }
            const ecommerceService = data.data.find((s) => s.service_type_id === 2);
            return ecommerceService ? ecommerceService.service_id : data.data[0].service_id;
        }
        catch (error) {
            this.logger.error(`Get Service Error: ${JSON.stringify(error.response?.data || error.message)}`);
            return null;
        }
    }
    async calculateFee(params) {
        try {
            const serviceId = await this.getServiceId(params.toDistrictId, this.defaultFromDistrictId, params.weight);
            if (!serviceId) {
                this.logger.warn(`Không tìm thấy gói vận chuyển cho tuyến ${this.defaultFromDistrictId} -> ${params.toDistrictId}`);
                return 30000;
            }
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
            const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.post(url, payload, { headers: this.getHeaders() }));
            return data.data.total;
        }
        catch (error) {
            this.logger.error(`GHN Fee Error: ${JSON.stringify(error.response?.data || error.message)}`);
            return 30000;
        }
    }
    async calculateExpectedDeliveryTime(params) {
        try {
            const serviceId = await this.getServiceId(params.toDistrictId, this.defaultFromDistrictId, 200);
            if (!serviceId)
                return null;
            const url = `${this.apiUrl}/v2/shipping-order/leadtime`;
            const payload = {
                from_district_id: this.defaultFromDistrictId,
                from_ward_code: "20314",
                to_district_id: params.toDistrictId,
                to_ward_code: params.toWardCode,
                service_id: serviceId,
            };
            const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.post(url, payload, { headers: this.getHeaders() }));
            return data.data.leadtime;
        }
        catch (error) {
            return Math.floor(Date.now() / 1000) + 3 * 24 * 60 * 60;
        }
    }
    async createShippingOrder(orderData) {
        if (this.hasRealCredentials()) {
            try {
                const totalWeight = orderData.weight || 200;
                const serviceId = await this.getServiceId(orderData.to_district_id, this.defaultFromDistrictId, totalWeight);
                const url = `${this.apiUrl}/v2/shipping-order/create`;
                const payload = {
                    ...orderData,
                    payment_type_id: 2,
                    required_note: 'CHOXEMHANGKHONGTHU',
                    service_id: serviceId || 53320,
                    from_district_id: this.defaultFromDistrictId,
                };
                const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.post(url, payload, { headers: this.getHeaders() }));
                return data.data;
            }
            catch (error) {
                this.logger.error('GHN Create Order Error:', error.response?.data || error.message);
                throw new common_1.BadRequestException('Không thể tạo đơn vận chuyển GHN');
            }
        }
        this.logger.warn(`[MOCK GHN] Chưa cấu hình GHN_TOKEN/GHN_SHOP_ID → giả lập đơn cho: ${orderData.to_name}`);
        return {
            order_code: 'MOCK_GHN_' + Date.now(),
            total_fee: 35000,
            expected_delivery_time: new Date().toISOString(),
            status: 'ready_to_pick',
        };
    }
    async cancelShippingOrder(orderCode) {
        if (!this.hasRealCredentials() || !orderCode || orderCode.startsWith('MOCK_GHN_'))
            return;
        try {
            const url = `${this.apiUrl}/v2/switch-status/cancel`;
            await (0, rxjs_1.firstValueFrom)(this.httpService.post(url, { order_codes: [orderCode] }, { headers: this.getHeaders() }));
            this.logger.warn(`[GHN] đã HỦY vận đơn mồ côi ${orderCode} (đơn đổi trạng thái giữa chừng).`);
        }
        catch (e) {
            this.logger.error(`[GHN] hủy vận đơn ${orderCode} thất bại: ${JSON.stringify(e.response?.data) || e.message}`);
        }
    }
    async getProvinces() {
        try {
            const url = `${this.apiUrl}/master-data/province`;
            const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.get(url, { headers: { token: this.token } }));
            return data.data;
        }
        catch (error) {
            console.error('Lỗi lấy Tỉnh/Thành GHN:', error?.response?.data || error.message);
            return [];
        }
    }
    async getDistricts(provinceId) {
        try {
            const url = `${this.apiUrl}/master-data/district`;
            const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.post(url, { province_id: provinceId }, { headers: { token: this.token } }));
            return data.data;
        }
        catch (error) {
            console.error(`Lỗi lấy Quận/Huyện (Province: ${provinceId}):`, error?.response?.data || error.message);
            return [];
        }
    }
    async getWards(districtId) {
        try {
            const url = `${this.apiUrl}/master-data/ward?district_id=${districtId}`;
            const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.get(url, { headers: { token: this.token } }));
            return data.data;
        }
        catch (error) {
            console.error(`Lỗi lấy Phường/Xã (District: ${districtId}):`, error?.response?.data || error.message);
            return [];
        }
    }
    async bulkUpdateAddress(shopId, dto) {
        const ids = dto.items.map(i => i.orderId);
        const orders = await this.assertOrdersBelongToShop(ids, shopId);
        const orderMap = new Map(orders.map(o => [o.id, o]));
        const results = [];
        for (const item of dto.items) {
            const order = orderMap.get(item.orderId);
            try {
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
                        await (0, rxjs_1.firstValueFrom)(this.httpService.post(url, payload, { headers: this.getHeaders() }));
                    }
                    catch (ghnErr) {
                        this.logger.warn(`[GHN sync] update address fail orderId=${item.orderId}: ${ghnErr.message}`);
                    }
                }
                results.push({ orderId: item.orderId, ok: true });
            }
            catch (err) {
                results.push({ orderId: item.orderId, ok: false, message: err.message });
            }
        }
        return results;
    }
    async bulkChangePickupDate(shopId, dto) {
        const pickupTs = Math.floor(new Date(dto.pickupDate).getTime() / 1000);
        const nowTs = Math.floor(Date.now() / 1000);
        if (pickupTs <= nowTs) {
            throw new common_1.BadRequestException('Ngày lấy hàng phải trong tương lai');
        }
        const orders = await this.assertOrdersBelongToShop(dto.orderIds, shopId);
        const results = [];
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
                    this.logger.log(`[MOCK GHN] bulkChangePickupDate orderId=${order.id} → ${dto.pickupDate}`);
                    results.push({ orderId: order.id, ok: true, message: '(mock) Cập nhật thành công' });
                    continue;
                }
                const url = `${this.apiUrl}/v2/shipping-order/update`;
                const payload = {
                    order_code: order.shippingOrderCode,
                    pick_time: pickupTs,
                };
                const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.post(url, payload, { headers: this.getHeaders() }));
                if (data?.code === 200 || data?.message === 'Success') {
                    results.push({ orderId: order.id, ok: true });
                }
                else {
                    results.push({ orderId: order.id, ok: false, message: data?.message || 'GHN từ chối' });
                }
            }
            catch (err) {
                const ghnMsg = err?.response?.data?.message || err.message;
                results.push({ orderId: order.id, ok: false, message: ghnMsg });
            }
        }
        return results;
    }
    async bulkRequestPickup(shopId, dto) {
        const orders = await this.assertOrdersBelongToShop(dto.orderIds, shopId);
        const results = [];
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
                if (!['PENDING', 'CONFIRMED'].includes(String(order.status))) {
                    results.push({
                        orderId: order.id,
                        ok: false,
                        message: `Đơn ở trạng thái ${order.status} — không thể yêu cầu lấy hàng`,
                    });
                    continue;
                }
                const weight = order.items.reduce((acc, it) => acc + (Number(it.product?.weight) || 200) * it.quantity, 0);
                const ghnPayload = {
                    to_name: order.recipientName,
                    to_phone: order.recipientPhone,
                    to_address: order.recipientAddress,
                    to_district_id: order.districtId,
                    to_ward_code: order.wardCode,
                    cod_amount: String(order.paymentMethod).toLowerCase() === 'cod' && order.paymentStatus !== 'PAID'
                        ? Math.floor(Number(order.totalAmount))
                        : 0,
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
                    const persisted = await this.prisma.order.updateMany({
                        where: {
                            id: order.id,
                            status: { in: ['PENDING', 'CONFIRMED'] },
                            shippingOrderCode: null,
                        },
                        data: { shippingOrderCode: code, status: 'CONFIRMED' },
                    });
                    if (persisted.count === 0) {
                        await this.cancelShippingOrder(code);
                        results.push({
                            orderId: order.id,
                            ok: false,
                            message: 'Đơn đã đổi trạng thái — đã hủy phiếu GHN vừa tạo',
                        });
                    }
                    else {
                        results.push({ orderId: order.id, ok: true, shippingOrderCode: code });
                    }
                }
                else {
                    results.push({ orderId: order.id, ok: false, message: 'GHN không trả về mã đơn' });
                }
            }
            catch (err) {
                results.push({ orderId: order.id, ok: false, message: err.message });
            }
        }
        return results;
    }
};
exports.GhnService = GhnService;
exports.GhnService = GhnService = GhnService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService,
        config_1.ConfigService,
        prisma_service_1.PrismaService])
], GhnService);
//# sourceMappingURL=ghn.service.js.map