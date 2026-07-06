import { PointService } from '../point/point.service';
import { RedisService } from '../../database/redis/redis.service';
export declare class DailyService {
    private pointService;
    private redisService;
    private readonly REWARDS;
    constructor(pointService: PointService, redisService: RedisService);
    checkIn(userId: string): Promise<{
        message: string;
        reward: number;
        streak: number;
        currentPoints: number;
    }>;
    getDailyStatus(userId: string): Promise<{
        isCheckedInToday: boolean;
        currentStreak: number;
    }>;
    resetDailyTest(userId: string): Promise<{
        message: string;
    }>;
}
