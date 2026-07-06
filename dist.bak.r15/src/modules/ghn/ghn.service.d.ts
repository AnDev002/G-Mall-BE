import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { BulkUpdateAddressDto, BulkChangePickupDateDto, BulkRequestPickupDto } from './dto/bulk-shipping.dto';
export interface BulkResult {
    orderId: string;
    ok: boolean;
    message?: string;
    shippingOrderCode?: string;
}
export declare class GhnService {
    private readonly httpService;
    private readonly configService;
    private readonly prisma;
    private readonly logger;
    private apiUrl;
    private token;
    private shopId;
    private defaultFromDistrictId;
    constructor(httpService: HttpService, configService: ConfigService, prisma: PrismaService);
    private hasRealCredentials;
    private assertOrdersBelongToShop;
    private getHeaders;
    getServiceId(toDistrictId: number, fromDistrictId: number, weight: number): Promise<any>;
    calculateFee(params: {
        toDistrictId: number;
        toWardCode: string;
        weight: number;
        insuranceValue: number;
    }): Promise<any>;
    calculateExpectedDeliveryTime(params: {
        toDistrictId: number;
        toWardCode: string;
    }): Promise<any>;
    createShippingOrder(orderData: any): Promise<any>;
    cancelShippingOrder(orderCode: string): Promise<void>;
    getProvinces(): Promise<any>;
    getDistricts(provinceId: number): Promise<any>;
    getWards(districtId: number): Promise<any>;
    bulkUpdateAddress(shopId: string, dto: BulkUpdateAddressDto): Promise<BulkResult[]>;
    bulkChangePickupDate(shopId: string, dto: BulkChangePickupDateDto): Promise<BulkResult[]>;
    bulkRequestPickup(shopId: string, dto: BulkRequestPickupDto): Promise<BulkResult[]>;
}
