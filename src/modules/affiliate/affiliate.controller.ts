import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AffiliateService } from './affiliate.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { User } from '../../common/decorators/user.decorator';
import { RegisterAffiliateDto } from './dto/register-affiliate.dto';

/**
 * wiki 0105 — API cho NGƯỜI TIẾP THỊ.
 *
 * Mọi route đọc userId từ JWT, KHÔNG nhận qua param/body — nếu nhận từ ngoài thì bất
 * kỳ ai cũng xem/sửa được hồ sơ của người khác (đúng lớp lỗi IDOR đã sửa ở wiki 0091).
 */
@Controller('affiliate')
@UseGuards(JwtAuthGuard)
export class AffiliateController {
  constructor(private readonly affiliateService: AffiliateService) {}

  @Post('register')
  register(@User() user, @Body() dto: RegisterAffiliateDto) {
    return this.affiliateService.register(user.id, dto);
  }

  @Get('me')
  getMe(@User() user) {
    return this.affiliateService.getMe(user.id);
  }
}
