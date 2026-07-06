import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisService } from '../../database/redis/redis.service';
import { PointType, Prisma } from '@prisma/client';
import { MailerService } from '@nestjs-modules/mailer';
export declare class PointService {
    private prisma;
    private redis;
    private mailerService;
    constructor(prisma: PrismaService, redis: RedisService, mailerService: MailerService);
    getMyPointInfo(userId: string): Promise<{
        points: number;
        streak: number;
        isCheckedInToday: boolean;
        dayOfWeek: number;
    }>;
    getConversionRate(): Promise<number>;
    updateConversionRate(amount: number): Promise<{
        success: boolean;
        rate: number;
    }>;
    addPoints(userId: string, amount: number, type: PointType, referenceId: string, description: string, tx: Prisma.TransactionClient): Promise<number>;
    processTransaction(userId: string, amount: number, type: PointType, referenceId: string, description: string): Promise<{
        newBalance: number;
    }>;
    dailyCheckIn(userId: string): Promise<{
        earned: number;
        streak: number;
        bonusApplied: boolean;
    }>;
    getHistory(userId: string): Promise<{
        id: string;
        userId: string;
        amount: number;
        type: string;
        source: string;
        description: string | null;
        createdAt: Date;
    }[]>;
    resetDailyTest(userId: string): Promise<{
        message: string;
    }>;
    initiateTransfer(senderId: string, receiverId: string, amount: number): Promise<{
        message: string;
    }>;
    confirmTransfer(senderId: string, inputOtp: string): Promise<{
        success: boolean;
        newBalance: number;
    }>;
}
