import { GhnService } from './ghn.service';
import { ShopService } from '../shop/shop.service';
import { BulkChangePickupDateDto, BulkRequestPickupDto, BulkUpdateAddressDto } from './dto/bulk-shipping.dto';
export declare class GhnController {
    private readonly ghnService;
    private readonly shopService;
    constructor(ghnService: GhnService, shopService: ShopService);
    calculateFee(body: {
        toDistrictId: number;
        toWardCode: string;
        weight: number;
        insuranceValue: number;
    }): Promise<{
        total: any;
    }>;
    calculateTime(body: {
        toDistrictId: number;
        toWardCode: string;
    }): Promise<{
        leadtime: any;
    }>;
    getProvinces(): Promise<any>;
    getDistricts(provinceId: string): Promise<any>;
    getWards(districtId: string): Promise<any>;
    private getShopIdOrThrow;
    bulkUpdateAddress(user: any, dto: BulkUpdateAddressDto): Promise<{
        successCount: number;
        failCount: number;
        results: import("./ghn.service").BulkResult[];
    }>;
    bulkChangePickupDate(user: any, dto: BulkChangePickupDateDto): Promise<{
        successCount: number;
        failCount: number;
        results: import("./ghn.service").BulkResult[];
    }>;
    bulkRequestPickup(user: any, dto: BulkRequestPickupDto): Promise<{
        successCount: number;
        failCount: number;
        results: import("./ghn.service").BulkResult[];
    }>;
}
