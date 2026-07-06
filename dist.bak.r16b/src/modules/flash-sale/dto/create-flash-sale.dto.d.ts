import { FlashSaleStatus } from '@prisma/client';
export declare class CreateFlashSaleSessionDto {
    startTime: string;
    endTime: string;
    status?: FlashSaleStatus;
}
