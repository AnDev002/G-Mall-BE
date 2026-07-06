import type { Job } from 'bull';
import { PrismaService } from '../../database/prisma/prisma.service';
export declare class PromotionProcessor {
    private readonly prisma;
    constructor(prisma: PrismaService);
    handleSaveUserVoucher(job: Job<{
        userId: string;
        code: string;
    }>): Promise<void>;
}
