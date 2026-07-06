export declare class CreateAddressDto {
    name: string;
    phone: string;
    specificAddress: string;
    provinceId: number;
    districtId: number;
    wardCode: string;
    isDefault?: boolean;
}
export declare class UpdateAddressDto extends CreateAddressDto {
}
