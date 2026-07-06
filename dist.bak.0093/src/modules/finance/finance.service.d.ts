import { PrismaService } from '../../database/prisma/prisma.service';
export declare class FinanceService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getRevenueStats(period: string): Promise<{
        totalRevenue: number;
        platformFee: number;
        pendingPayout: number;
        chartData: {
            date: string;
            value: number;
        }[];
    }>;
    getPayoutRequests(page: number, status?: string): Promise<{
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
    requestPayout(userId: string, amount: number, bankInfo: string): Promise<{
        success: boolean;
        id: string;
        amount: number;
    }>;
    getMyWallet(userId: string): Promise<{
        walletBalance: number;
    }>;
    getMyPayouts(userId: string): Promise<{
        id: string;
        amount: number;
        bankInfo: string;
        status: import("@prisma/client").$Enums.PayoutStatus;
        reason: string | null;
        requestedAt: Date;
        processedAt: Date | null;
    }[]>;
    approvePayout(id: string): Promise<{
        success: boolean;
    }>;
    rejectPayout(id: string, reason: string): Promise<{
        success: boolean;
    }>;
}
