import { FinanceService } from './finance.service';
import { RejectPayoutDto } from './dto/reject-payout.dto';
export declare class FinanceController {
    private readonly financeService;
    constructor(financeService: FinanceService);
    getRevenueStats(period: string): Promise<{
        totalRevenue: number;
        platformFee: number;
        pendingPayout: number;
        chartData: {
            date: string;
            value: number;
        }[];
    }>;
    getPayoutRequests(page: string, status: string): Promise<{
        data: {
            id: string;
            shopId: string;
            shopName: string | null;
            amount: number;
            bankInfo: string;
            status: import("@prisma/client").$Enums.PayoutStatus;
            requestedAt: Date;
            processedAt: Date | null;
        }[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    approvePayout(id: string): Promise<{
        success: boolean;
    }>;
    rejectPayout(id: string, dto: RejectPayoutDto): Promise<{
        success: boolean;
    }>;
}
