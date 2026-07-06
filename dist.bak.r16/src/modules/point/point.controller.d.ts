import { PointService } from './point.service';
export declare class PointController {
    private readonly pointService;
    constructor(pointService: PointService);
    getMyPointInfo(user: any): Promise<{
        points: number;
        streak: number;
        isCheckedInToday: boolean;
        dayOfWeek: number;
    }>;
    getHistory(user: any): Promise<{
        id: string;
        userId: string;
        amount: number;
        type: string;
        source: string;
        description: string | null;
        createdAt: Date;
    }[]>;
    checkIn(user: any): Promise<{
        earned: number;
        streak: number;
        bonusApplied: boolean;
    }>;
    initiateTransfer(user: any, body: {
        receiverId: string;
        amount: number;
    }): Promise<{
        message: string;
    }>;
    getRate(): Promise<{
        rate: number;
    }>;
    updateConversionRate(body: {
        amount: number;
    }): Promise<{
        success: boolean;
        rate: number;
    }>;
    confirmTransfer(user: any, body: {
        otp: string;
    }): Promise<{
        success: boolean;
        newBalance: number;
    }>;
}
