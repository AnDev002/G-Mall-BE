import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PointService } from '../point/point.service';
import { RedisService } from '../../database/redis/redis.service';
import { PointType } from '@prisma/client';
import moment from 'moment'; // [FIX review-H8 - wiki 0088] khoá-ngày dùng ngày LOCAL khớp PointService

@Injectable()
export class DailyService {
  // Wiki 0068 B4 (sync spec G3 / wiki 0046,0048): 10 ngày, mỗi ngày 3000 xu,
  // ngày 10 thưởng thêm 10000 (= 13000). Trước đây BE vẫn để 7 ngày [100..1000]
  // trong khi FE đã đổi 10 ngày 3000 (wiki 0048 sót BE) → user thấy "Ngày 1 +3000"
  // nhưng thực nhận 100, và chu kỳ ngày lệch nhau.
  private readonly REWARDS = [3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 13000];

  constructor(
    private pointService: PointService,
    private redisService: RedisService
  ) {}

  async checkIn(userId: string) {
    const today = moment().format('YYYY-MM-DD'); // [FIX review-H8] ngày LOCAL (trùng key với PointService)
    const redisKey = `checkin:${userId}:${today}`;
    const streakKey = `streak:${userId}`;

    // 1. CLAIM ngày hôm nay bằng setNX (ATOMIC) — wiki 0077: chống double check-in.
    // Trước đây GET redisKey rồi mới SET (cuối hàm) = check-then-act KHÔNG atomic →
    // nhiều request song song cùng qua cửa → cộng điểm 2+ lần (RACE-5 fail).
    // setNX chỉ 1 request giành được ngày; các request còn lại trả false → chặn.
    const claimed = await this.redisService.setNX(redisKey, '1', 86400);
    if (!claimed) {
        throw new BadRequestException('Hôm nay bạn đã nhận thưởng rồi!');
    }

    // 2. Tính toán Streak (Chuỗi ngày)
    let currentStreak = 0;
    const lastCheckInDate = await this.redisService.get(`last_checkin_date:${userId}`);
    
    if (lastCheckInDate) {
        const lastDate = new Date(lastCheckInDate);
        const currDate = new Date(today);
        const diffTime = Math.abs(currDate.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        if (diffDays === 1) {
            // Nếu hôm qua đã điểm danh -> Tăng streak
            const savedStreak = await this.redisService.get(streakKey);
            currentStreak = savedStreak ? parseInt(savedStreak) : 0;
        } else if (diffDays > 1) {
            // Nếu bỏ lỡ 1 ngày -> Reset về 0
            currentStreak = 0;
        }
        // Nếu diffDays == 0 là cùng ngày (đã chặn ở trên rồi)
    }

    // Streak chạy 0..9 (tương ứng ngày 1..10). Reset chu kỳ sau 10 ngày.
    if (currentStreak >= 10) currentStreak = 0;

    const rewardPoints = this.REWARDS[currentStreak];
    const dayLabel = currentStreak + 1; // Ngày hiển thị (1-7)

    const refId = `DAILY_${userId}_${today}`;
    
    try {
        const result = await this.pointService.processTransaction(
            userId,
            rewardPoints,
            PointType.EARN_DAILY,
            refId,
            `Điểm danh Ngày ${dayLabel}`
        );
        
        // 3. Lưu trạng thái
        await this.redisService.set(redisKey, '1', 86400); // Đánh dấu hôm nay xong
        await this.redisService.set(`last_checkin_date:${userId}`, today, 86400 * 2); // Lưu ngày checkin cuối
        await this.redisService.set(streakKey, (currentStreak + 1).toString(), 86400 * 2); // Lưu streak mới

        return { 
            message: `Điểm danh Ngày ${dayLabel} thành công!`,
            reward: rewardPoints,
            streak: currentStreak + 1,
            currentPoints: result.newBalance 
        };

    } catch (e) {
        // Wiki 0077: award lỗi → nhả claim ngày (đã setNX ở đầu hàm) để user còn
        // thử lại, tránh khoá nhầm cả ngày khi chưa thực nhận điểm.
        await this.redisService.del(redisKey);
        if (e instanceof ConflictException) {
             throw new BadRequestException('Hôm nay bạn đã điểm danh rồi!');
        }
        throw e;
    }
  }

  async getDailyStatus(userId: string) {
    const today = moment().format('YYYY-MM-DD'); // [FIX review-H8] ngày LOCAL (trùng key với PointService)
    const checkinKey = `checkin:${userId}:${today}`;
    const streakKey = `streak:${userId}`;

    const [hasCheckedIn, streakStr] = await Promise.all([
        this.redisService.get(checkinKey),
        this.redisService.get(streakKey)
    ]);

    const currentStreak = streakStr ? parseInt(streakStr) : 0;

    return {
        isCheckedInToday: !!hasCheckedIn,
        currentStreak: currentStreak // Frontend cần cái này để highlight ô quà
    };
  }

  async resetDailyTest(userId: string) {
    const today = moment().format('YYYY-MM-DD'); // [FIX review-H8] ngày LOCAL (trùng key với PointService)
    const checkinKey = `checkin:${userId}:${today}`;
    const gachaKey = `gacha:${userId}:${today}`;
    
    // Xóa key trong Redis
    await this.redisService.del(checkinKey);
    await this.redisService.del(gachaKey);
    
    // (Tùy chọn) Nếu muốn reset luôn chuỗi streak về 0 để test ngày 1
    // await this.redisService.del(`streak:${userId}`);
    // await this.redisService.del(`last_checkin_date:${userId}`);

    return { message: 'Đã reset! Bạn có thể điểm danh lại.' };
  }
}