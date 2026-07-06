import { AddressService } from './address.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';
export declare class AddressController {
    private readonly addressService;
    constructor(addressService: AddressService);
    create(userId: string, dto: CreateAddressDto): Promise<{
        id: string;
        userId: string;
        name: string | null;
        phone: string | null;
        specificAddress: string | null;
        fullAddress: string | null;
        provinceId: number | null;
        districtId: number | null;
        wardCode: string | null;
        isDefault: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findAll(userId: string): Promise<{
        id: string;
        userId: string;
        name: string | null;
        phone: string | null;
        specificAddress: string | null;
        fullAddress: string | null;
        provinceId: number | null;
        districtId: number | null;
        wardCode: string | null;
        isDefault: boolean;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    update(userId: string, id: string, dto: UpdateAddressDto): Promise<{
        id: string;
        userId: string;
        name: string | null;
        phone: string | null;
        specificAddress: string | null;
        fullAddress: string | null;
        provinceId: number | null;
        districtId: number | null;
        wardCode: string | null;
        isDefault: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    remove(userId: string, id: string): Promise<{
        id: string;
        userId: string;
        name: string | null;
        phone: string | null;
        specificAddress: string | null;
        fullAddress: string | null;
        provinceId: number | null;
        districtId: number | null;
        wardCode: string | null;
        isDefault: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    setDefault(userId: string, id: string): Promise<boolean>;
}
