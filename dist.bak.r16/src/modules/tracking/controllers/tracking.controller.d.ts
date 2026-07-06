import { TrackingService } from '../tracking.service';
import { TrackBatchDto } from '../dto/track-event.dto';
export declare class TrackingController {
    private readonly trackingService;
    constructor(trackingService: TrackingService);
    trackBatch(req: any, body: TrackBatchDto, headerDeviceId: string, queryDeviceId: string, userAgent: string, ip: string): Promise<{
        success: boolean;
    }>;
    getRecommendations(req: any, deviceId: string): Promise<{
        productIds: string[];
    }>;
    getTrendingKeywords(limitRaw?: string): Promise<{
        keyword: string;
        count: number;
    }[]>;
}
