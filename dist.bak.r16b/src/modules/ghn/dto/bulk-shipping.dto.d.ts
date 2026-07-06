export declare class BulkUpdateAddressItemDto {
    orderId: string;
    recipientAddress: string;
    districtId: number;
    wardCode: string;
    provinceId?: number;
    recipientName?: string;
    recipientPhone?: string;
}
export declare class BulkUpdateAddressDto {
    items: BulkUpdateAddressItemDto[];
}
export declare class BulkChangePickupDateDto {
    orderIds: string[];
    pickupDate: string;
}
export declare class BulkRequestPickupDto {
    orderIds: string[];
}
