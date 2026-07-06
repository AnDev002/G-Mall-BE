import { Redis } from 'ioredis';
import { TrackEventDto } from './dto/track-event.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
export declare class TrackingService {
    private readonly redis;
    private readonly prisma;
    private readonly logger;
    private readonly STREAM_KEY;
    private readonly TRENDING_KW_CACHE_KEY;
    private readonly TRENDING_KW_TTL_SEC;
    constructor(redis: Redis, prisma: PrismaService);
    trackEvent(userId: string | null, guestId: string, dto: TrackEventDto): Promise<void>;
    mergeGuestData(guestId: string, realUserId: string): Promise<void>;
    updateAffinityScore(payload: any): Promise<void>;
    getRecommendations(userId: string | null, guestId: string): Promise<string[]>;
    getTrendingKeywords(limit: number): Promise<{
        keyword: string;
        count: number;
    }[]>;
}
