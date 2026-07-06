import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { TrackingService } from '../tracking/tracking.service';
export declare class OrderProcessor extends WorkerHost {
    private readonly prisma;
    private readonly cartService;
    private readonly trackingService;
    private readonly logger;
    constructor(prisma: PrismaService, cartService: CartService, trackingService: TrackingService);
    process(job: Job<any, any, string>): Promise<any>;
}
