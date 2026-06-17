import { Controller, Post, Get, UseGuards, ForbiddenException } from '@nestjs/common';
import { DailyService } from './daily.service';
import { GachaService } from '../game/gacha.service';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt.guard';
import { User } from '../../common/decorators/user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Role } from '@prisma/client';

@Controller('events')
@UseGuards(JwtAuthGuard) 
export class EventController {
  constructor(
    private readonly dailyService: DailyService,
    private readonly gachaService: GachaService,
  ) {}

  @Post('daily-checkin')
  async dailyCheckIn(@User() user) {
    return this.dailyService.checkIn(user.id);
  }

  @Get('status')
  async getStatus(@User() user) {
    // 1. Lấy trạng thái checkin từ DailyService
    const dailyStatus = await this.dailyService.getDailyStatus(user.id);
    
    // 2. Lấy trạng thái Gacha từ GachaService (đã fix lỗi TS2339)
    const gachaStatus = await this.gachaService.getTodaySpinStatus(user.id);

    // 3. Trả về format đúng key mà Frontend cần
    return {
      // Sửa lỗi TS2339: checkInStatus.isCheckedIn -> dailyStatus.isCheckedInToday
      isCheckedInToday: dailyStatus.isCheckedInToday,
      hasSpunToday: gachaStatus.hasSpun,
      // Wiki 0068 B4: thiếu currentStreak → CheckInModal đọc res.currentStreak luôn
      // undefined → streak=0 → luôn highlight Ngày 1, không nhảy ngày sau check-in.
      currentStreak: dailyStatus.currentStreak,
    };
  }

  // [round14 FIX C2] reset-test xoá khoá-ngày Redis (checkin/gacha) → bất kỳ user
  // đăng nhập nào cũng wipe được khoá của mình rồi điểm danh/gacha lại = đúc xu vô hạn.
  // Khoá cứng: cấm CHẠY trong production + chỉ ADMIN mới gọi được route (mirror admin-gate).
  // Method resetDailyTest GIỮ NGUYÊN cho test gọi trực tiếp.
  @Post('reset-test')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async resetTest(@User() user) {
    if (process.env.NODE_ENV === 'production') throw new ForbiddenException();
    return this.dailyService.resetDailyTest(user.id);
  }
}