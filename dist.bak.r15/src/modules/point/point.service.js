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
exports.PointService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const redis_service_1 = require("../../database/redis/redis.service");
const client_1 = require("@prisma/client");
const mailer_1 = require("@nestjs-modules/mailer");
const moment_1 = __importDefault(require("moment"));
const DEFAULT_RATE = 10000;
let PointService = class PointService {
    prisma;
    redis;
    mailerService;
    constructor(prisma, redis, mailerService) {
        this.prisma = prisma;
        this.redis = redis;
        this.mailerService = mailerService;
    }
    async getMyPointInfo(userId) {
        const wallet = await this.prisma.pointWallet.findUnique({ where: { userId } });
        const checkIn = await this.prisma.dailyCheckIn.findUnique({ where: { userId } });
        const isCheckedInToday = checkIn
            ? (0, moment_1.default)(checkIn.lastCheckInDate).isSame((0, moment_1.default)(), 'day')
            : false;
        const dayOfWeek = (0, moment_1.default)().isoWeekday();
        return {
            points: wallet?.balance || 0,
            streak: checkIn?.currentStreak || 0,
            isCheckedInToday,
            dayOfWeek,
        };
    }
    async getConversionRate() {
        const cached = await this.redis.get('POINT_RATE');
        if (cached)
            return Number(cached);
        const setting = await this.prisma.systemSetting.findUnique({
            where: { key: 'POINT_CONVERSION_RATE' }
        });
        const rate = setting ? Number(setting.value) : DEFAULT_RATE;
        await this.redis.set('POINT_RATE', String(rate), 86400);
        return rate;
    }
    async updateConversionRate(amount) {
        if (amount < 1000)
            throw new common_1.BadRequestException('Tỷ lệ quá thấp (tối thiểu 1000đ/xu)');
        await this.prisma.systemSetting.upsert({
            where: { key: 'POINT_CONVERSION_RATE' },
            update: { value: String(amount) },
            create: {
                key: 'POINT_CONVERSION_RATE',
                value: String(amount),
                description: 'Số tiền VND tương ứng với 1 Xu'
            }
        });
        await this.redis.del('POINT_RATE');
        return { success: true, rate: amount };
    }
    async addPoints(userId, amount, type, referenceId, description, tx) {
        const wallet = await tx.pointWallet.upsert({
            where: { userId },
            create: { userId, balance: amount > 0 ? amount : 0 },
            update: { balance: { increment: amount } },
        });
        if (wallet.balance < 0) {
            throw new common_1.BadRequestException('Số dư không đủ.');
        }
        await tx.pointHistory.create({
            data: {
                userId,
                amount,
                type,
                source: 'GAME',
                description,
            }
        });
        return wallet.balance;
    }
    async processTransaction(userId, amount, type, referenceId, description) {
        return this.prisma.$transaction(async (tx) => {
            const newBalance = await this.addPoints(userId, amount, type, referenceId, description, tx);
            return { newBalance };
        });
    }
    async dailyCheckIn(userId) {
        const DAILY_REWARD = 3000;
        const STREAK_BONUS = 10000;
        const STREAK_THRESHOLD = 10;
        const lockKey = `lock:checkin:${userId}`;
        const isLocked = await this.redis.setNX(lockKey, '1', 5);
        if (!isLocked)
            throw new common_1.BadRequestException('Thao tác quá nhanh.');
        const today = (0, moment_1.default)().format('YYYY-MM-DD');
        const dayKey = `checkin:${userId}:${today}`;
        const dayClaim = await this.redis.setNX(dayKey, '1', 86400);
        if (!dayClaim) {
            await this.redis.del(lockKey);
            throw new common_1.BadRequestException('Hôm nay bạn đã điểm danh rồi.');
        }
        try {
            return await this.prisma.$transaction(async (tx) => {
                let record = await tx.dailyCheckIn.findUnique({ where: { userId } });
                const now = (0, moment_1.default)();
                if (!record) {
                    record = await tx.dailyCheckIn.create({
                        data: { userId, lastCheckInDate: now.clone().subtract(1, 'day').toDate(), currentStreak: 0 }
                    });
                }
                const lastCheckIn = (0, moment_1.default)(record.lastCheckInDate);
                if (now.isSame(lastCheckIn, 'day')) {
                    throw new common_1.BadRequestException('Hôm nay đã điểm danh rồi.');
                }
                const isConsecutive = now.clone().subtract(1, 'day').isSame(lastCheckIn, 'day');
                const newStreak = isConsecutive ? record.currentStreak + 1 : 1;
                let earned = DAILY_REWARD;
                let bonusApplied = false;
                if (newStreak > 0 && newStreak % STREAK_THRESHOLD === 0) {
                    earned += STREAK_BONUS;
                    bonusApplied = true;
                }
                await tx.dailyCheckIn.update({
                    where: { userId },
                    data: { lastCheckInDate: now.toDate(), currentStreak: newStreak }
                });
                const description = bonusApplied
                    ? `Điểm danh ngày ${newStreak} (streak +${STREAK_BONUS} bonus)`
                    : `Điểm danh ngày ${newStreak}`;
                await this.addPoints(userId, earned, client_1.PointType.EARN_DAILY, `DAILY_${now.format('YYYYMMDD')}`, description, tx);
                return { earned, streak: newStreak, bonusApplied };
            });
        }
        catch (e) {
            const msg = String(e?.message || '').toLowerCase();
            if (!msg.includes('đã điểm danh')) {
                await this.redis.del(dayKey);
            }
            throw e;
        }
        finally {
            await this.redis.del(lockKey);
        }
    }
    async getHistory(userId) {
        return this.prisma.pointHistory.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 20
        });
    }
    async resetDailyTest(userId) {
        const today = new Date().toISOString().split('T')[0];
        const checkinKey = `checkin:${userId}:${today}`;
        const gachaKey = `gacha:${userId}:${today}`;
        await this.redis.del(checkinKey);
        await this.redis.del(gachaKey);
        return { message: 'Đã reset! Bạn có thể điểm danh lại.' };
    }
    async initiateTransfer(senderId, receiverId, amount) {
        if (amount <= 0)
            throw new common_1.BadRequestException('Số xu chuyển phải lớn hơn 0');
        if (senderId === receiverId)
            throw new common_1.BadRequestException('Không thể tự chuyển cho chính mình');
        const senderWallet = await this.prisma.pointWallet.findUnique({ where: { userId: senderId } });
        if (!senderWallet || senderWallet.balance < amount) {
            throw new common_1.BadRequestException('Số dư không đủ để thực hiện giao dịch.');
        }
        const receiver = await this.prisma.user.findUnique({ where: { id: receiverId } });
        if (!receiver)
            throw new common_1.BadRequestException('Người nhận không tồn tại.');
        const sender = await this.prisma.user.findUnique({ where: { id: senderId } });
        if (!sender)
            throw new common_1.BadRequestException('Người gửi không hợp lệ.');
        if (!sender.email) {
            throw new common_1.BadRequestException('Tài khoản chưa có email để nhận mã OTP. Vui lòng cập nhật email.');
        }
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const transferData = JSON.stringify({ receiverId, amount, otp });
        await this.redis.set(`transfer_otp:${senderId}`, transferData, 300);
        await this.mailerService.sendMail({
            to: sender.email,
            subject: '[Gmall] Mã xác thực chuyển Xu',
            html: `
        <h3>Xác thực chuyển xu</h3>
        <p>Bạn đang thực hiện chuyển <b>${amount} xu</b> cho tài khoản <b>${receiver.email}</b>.</p>
        <p>Mã OTP của bạn là: <b style="font-size: 20px; color: red;">${otp}</b></p>
        <p>Mã có hiệu lực trong 5 phút.</p>
      `,
        });
        return { message: 'Mã OTP đã được gửi về email của bạn.' };
    }
    async confirmTransfer(senderId, inputOtp) {
        const lockKey = `lock:transfer:${senderId}`;
        const locked = await this.redis.setNX(lockKey, '1', 30);
        if (!locked) {
            throw new common_1.BadRequestException('Đang xử lý, thử lại');
        }
        try {
            const dataStr = await this.redis.getClient().getdel(`transfer_otp:${senderId}`);
            if (!dataStr) {
                throw new common_1.BadRequestException('Giao dịch hết hạn hoặc không tồn tại.');
            }
            const { receiverId, amount, otp } = JSON.parse(dataStr);
            if (otp !== inputOtp) {
                throw new common_1.BadRequestException('Mã OTP không chính xác.');
            }
            const result = await this.prisma.$transaction(async (tx) => {
                const claim = await tx.pointWallet.updateMany({
                    where: { userId: senderId, balance: { gte: amount } },
                    data: { balance: { decrement: amount } },
                });
                if (claim.count === 0) {
                    throw new common_1.BadRequestException('Số dư không đủ để thực hiện giao dịch.');
                }
                await tx.pointWallet.upsert({
                    where: { userId: receiverId },
                    update: { balance: { increment: amount } },
                    create: { userId: receiverId, balance: amount }
                });
                await Promise.all([
                    tx.pointHistory.create({
                        data: {
                            userId: senderId,
                            amount: -amount,
                            type: client_1.PointType.TRANSFER_SENT,
                            source: 'TRANSFER',
                            description: `Chuyển ${amount} xu cho user ${receiverId}`
                        }
                    }),
                    tx.pointHistory.create({
                        data: {
                            userId: receiverId,
                            amount: amount,
                            type: client_1.PointType.TRANSFER_RECEIVED,
                            source: 'TRANSFER',
                            description: `Nhận ${amount} xu từ user ${senderId}`
                        }
                    })
                ]);
                const senderWallet = await tx.pointWallet.findUnique({ where: { userId: senderId } });
                return { success: true, newBalance: senderWallet?.balance ?? 0 };
            }, {
                timeout: 20000,
                maxWait: 5000
            });
            return result;
        }
        finally {
            await this.redis.del(lockKey);
        }
    }
};
exports.PointService = PointService;
exports.PointService = PointService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        mailer_1.MailerService])
], PointService);
//# sourceMappingURL=point.service.js.map