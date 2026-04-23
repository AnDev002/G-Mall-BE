import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CharityService } from './charity.service';
import { Public } from 'src/common/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { User } from 'src/common/decorators/user.decorator';
import { CreateFundDto, UpdateFundDto } from './dto/create-fund.dto';
import { DonateDto } from './dto/donate.dto';

@Controller('charity')
export class CharityController {
  constructor(private readonly service: CharityService) {}

  // Public: danh sách quỹ đang hoạt động + chi tiết.
  @Public()
  @Get('funds')
  async listFunds(@Query('includeClosed') includeClosed?: string) {
    return this.service.listFunds(includeClosed === 'true');
  }

  @Public()
  @Get('funds/:slug')
  async getFund(@Param('slug') slug: string) {
    return this.service.getFundBySlug(slug);
  }

  @Public()
  @Get('funds/:slug/donations')
  async listDonations(
    @Param('slug') slug: string,
    @Query('limit') limit?: string,
  ) {
    const fund = await this.service.getFundBySlug(slug);
    return this.service.listDonationsForFund(fund.id, Number(limit) || 20);
  }

  // Authenticated: donate.
  @UseGuards(JwtAuthGuard)
  @Post('donate')
  async donate(@User() user: any, @Body() dto: DonateDto) {
    return this.service.donate(user.id, dto);
  }
}

/**
 * Admin endpoints để tách khỏi public controller (dễ apply role guard per class).
 * Mount cùng prefix `/admin/charity` để match convention `/admin/*` của FE.
 */
@Controller('admin/charity')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminCharityController {
  constructor(private readonly service: CharityService) {}

  @Get('funds')
  async listAllFunds() {
    // Admin xem tất cả, kể cả PAUSED/CLOSED.
    return this.service.listFunds(true);
  }

  @Post('funds')
  async createFund(@Body() dto: CreateFundDto) {
    return this.service.createFund(dto);
  }

  @Patch('funds/:id')
  async updateFund(@Param('id') id: string, @Body() dto: UpdateFundDto) {
    return this.service.updateFund(id, dto);
  }
}
