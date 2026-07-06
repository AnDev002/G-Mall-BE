"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var TrackingProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrackingProcessor = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const redis_constants_1 = require("../../database/redis/redis.constants");
const ioredis_1 = require("ioredis");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const tracking_service_1 = require("./tracking.service");
const track_event_dto_1 = require("./dto/track-event.dto");
let TrackingProcessor = TrackingProcessor_1 = class TrackingProcessor {
    redis;
    prisma;
    trackingService;
    configService;
    logger = new common_1.Logger(TrackingProcessor_1.name);
    STREAM_KEY = 'tracking_stream';
    GROUP_NAME = 'analytics_group';
    CONSUMER_NAME = `worker-${Math.random().toString(36).substring(7)}`;
    BATCH_SIZE = 500;
    FLUSH_INTERVAL = 5000;
    logBuffer = [];
    flushTimer = null;
    isRunning = true;
    blockingClient;
    constructor(redis, prisma, trackingService, configService) {
        this.redis = redis;
        this.prisma = prisma;
        this.trackingService = trackingService;
        this.configService = configService;
        const host = configService.get('REDIS_HOST');
        const port = Number(configService.get('REDIS_PORT'));
        const password = configService.get('REDIS_PASSWORD');
        const isLocal = host === 'localhost' || host === '127.0.0.1';
        this.blockingClient = new ioredis_1.Redis({
            host,
            port,
            password: password || undefined,
            tls: isLocal ? undefined : { rejectUnauthorized: false },
        });
    }
    async onModuleInit() {
        await this.initConsumerGroup();
        this.runWorker();
        this.flushTimer = setInterval(() => this.flushLogsToDB(), this.FLUSH_INTERVAL);
    }
    async onModuleDestroy() {
        this.isRunning = false;
        if (this.flushTimer)
            clearInterval(this.flushTimer);
        await this.flushLogsToDB();
        await this.blockingClient.quit().catch(() => { });
    }
    async initConsumerGroup() {
        try {
            await this.redis.xgroup('CREATE', this.STREAM_KEY, this.GROUP_NAME, '$', 'MKSTREAM');
            this.logger.log(`✅ Consumer Group ${this.GROUP_NAME} created.`);
        }
        catch (e) {
            if (!e.message.includes('BUSYGROUP')) {
                this.logger.error(`Init Group Error: ${e.message}`);
            }
        }
    }
    async runWorker() {
        this.logger.log(`🚀 Worker ${this.CONSUMER_NAME} Started.`);
        while (this.isRunning) {
            try {
                const streams = await this.blockingClient.xreadgroup('GROUP', this.GROUP_NAME, this.CONSUMER_NAME, 'COUNT', 100, 'BLOCK', 5000, 'STREAMS', this.STREAM_KEY, '>');
                if (streams && streams.length > 0) {
                    const events = streams[0][1];
                    for (const [msgId, fields] of events) {
                        const dataFieldIdx = fields.indexOf('data');
                        if (dataFieldIdx === -1) {
                            await this.redis.xack(this.STREAM_KEY, this.GROUP_NAME, msgId);
                            continue;
                        }
                        try {
                            const payload = JSON.parse(fields[dataFieldIdx + 1]);
                            try {
                                if (payload.type === track_event_dto_1.EventType.IDENTIFY) {
                                    if (payload.metadata?.guestId && payload.userId) {
                                        await this.trackingService.mergeGuestData(payload.metadata.guestId, payload.userId);
                                    }
                                }
                                else {
                                    await this.trackingService.updateAffinityScore(payload);
                                }
                            }
                            catch (redisErr) {
                                this.logger.error(`Redis Score Error: ${redisErr.message}`);
                            }
                            this.logBuffer.push({
                                msgId: msgId,
                                data: {
                                    userId: payload.userId || null,
                                    guestId: payload.guestId || 'unknown',
                                    eventType: payload.type,
                                    targetId: payload.targetId !== 'none' ? payload.targetId : null,
                                    metadata: payload.metadata || {},
                                    createdAt: new Date(payload.serverTimestamp || Date.now())
                                }
                            });
                        }
                        catch (innerErr) {
                            this.logger.error(`Msg Process Error ${msgId}: ${innerErr.message}`);
                            await this.redis.xack(this.STREAM_KEY, this.GROUP_NAME, msgId);
                        }
                    }
                    if (this.logBuffer.length >= this.BATCH_SIZE) {
                        await this.flushLogsToDB();
                    }
                }
            }
            catch (err) {
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    }
    async flushLogsToDB() {
        if (this.logBuffer.length === 0)
            return;
        const currentBatch = [...this.logBuffer];
        this.logBuffer = [];
        try {
            this.logger.log(`💾 Flushing ${currentBatch.length} logs to MySQL...`);
            const records = currentBatch.map(b => b.data);
            const msgIds = currentBatch.map(b => b.msgId);
            await this.prisma.analyticsLog.createMany({
                data: records,
                skipDuplicates: true
            });
            if (msgIds.length > 0) {
                await this.redis.xack(this.STREAM_KEY, this.GROUP_NAME, ...msgIds);
            }
        }
        catch (e) {
            this.logger.error(`Failed to flush logs to DB: ${e.message}`);
            this.logBuffer = [...currentBatch, ...this.logBuffer];
        }
    }
};
exports.TrackingProcessor = TrackingProcessor;
exports.TrackingProcessor = TrackingProcessor = TrackingProcessor_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_constants_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [ioredis_1.Redis,
        prisma_service_1.PrismaService,
        tracking_service_1.TrackingService,
        config_1.ConfigService])
], TrackingProcessor);
//# sourceMappingURL=tracking.processor.js.map