import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminAffiliateService } from './admin-affiliate.service';
import { AffiliateSettlementService } from './affiliate-settlement.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { User } from '../../common/decorators/user.decorator';
import { Role } from '@prisma/client';
import { ReviewAffiliateDto } from './dto/review-affiliate.dto';

// wiki 0105 — duyệt hồ sơ tiếp thị. Chỉ ADMIN.
@Controller('admin/affiliate')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminAffiliateController {
  constructor(
    private readonly adminAffiliateService: AdminAffiliateService,
    private readonly settlementService: AffiliateSettlementService,
  ) {}

  @Get('accounts')
  listAccounts(@Query('status') status?: string, @Query('page') page?: string) {
    return this.adminAffiliateService.listAccounts(status, page);
  }

  @Patch('accounts/:id')
  review(@User() user, @Param('id') id: string, @Body() dto: ReviewAffiliateDto) {
    return this.adminAffiliateService.review(user.id, id, dto);
  }

  /** Đối soát hoa hồng toàn sàn. */
  @Get('commissions')
  listCommissions(
    @Query('status') status?: string,
    @Query('period') period?: string,
    @Query('page') page?: string,
  ) {
    return this.adminAffiliateService.listCommissions(status, period, page);
  }

  /**
   * Chốt sổ TAY.
   *
   * Cùng một hàm idempotent với tác vụ định kỳ: nếu tác vụ nền chết thì admin vẫn chốt
   * được, và bấm nhầm hai lần cũng không cộng tiền hai lần
   * (`AffiliateSettlement @@unique([accountId, period])`).
   */
  @Post('settle')
  settleNow() {
    return this.settlementService.settleNow();
  }
}
