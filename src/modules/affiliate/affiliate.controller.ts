import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AffiliateService } from './affiliate.service';
import { AffiliateLinkService } from './affiliate-link.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt.guard';
import { Public } from '../../common/decorators/public.decorator';
import { User } from '../../common/decorators/user.decorator';
import { RegisterAffiliateDto } from './dto/register-affiliate.dto';
import { CreateAffiliateLinkDto } from './dto/create-affiliate-link.dto';
import { RecordClickDto } from './dto/record-click.dto';
import { RequestPayoutDto } from './dto/request-payout.dto';
import { AffiliateSettlementService } from './affiliate-settlement.service';
import { FinanceService } from '../finance/finance.service';
import { RateLimit, RateLimitGuard } from '../../common/guards/rate-limit.guard';

/**
 * wiki 0105 — API cho NGƯỜI TIẾP THỊ.
 *
 * Mọi route (trừ `/click`) đọc userId từ JWT, KHÔNG nhận qua param/body — nhận từ ngoài
 * là mở cửa cho việc xem/sửa hồ sơ người khác (lớp lỗi IDOR đã sửa ở wiki 0091).
 */
@Controller('affiliate')
@UseGuards(JwtAuthGuard)
export class AffiliateController {
  constructor(
    private readonly affiliateService: AffiliateService,
    private readonly linkService: AffiliateLinkService,
    private readonly settlementService: AffiliateSettlementService,
    private readonly financeService: FinanceService,
  ) {}

  @Post('register')
  register(@User() user, @Body() dto: RegisterAffiliateDto) {
    return this.affiliateService.register(user.id, dto);
  }

  @Get('me')
  getMe(@User() user) {
    return this.affiliateService.getMe(user.id);
  }

  @Get('commissions')
  getCommissions(@User() user, @Query('status') status?: string, @Query('page') page?: string) {
    return this.affiliateService.getCommissions(user.id, status, page);
  }

  // --- Sản phẩm & link ---

  /** Danh mục sản phẩm của MỌI shop đang bật affiliate — yêu cầu chính của khách. */
  @Get('products')
  listProducts(
    @Query('search') search?: string,
    @Query('shopId') shopId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
  ) {
    return this.linkService.listProducts({ search, shopId, categoryId, sort, page });
  }

  /** Các shop đang có hàng bật affiliate — để FE dựng bộ lọc. */
  @Get('shops')
  listShops() {
    return this.linkService.listShops();
  }

  @Post('links')
  createLink(@User() user, @Body() dto: CreateAffiliateLinkDto) {
    return this.linkService.createOrGetLink(user.id, dto.productId);
  }

  @Get('links')
  listLinks(@User() user, @Query('page') page?: string) {
    return this.linkService.listMyLinks(user.id, page);
  }

  // --- Chốt sổ & rút tiền ---

  @Get('settlements')
  listSettlements(@User() user) {
    return this.settlementService.listMySettlements(user.id);
  }

  @Get('payouts')
  listPayouts(@User() user) {
    return this.financeService.getMyPayouts(user.id);
  }

  /**
   * Rút hoa hồng đã chốt sổ.
   *
   * Chặn ở tầng hồ sơ trước khi gọi FinanceService: nếu không, đây thành một cổng rút
   * tiền MỞ cho mọi tài khoản đã đăng nhập — ai được hoàn tiền vào ví vì lý do khác
   * cũng rút được qua đây mà không đi đúng quy trình.
   */
  @Post('payout')
  async requestPayout(@User() user, @Body() dto: RequestPayoutDto) {
    await this.affiliateService.requireApprovedAffiliate(user.id);
    return this.financeService.requestPayout(user.id, dto.amount, dto.bankInfo);
  }
}

/**
 * Ghi nhận click — tách thành controller RIÊNG vì nó là điểm cuối CÔNG KHAI.
 *
 * Người bấm link tiếp thị hầu hết là khách chưa có tài khoản; nếu route này nằm trong
 * controller có `@UseGuards(JwtAuthGuard)` ở cấp lớp thì mọi lượt click của khách vãng
 * lai — tức phần lớn lưu lượng — sẽ bị chặn và không bao giờ được ghi nhận.
 * `OptionalJwtAuthGuard` vẫn đọc được user nếu họ có đăng nhập, để loại click tự thân.
 */
@Controller('affiliate')
export class AffiliateClickController {
  constructor(private readonly linkService: AffiliateLinkService) {}

  /**
   * Có `RateLimitGuard` vì đây là điểm cuối CÔNG KHAI CÓ GHI DATABASE — hình dạng mà kẻ
   * xấu thích nhất. Việc gộp click trùng IP trong 60s chỉ giới hạn số BẢN GHI, không
   * giới hạn số LƯỢT GỌI: mỗi lượt vẫn tốn một truy vấn tra link. Chốt ở tầng trước.
   *
   * 30 lượt/phút/IP là rộng rãi cho người dùng thật (một người mở vài chục sản phẩm
   * trong một phút đã là bất thường) nhưng đủ chặn kẻ gọi vòng lặp.
   */
  @Public()
  @UseGuards(OptionalJwtAuthGuard, RateLimitGuard)
  @RateLimit({ points: 30, windowSeconds: 60, keyBy: 'ip+path' })
  @Post('click')
  recordClick(@Req() req: any, @Body() dto: RecordClickDto) {
    const ip =
      (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      null;
    const ua = (req.headers?.['user-agent'] as string) ?? null;
    const viewerId = req.user?.id ?? null;
    return this.linkService.recordClick(dto.code, ip, ua, viewerId);
  }
}
