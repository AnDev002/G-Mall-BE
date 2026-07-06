import { PrismaService } from '../../database/prisma/prisma.service';
import { PointService } from '../../modules/point/point.service';
import { RedisService } from '../../database/redis/redis.service';
export declare class GachaService {
    private prisma;
    private pointService;
    private redis;
    constructor(prisma: PrismaService, pointService: PointService, redis: RedisService);
    getTodaySpinStatus(userId: string): Promise<{
        hasSpun: boolean;
    }>;
    spin(userId: string): Promise<{
        won: boolean;
        reward: number;
        message: string;
    }>;
}
