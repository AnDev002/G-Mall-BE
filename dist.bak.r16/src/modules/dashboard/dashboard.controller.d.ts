import { DashboardService } from './dashboard.service';
export declare class DashboardController {
    private readonly dashboardService;
    constructor(dashboardService: DashboardService);
    getStats(): Promise<{
        totalRevenue: number;
        totalOrders: number;
        totalUsers: number;
        activeShops: number;
    }>;
    getSellerStats(req: any): Promise<{
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
