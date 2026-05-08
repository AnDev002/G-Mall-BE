import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CharityService } from './charity.service';
import { Public } from 'src/common/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { User } from 'src/common/decorators/user.decorator';
import { CreateFundDto, UpdateFundDto } from './dto/create-fund.dto';
import { DonateDto } from './dto/donate.dto';
// Wiki 0032: Redis cache interceptor cho public list endpoint (TTL 30s)
import { RedisCacheInterceptor, CacheKey, CacheTTL } from 'src/common/interceptors/redis-cache.interceptor';

@Controller('charity')
export class CharityController {
  constructor(private readonly service: CharityService) {}

  // Public: danh sách quỹ đang hoạt động + chi tiết.
  // Wiki 0032: cache 30s — funds ít update, traffic cao, win throughput 5-10x
  @Public()
  @UseInterceptors(RedisCacheInterceptor)
  @CacheKey('charity:funds')
  @CacheTTL(30)
  @Get('funds')
  async listFunds(@Query('includeClosed') includeClosed?: string) {
    return this.service.listFunds(includeClosed === 'true');
  }

  @Public()
  @UseInterceptors(RedisCacheInterceptor)
  @CacheKey('charity:fund:slug')
  @CacheTTL(30)
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

  // Spec [0018]: Public — list campaign đang active để FE checkout cho user chọn.
  @Public()
  @Get('campaigns/active')
  async listActiveCampaigns() {
    return this.service.listActiveCampaignsForCheckout();
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

  // Spec [0018]: Campaign CRUD
  @Get('campaigns')
  async listCampaigns(@Query('includeInactive') includeInactive?: string) {
    return this.service.listCampaigns(includeInactive === 'true');
  }

  @Post('campaigns')
  async createCampaign(@Body() dto: any) {
    return this.service.createCampaign(dto);
  }

  @Patch('campaigns/:id')
  async updateCampaign(@Param('id') id: string, @Body() dto: any) {
    return this.service.updateCampaign(id, dto);
  }

  @Delete('campaigns/:id')
  async deleteCampaign(@Param('id') id: string) {
    return this.service.deleteCampaign(id);
  }
}
