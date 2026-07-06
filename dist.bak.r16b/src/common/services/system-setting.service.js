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
var SystemSettingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemSettingService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
let SystemSettingService = class SystemSettingService {
    static { SystemSettingService_1 = this; }
    prisma;
    logger = new common_1.Logger(SystemSettingService_1.name);
    cache = new Map();
    static CACHE_TTL_MS = 60_000;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async get(key, defaultValue) {
        const cached = this.cache.get(key);
        if (cached && cached.expiresAt > Date.now())
            return cached.value;
        const row = await this.prisma.systemSetting.findUnique({ where: { key } });
        const value = row?.value ?? defaultValue;
        if (value !== undefined) {
            this.cache.set(key, { value, expiresAt: Date.now() + SystemSettingService_1.CACHE_TTL_MS });
        }
        return value;
    }
    async getNumber(key, defaultValue) {
        const v = await this.get(key, String(defaultValue));
        const num = Number(v);
        return Number.isFinite(num) ? num : defaultValue;
    }
    async set(key, value, description) {
        await this.prisma.systemSetting.upsert({
            where: { key },
            create: { key, value, description },
            update: { value, description },
        });
        this.cache.delete(key);
    }
    async seedDefaults() {
        const defaults = [
            { key: 'CHARITY_COMMISSION_RATE', value: '0.01', description: '% trích từ phí hoa hồng vào quỹ từ thiện (1% mặc định)' },
            { key: 'CHARITY_CLAIM_WINDOW_DAYS', value: '7', description: 'Số ngày chờ qua hạn khiếu nại mới trích quỹ' },
            { key: 'ORDER_PLATFORM_FEE_RATE', value: '0.05', description: '% phí hoa hồng sàn ăn trên mỗi đơn (5% mặc định)' },
            { key: 'REFERRAL_REWARD_AMOUNT', value: '20000', description: 'Điểm thưởng cho người giới thiệu' },
            { key: 'REFERRAL_MIN_ORDER', value: '300000', description: 'Giá trị đơn đầu tối thiểu để tính referral' },
            { key: 'POINT_CONVERSION_RATE', value: '1', description: '1 điểm đổi được X đồng khi áp vào đơn' },
            { key: 'DAILY_CHECKIN_REWARD', value: '3000', description: 'Điểm thưởng mỗi ngày điểm danh' },
            { key: 'DAILY_CHECKIN_STREAK_BONUS', value: '10000', description: 'Bonus khi điểm danh đủ streak' },
            { key: 'DAILY_CHECKIN_STREAK_THRESHOLD', value: '10', description: 'Số ngày liên tục để được bonus' },
        ];
        for (const d of defaults) {
            const exists = await this.prisma.systemSetting.findUnique({ where: { key: d.key } });
            if (!exists) {
                await this.prisma.systemSetting.create({ data: d });
                this.logger.log(`Seeded SystemSetting: ${d.key}=${d.value}`);
            }
        }
    }
};
exports.SystemSettingService = SystemSettingService;
exports.SystemSettingService = SystemSettingService = SystemSettingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SystemSettingService);
//# sourceMappingURL=system-setting.service.js.map