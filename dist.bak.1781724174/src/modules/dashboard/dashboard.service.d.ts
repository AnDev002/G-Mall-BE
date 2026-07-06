import { PrismaService } from '../../database/prisma/prisma.service';
export declare class DashboardService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getStats(): Promise<{
        totalRevenue: number;
        totalOrders: number;
        totalUsers: number;
        activeShops: number;
    }>;
    getSellerStats(sellerId: string): Promise<{
        revenue: number;
        orders: number;
        products: number;
        rating: number;
        lowStockProducts: number;
        todo: {
            pending: number;
            confirmed: number;
            shipping: number;
            returned: number;
        };
        chart: {
            date: string;
            revenue: number;
        }[];
    }>;
}
