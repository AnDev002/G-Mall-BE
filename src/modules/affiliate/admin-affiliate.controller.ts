import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AdminAffiliateService } from './admin-affiliate.service';
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
  constructor(private readonly adminAffiliateService: AdminAffiliateService) {}

  @Get('accounts')
  listAccounts(@Query('status') status?: string, @Query('page') page?: string) {
    return this.adminAffiliateService.listAccounts(status, page);
  }

  @Patch('accounts/:id')
  review(@User() user, @Param('id') id: string, @Body() dto: ReviewAffiliateDto) {
    return this.adminAffiliateService.review(user.id, id, dto);
  }
}
