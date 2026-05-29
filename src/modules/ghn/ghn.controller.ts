import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GhnService } from './ghn.service';
import { Public } from 'src/common/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { User } from 'src/common/decorators/user.decorator';
import { ShopService } from '../shop/shop.service';
import {
  BulkChangePickupDateDto,
  BulkRequestPickupDto,
  BulkUpdateAddressDto,
} from './dto/bulk-shipping.dto';

@Controller('ghn')
export class GhnController {
  constructor(
    private readonly ghnService: GhnService,
    private readonly shopService: ShopService,
  ) {}

  @Post('calculate-fee')
  async calculateFee(@Body() body: { toDistrictId: number; toWardCode: string; weight: number; insuranceValue: number }) {
    const total = await this.ghnService.calculateFee(body);
    return { total };
  }

  @Post('calculate-time')
  async calculateTime(@Body() body: { toDistrictId: number; toWardCode: string }) {
    const leadtimeTimestamp = await this.ghnService.calculateExpectedDeliveryTime(body);
    return { leadtime: leadtimeTimestamp };
  }

  @Public()
  @Get('provinces')
  async getProvinces() {
    return this.ghnService.getProvinces();
  }

  @Public()
  @Get('districts')
  async getDistricts(@Query('province_id') provinceId: string) {
    return this.ghnService.getDistricts(Number(provinceId));
  }

  @Public()
  @Get('wards')
  async getWards(@Query('district_id') districtId: string) {
    return this.ghnService.getWards(Number(districtId));
  }

  // ===== BULK SHIPPING (audit 0053 Seller #1, #2) =====
  // Helper: lấy shopId từ JWT user — đảm bảo seller chỉ thao tác trên đơn của shop mình.
  private async getShopIdOrThrow(userId: string): Promise<string> {
    const shop = await this.shopService.getShopByOwnerId(userId);
    if (!shop) throw new BadRequestException('Tài khoản chưa có Shop');
    return shop.id;
  }

  @Post('seller/bulk/update-address')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER)
  async bulkUpdateAddress(@User() user: any, @Body() dto: BulkUpdateAddressDto) {
    const shopId = await this.getShopIdOrThrow(user.id);
    const results = await this.ghnService.bulkUpdateAddress(shopId, dto);
    return {
      successCount: results.filter(r => r.ok).length,
      failCount: results.filter(r => !r.ok).length,
      results,
    };
  }

  @Post('seller/bulk/change-pickup-date')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER)
  async bulkChangePickupDate(@User() user: any, @Body() dto: BulkChangePickupDateDto) {
    const shopId = await this.getShopIdOrThrow(user.id);
    const results = await this.ghnService.bulkChangePickupDate(shopId, dto);
    return {
      successCount: results.filter(r => r.ok).length,
      failCount: results.filter(r => !r.ok).length,
      results,
    };
  }

  @Post('seller/bulk/request-pickup')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER)
  async bulkRequestPickup(@User() user: any, @Body() dto: BulkRequestPickupDto) {
    const shopId = await this.getShopIdOrThrow(user.id);
    const results = await this.ghnService.bulkRequestPickup(shopId, dto);
    return {
      successCount: results.filter(r => r.ok).length,
      failCount: results.filter(r => !r.ok).length,
      results,
    };
  }
}
