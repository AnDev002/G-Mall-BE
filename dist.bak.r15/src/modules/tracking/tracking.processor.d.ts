import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { TrackingService } from './tracking.service';
export declare class TrackingProcessor implements OnModuleInit, OnModuleDestroy {
    private readonly redis;
    private readonly prisma;
    private readonly trackingService;
    private readonly configService;
    private readonly logger;
    private readonly STREAM_KEY;
    private readonly GROUP_NAME;
    private readonly CONSUMER_NAME;
    private readonly BATCH_SIZE;
    private readonly FLUSH_INTERVAL;
    private logBuffer;
    private flushTimer;
    private isRunning;
    private blockingClient;
    constructor(redis: Redis, prisma: PrismaService, trackingService: TrackingService, configService: ConfigService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    initConsumerGroup(): Promise<void>;
    runWorker(): Promise<void>;
    private flushLogsToDB;
}
