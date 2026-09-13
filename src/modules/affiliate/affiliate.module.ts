import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../database/redis/redis.module';
import { SystemSettingModule } from '../../common/services/system-setting.module';
import { NotificationModule } from '../notification/notification.module';
import { FinanceModule } from '../finance/finance.module';
import { AffiliateService } from './affiliate.service';
import { AffiliateController, AffiliateClickController } from './affiliate.controller';
import { AdminAffiliateService } from './admin-affiliate.service';
import { AdminAffiliateController } from './admin-affiliate.controller';
import { AffiliateCommissionService } from './affiliate-commission.service';
import { AffiliateLinkService } from './affiliate-link.service';
import { AffiliateSettlementService } from './affiliate-settlement.service';

// wiki 0105 — hệ affiliate sản phẩm. Đứng RIÊNG, không nhét vào PointModule:
// PointModule phục vụ hệ xu/referral cũ, gộp vào sẽ trộn hai mô hình khác hẳn nhau.
//
// `AffiliateCommissionService` được export cho OrderModule dùng ở ba điểm móc:
// đặt đơn (sinh hoa hồng), giao xong (chốt + trừ doanh thu seller), huỷ đơn (huỷ theo).
//
// `FinanceModule` được import để DÙNG LẠI nguyên luồng rút tiền của seller thay vì
// dựng luồng thứ hai — hai đường rút tiền song song là hai chỗ phải đối soát.
@Module({
  // RedisModule: RateLimitGuard trên `POST /affiliate/click` (điểm cuối công khai
  // có ghi DB) dùng Redis INCR + TTL để đếm lượt gọi.
  imports: [DatabaseModule, RedisModule, SystemSettingModule, NotificationModule, FinanceModule],
  controllers: [AffiliateController, AffiliateClickController, AdminAffiliateController],
  providers: [
    AffiliateService,
    AdminAffiliateService,
    AffiliateCommissionService,
    AffiliateLinkService,
    AffiliateSettlementService,
  ],
  exports: [AffiliateService, AffiliateCommissionService, AffiliateSettlementService],
})
export class AffiliateModule {}
