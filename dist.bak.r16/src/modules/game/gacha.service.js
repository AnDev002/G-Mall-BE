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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GachaService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const point_service_1 = require("../../modules/point/point.service");
const redis_service_1 = require("../../database/redis/redis.service");
const client_1 = require("@prisma/client");
let GachaService = class GachaService {
    prisma;
    pointService;
    redis;
    constructor(prisma, pointService, redis) {
        this.prisma = prisma;
        this.pointService = pointService;
        this.redis = redis;
    }
    async getTodaySpinStatus(userId) {
        const today = new Date().toISOString().split('T')[0];
        const dailyKey = `gacha:${userId}:${today}`;
        const hasSpun = await this.redis.get(dailyKey);
        return { hasSpun: !!hasSpun };
    }
    async spin(userId) {
        const today = new Date().toISOString().split('T')[0];
        const dailyKey = `gacha:${userId}:${today}`;
        const lockKey = `lock:gacha:${userId}`;
        const acquired = await this.redis.setNX(lockKey, '1', 5);
        if (!acquired)
            throw new common_1.BadRequestException('Đang xử lý...');
        const dayClaim = await this.redis.setNX(dailyKey, '1', 86400);
        if (!dayClaim) {
            await this.redis.del(lockKey);
            throw new common_1.BadRequestException('Hôm nay bạn đã hết lượt quay miễn phí!');
        }
        try {
            const result = await this.prisma.$transaction(async (tx) => {
                const rand = Math.random() * 100;
                let reward = 0;
                let message = 'Chúc bạn may mắn lần sau';
                let won = false;
                if (rand < 50) {
                }
                else if (rand < 90) {
                    reward = 100;
                    message = 'Trúng 100 xu';
                    won = true;
                }
                else {
                    reward = 1000;
                    message = 'NỔ HŨ 1000 xu';
                    won = true;
                }
                if (won && reward > 0) {
                    await this.pointService.addPoints(userId, reward, client_1.PointType.EARN_GAME || 'EARN_GAME', `GACHA_${Date.now()}`, `Gacha: ${message}`, tx);
                }
                return { won, reward, message };
            }, { timeout: 15000, maxWait: 5000 });
            return result;
        }
        catch (e) {
            await this.redis.del(dailyKey);
            throw e;
        }
        finally {
            await this.redis.del(lockKey);
        }
    }
};
exports.GachaService = GachaService;
exports.GachaService = GachaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        point_service_1.PointService,
        redis_service_1.RedisService])
], GachaService);
//# sourceMappingURL=gacha.service.js.map