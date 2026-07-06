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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyService = void 0;
const common_1 = require("@nestjs/common");
const point_service_1 = require("../point/point.service");
const redis_service_1 = require("../../database/redis/redis.service");
const client_1 = require("@prisma/client");
const moment_1 = __importDefault(require("moment"));
let DailyService = class DailyService {
    pointService;
    redisService;
    REWARDS = [3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 13000];
    constructor(pointService, redisService) {
        this.pointService = pointService;
        this.redisService = redisService;
    }
    async checkIn(userId) {
        const today = (0, moment_1.default)().format('YYYY-MM-DD');
        const redisKey = `checkin:${userId}:${today}`;
        const streakKey = `streak:${userId}`;
        const claimed = await this.redisService.setNX(redisKey, '1', 86400);
        if (!claimed) {
            throw new common_1.BadRequestException('Hôm nay bạn đã nhận thưởng rồi!');
        }
        let currentStreak = 0;
        const lastCheckInDate = await this.redisService.get(`last_checkin_date:${userId}`);
        if (lastCheckInDate) {
            const lastDate = new Date(lastCheckInDate);
            const currDate = new Date(today);
            const diffTime = Math.abs(currDate.getTime() - lastDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
                const savedStreak = await this.redisService.get(streakKey);
                currentStreak = savedStreak ? parseInt(savedStreak) : 0;
            }
            else if (diffDays > 1) {
                currentStreak = 0;
            }
        }
        if (currentStreak >= 10)
            currentStreak = 0;
        const rewardPoints = this.REWARDS[currentStreak];
        const dayLabel = currentStreak + 1;
        const refId = `DAILY_${userId}_${today}`;
        let awarded = false;
        try {
            const result = await this.pointService.processTransaction(userId, rewardPoints, client_1.PointType.EARN_DAILY, refId, `Điểm danh Ngày ${dayLabel}`);
            awarded = true;
            try {
                await this.redisService.set(`last_checkin_date:${userId}`, today, 86400 * 2);
                await this.redisService.set(streakKey, (currentStreak + 1).toString(), 86400 * 2);
            }
            catch (postErr) {
            }
            return {
                message: `Điểm danh Ngày ${dayLabel} thành công!`,
                reward: rewardPoints,
                streak: currentStreak + 1,
                currentPoints: result.newBalance
            };
        }
        catch (e) {
            if (!awarded) {
                await this.redisService.del(redisKey);
            }
            if (e instanceof common_1.ConflictException) {
                throw new common_1.BadRequestException('Hôm nay bạn đã điểm danh rồi!');
            }
            throw e;
        }
    }
    async getDailyStatus(userId) {
        const today = (0, moment_1.default)().format('YYYY-MM-DD');
        const checkinKey = `checkin:${userId}:${today}`;
        const streakKey = `streak:${userId}`;
        const [hasCheckedIn, streakStr] = await Promise.all([
            this.redisService.get(checkinKey),
            this.redisService.get(streakKey)
        ]);
        const currentStreak = streakStr ? parseInt(streakStr) : 0;
        return {
            isCheckedInToday: !!hasCheckedIn,
            currentStreak: currentStreak
        };
    }
    async resetDailyTest(userId) {
        const today = (0, moment_1.default)().format('YYYY-MM-DD');
        const checkinKey = `checkin:${userId}:${today}`;
        const gachaKey = `gacha:${userId}:${today}`;
        await this.redisService.del(checkinKey);
        await this.redisService.del(gachaKey);
        return { message: 'Đã reset! Bạn có thể điểm danh lại.' };
    }
};
exports.DailyService = DailyService;
exports.DailyService = DailyService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [point_service_1.PointService,
        redis_service_1.RedisService])
], DailyService);
//# sourceMappingURL=daily.service.js.map