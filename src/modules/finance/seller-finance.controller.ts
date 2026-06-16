import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

// Wiki 0084: endpoint cho SELLER — xem ví + tạo/yêu cầu rút tiền (escrow). Admin duyệt qua FinanceController.
@Controller('seller/finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SELLER)
export class SellerFinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('wallet')
  async getMyWallet(@Request() req) {
    return this.financeService.getMyWallet(req.user.userId || req.user.id);
  }

  @Get('payouts')
  async getMyPayouts(@Request() req) {
    return this.financeService.getMyPayouts(req.user.userId || req.user.id);
  }

  @Post('payout')
  async requestPayout(@Request() req, @Body() body: { amount: number; bankInfo: string }) {
    return this.financeService.requestPayout(req.user.userId || req.user.id, body?.amount, body?.bankInfo);
  }
}
