import { CharityFundStatus } from '@prisma/client';
export declare class CreateFundDto {
    name: string;
    description?: string;
    image?: string;
    goalAmount?: number;
}
export declare class UpdateFundDto {
    name?: string;
    description?: string;
    image?: string;
    goalAmount?: number;
    status?: CharityFundStatus;
}
