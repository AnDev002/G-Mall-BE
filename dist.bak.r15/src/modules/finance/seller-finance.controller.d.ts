import { FinanceService } from './finance.service';
export declare class SellerFinanceController {
    private readonly financeService;
    constructor(financeService: FinanceService);
    getMyWallet(req: any): Promise<{
        walletBalance: number;
    }>;
    getMyPayouts(req: any): Promise<{
        id: string;
        amount: number;
        bankInfo: string;
        status: import("@prisma/client").$Enums.PayoutStatus;
        reason: string | null;
        requestedAt: Date;
        processedAt: Date | null;
    }[]>;
    requestPayout(req: any, body: {
        amount: number;
        bankInfo: string;
    }): Promise<{
        success: boolean;
        id: string;
        amount: number;
    }>;
}
