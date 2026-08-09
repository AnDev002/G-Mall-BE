import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { PointService } from './point.service';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt.guard';
import { User } from '../../common/decorators/user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Role } from '@prisma/client';

@Controller('points')
@UseGuards(JwtAuthGuard)
export class PointController {
  constructor(
    private readonly pointService: PointService,
  ) {}

  // API: GET /points/me
  @Get('me')
  async getMyPointInfo(@User() user) {
    return this.pointService.getMyPointInfo(user.id);
  }

  // API: GET /points/history
  @Get('history')
  async getHistory(@User() user) {
    return this.pointService.getHistory(user.id);
  }

  // wiki 0095 B6: số liệu + luật thưởng cho trang /user/affiliate.
  // Chỉ đọc dữ liệu của chính mình (user.id từ JWT), không nhận id qua param.
  @Get('affiliate')
  async getAffiliateStats(@User() user) {
    return this.pointService.getAffiliateStats(user.id);
  }

  // API: POST /points/check-in
  @Post('check-in')
  async checkIn(@User() user) {
    // [FIX LỖI TẠI ĐÂY]: Gọi đúng hàm dailyCheckIn đã định nghĩa trong service
    return this.pointService.dailyCheckIn(user.id);
  }

  @Post('transfer/init')
  async initiateTransfer(
    @User() user,
    @Body() body: { receiverId: string; amount: number }
  ) {
    return this.pointService.initiateTransfer(user.id, body.receiverId, body.amount);
  }

  // Fix B-NEW-8 (wiki 0026): thêm @UseGuards(RolesGuard). Trước đây chỉ có
  // @Roles decorator nhưng không có guard tương ứng -> mọi authenticated user
  // đều xem/sửa được tỷ giá điểm (latent security).
  @Get('rate')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async getRate() {
    const rate = await this.pointService.getConversionRate();
    return { rate };
  }

  @Post('rate')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async updateConversionRate(@Body() body: { amount: number }) {
    return this.pointService.updateConversionRate(body.amount);
  }

  @Post('transfer/confirm')
  async confirmTransfer(
    @User() user,
    @Body() body: { otp: string }
  ) {
    return this.pointService.confirmTransfer(user.id, body.otp);
  }
}