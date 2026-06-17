import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { PointService } from '../../modules/point/point.service';
import { RedisService } from '../../database/redis/redis.service';
import { PointType } from '@prisma/client';

@Injectable()
export class GachaService {
  constructor(
    private prisma: PrismaService,
    private pointService: PointService,
    private redis: RedisService,
  ) {}

  // --- [THÊM MỚI] Hàm này để Controller lấy trạng thái ---
  async getTodaySpinStatus(userId: string) {
    const today = new Date().toISOString().split('T')[0];
    const dailyKey = `gacha:${userId}:${today}`;
    const hasSpun = await this.redis.get(dailyKey);
    
    return { hasSpun: !!hasSpun };
  }
  // -------------------------------------------------------

  async spin(userId: string) {
    const today = new Date().toISOString().split('T')[0];
    const dailyKey = `gacha:${userId}:${today}`;
    const lockKey = `lock:gacha:${userId}`;

    // 1. Lock chống race (2 request đồng thời)
    const acquired = await this.redis.setNX(lockKey, '1', 5);
    if (!acquired) throw new BadRequestException('Đang xử lý...');

    // 2. [FIX review2-gacha - wiki 0088] CLAIM ngày bằng setNX ATOMIC (thay read-then-check + set-sau-
    // commit của round3). Round3 set marker SAU commit → nếu set lỗi sau khi đã cộng xu → user quay
    // lại = double-reward. Còn set TRONG tx (bản gốc) → tx rollback thì marker kẹt = mất lượt. Claim
    // ngay từ đầu (atomic) rồi NHẢ nếu award lỗi: vừa chống double, vừa cho thử lại khi rollback.
    const dayClaim = await this.redis.setNX(dailyKey, '1', 86400);
    if (!dayClaim) {
      await this.redis.del(lockKey);
      throw new BadRequestException('Hôm nay bạn đã hết lượt quay miễn phí!');
    }

    try {
      // Default Prisma timeout 5s — addPoints chạm 3 bảng + Redis write,
      // dễ vượt 5s ở dev local. Nâng lên 15s để né P2028 "Transaction already closed".
      const result = await this.prisma.$transaction(async (tx) => {
        const rand = Math.random() * 100;
        let reward = 0;
        let message = 'Chúc bạn may mắn lần sau';
        let won = false;

        if (rand < 50) {
           // Trượt
        } else if (rand < 90) {
           reward = 100; message = 'Trúng 100 xu'; won = true;
        } else {
           reward = 1000; message = 'NỔ HŨ 1000 xu'; won = true;
        }

        if (won && reward > 0) {
           await this.pointService.addPoints(
             userId,
             reward,
             PointType.EARN_GAME || 'EARN_GAME',
             `GACHA_${Date.now()}`,
             `Gacha: ${message}`,
             tx
           );
        }

        return { won, reward, message };
      }, { timeout: 15000, maxWait: 5000 });

      return result;
    } catch (e) {
      // [FIX review2-gacha - wiki 0088] award lỗi → tx ĐÃ rollback (chưa cộng xu) → NHẢ khoá-ngày
      // để user quay lại. (Khoá đã claim atomic ở đầu nên không double khi thành công.)
      await this.redis.del(dailyKey);
      throw e;
    } finally {
      await this.redis.del(lockKey);
    }
  }
}