import { VoucherType, VoucherScope } from '@prisma/client';
export declare class CreateVoucherDto {
    code: string;
    name: string;
    type: VoucherType;
    scope: VoucherScope;
    amount: number;
    usageLimit: number;
    startDate: string;
    endDate: string;
    productIds?: string[];
    minOrderValue?: number;
    maxDiscount?: number;
    categoryIds?: string[];
}
