import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

/**
 * Wrapper đọc/ghi SystemSetting (key-value, value lưu dạng string).
 *
 * Vì SystemSetting được đọc rất nhiều (mỗi order DELIVERED, mỗi referral check,
 * mỗi voucher apply) nên cache trong memory với TTL 60s — admin update qua
 * `set()` invalidate cache ngay.
 *
 * Spec [0018] dùng cho:
 * - CHARITY_COMMISSION_RATE = "0.01" (1% trích vào quỹ)
 * - CHARITY_CLAIM_WINDOW_DAYS = "7" (chờ qua hạn khiếu nại mới trích)
 * - ORDER_PLATFORM_FEE_RATE = "0.05" (phí hoa hồng sàn — sàn ăn 5%, charity trích từ đây)
 * - REFERRAL_REWARD_AMOUNT = "20000" (điểm thưởng người giới thiệu)
 * - REFERRAL_MIN_ORDER = "300000" (đơn đầu của người được giới thiệu phải ≥ mức này)
 * - POINT_CONVERSION_RATE = "1" (1 điểm = 1 đồng)
 * - DAILY_CHECKIN_REWARD = "3000" (điểm/ngày)
 * - DAILY_CHECKIN_STREAK_BONUS = "10000" (bonus khi đủ 10 ngày liên tục)
 * - DAILY_CHECKIN_STREAK_THRESHOLD = "10"
 */
@Injectable()
export class SystemSettingService {
  private readonly logger = new Logger(SystemSettingService.name);
  private cache = new Map<string, { value: string; expiresAt: number }>();
  private static readonly CACHE_TTL_MS = 60_000;

  constructor(private prisma: PrismaService) {}

  async get(key: string, defaultValue?: string): Promise<string | undefined> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    const value = row?.value ?? defaultValue;
    if (value !== undefined) {
      this.cache.set(key, { value, expiresAt: Date.now() + SystemSettingService.CACHE_TTL_MS });
    }
    return value;
  }

  async getNumber(key: string, defaultValue: number): Promise<number> {
    const v = await this.get(key, String(defaultValue));
    const num = Number(v);
    return Number.isFinite(num) ? num : defaultValue;
  }

  async set(key: string, value: string, description?: string) {
    await this.prisma.systemSetting.upsert({
      where: { key },
      create: { key, value, description },
      update: { value, description },
    });
    this.cache.delete(key); // Invalidate cache cho instance này. Multi-instance cần Redis pubsub.
  }

  /**
   * Seed defaults — gọi 1 lần ở module init. Chỉ tạo nếu chưa có (không override
   * giá trị admin đã đổi).
   */
  async seedDefaults() {
    const defaults: Array<{ key: string; value: string; description: string }> = [
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
}
