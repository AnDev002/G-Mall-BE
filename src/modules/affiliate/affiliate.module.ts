import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AffiliateService } from './affiliate.service';
import { AffiliateController } from './affiliate.controller';

// wiki 0105 — hệ affiliate sản phẩm. Đứng RIÊNG, không nhét vào PointModule:
// PointModule phục vụ hệ xu/referral cũ, gộp vào sẽ trộn hai mô hình khác hẳn nhau.
@Module({
  imports: [DatabaseModule],
  controllers: [AffiliateController],
  providers: [AffiliateService],
  exports: [AffiliateService],
})
export class AffiliateModule {}
