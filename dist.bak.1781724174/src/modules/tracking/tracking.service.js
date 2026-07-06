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
var TrackingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrackingService = void 0;
const common_1 = require("@nestjs/common");
const redis_constants_1 = require("../../database/redis/redis.constants");
const ioredis_1 = require("ioredis");
const track_event_dto_1 = require("./dto/track-event.dto");
const prisma_service_1 = require("../../database/prisma/prisma.service");
let TrackingService = TrackingService_1 = class TrackingService {
    redis;
    prisma;
    logger = new common_1.Logger(TrackingService_1.name);
    STREAM_KEY = 'tracking_stream';
    TRENDING_KW_CACHE_KEY = 'cache:trending-keywords';
    TRENDING_KW_TTL_SEC = 300;
    constructor(redis, prisma) {
        this.redis = redis;
        this.prisma = prisma;
    }
    async trackEvent(userId, guestId, dto) {
        const payload = JSON.stringify({
            userId,
            guestId,
            ...dto,
            serverTimestamp: Date.now(),
        });
        try {
            await this.redis.xadd(this.STREAM_KEY, 'MAXLEN', '~', 1000000, '*', 'data', payload);
        }
        catch (e) {
            this.logger.error(`Failed to push to stream: ${e.message}`);
        }
    }
    async mergeGuestData(guestId, realUserId) {
        const guestKey = `user:affinity:guest:${guestId}`;
        const userKey = `user:affinity:${realUserId}`;
        const exists = await this.redis.exists(guestKey);
        if (exists) {
            this.logger.log(`🔄 Merging data: Guest[${guestId}] -> User[${realUserId}]`);
            await this.redis.zunionstore(userKey, 2, userKey, guestKey, 'WEIGHTS', 1, 1, 'AGGREGATE', 'MAX');
            await this.redis.del(guestKey);
            await this.redis.expire(userKey, 60 * 60 * 24 * 60);
        }
    }
    async updateAffinityScore(payload) {
        if (!payload.targetId || payload.targetId === 'none')
            return;
        const SCORES = {
            [track_event_dto_1.EventType.VIEW_PRODUCT]: 1,
            [track_event_dto_1.EventType.CLICK_PRODUCT]: 2,
            [track_event_dto_1.EventType.ADD_TO_CART]: 5,
            [track_event_dto_1.EventType.BEGIN_CHECKOUT]: 10,
            [track_event_dto_1.EventType.PURCHASE]: 50,
        };
        const score = SCORES[payload.type] || 0;
        if (score === 0)
            return;
        if ((payload.type === track_event_dto_1.EventType.PURCHASE ||
            payload.type === track_event_dto_1.EventType.BEGIN_CHECKOUT) &&
            !payload.userId) {
            return;
        }
        const identifier = payload.userId
            ? `user:affinity:${payload.userId}`
            : `user:affinity:guest:${payload.guestId}`;
        if (payload.type === track_event_dto_1.EventType.PURCHASE && payload.metadata?.items) {
            const items = payload.metadata.items;
            if (Array.isArray(items)) {
                const pipeline = this.redis.pipeline();
                items.forEach((item) => {
                    if (item.productId) {
                        pipeline.zincrby(identifier, score, item.productId);
                    }
                });
                pipeline.expire(identifier, 60 * 60 * 24 * 60);
                await pipeline.exec();
            }
        }
        else {
            await this.redis.zincrby(identifier, score, payload.targetId);
            await this.redis.expire(identifier, 60 * 60 * 24 * 60);
        }
    }
    async getRecommendations(userId, guestId) {
        const key = userId ? `user:affinity:${userId}` : `user:affinity:guest:${guestId}`;
        let productIds = await this.redis.zrevrange(key, 0, 19);
        if (productIds.length < 10) {
            const trendingIds = await this.redis.zrevrange('global:trending', 0, 19);
            productIds = Array.from(new Set([...productIds, ...trendingIds]));
        }
        return productIds.slice(0, 20);
    }
    async getTrendingKeywords(limit) {
        const cached = await this.redis.get(this.TRENDING_KW_CACHE_KEY);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0)
                    return parsed.slice(0, limit);
            }
            catch {
            }
        }
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        let result = [];
        try {
            const rows = await this.prisma.$queryRawUnsafe(`SELECT
            LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.keyword')))) AS keyword,
            COUNT(*) AS count
         FROM AnalyticsLog
         WHERE eventType = 'SEARCH'
           AND createdAt >= ?
           AND JSON_EXTRACT(metadata, '$.keyword') IS NOT NULL
           AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.keyword')) <> ''
         GROUP BY keyword
         ORDER BY count DESC
         LIMIT ?`, since, limit);
            result = rows
                .filter((r) => r.keyword && r.keyword.length > 1 && r.keyword.length < 50)
                .map((r) => ({ keyword: r.keyword, count: Number(r.count) }));
        }
        catch (e) {
            this.logger.warn(`Trending keywords aggregation failed: ${e.message}`);
        }
        if (result.length === 0) {
            result = [
                { keyword: 'son môi mac', count: 0 },
                { keyword: 'iphone 15 pro max', count: 0 },
                { keyword: 'quà tặng 20/10', count: 0 },
                { keyword: 'giày adidas samba', count: 0 },
                { keyword: 'túi xách local brand', count: 0 },
            ].slice(0, limit);
        }
        await this.redis
            .set(this.TRENDING_KW_CACHE_KEY, JSON.stringify(result), 'EX', this.TRENDING_KW_TTL_SEC)
            .catch(() => { });
        return result;
    }
};
exports.TrackingService = TrackingService;
exports.TrackingService = TrackingService = TrackingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_constants_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [ioredis_1.Redis,
        prisma_service_1.PrismaService])
], TrackingService);
//# sourceMappingURL=tracking.service.js.map