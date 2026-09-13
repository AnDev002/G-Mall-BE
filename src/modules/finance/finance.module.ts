import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { SellerFinanceController } from './seller-finance.controller';
import { FinanceService } from './finance.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [FinanceController, SellerFinanceController],
  providers: [FinanceService],
  // wiki 0105: AffiliateModule dùng lại nguyên luồng rút tiền này cho NGƯỜI TIẾP THỊ.
  // Hạ tầng `PayoutRequest` vốn chạy trên `User` chứ không gắn cứng vào shop — chỗ duy
  // nhất khoá theo vai là controller `@Roles(SELLER)`, nên chỉ cần mở thêm một cổng.
  exports: [FinanceService],
})
export class FinanceModule {}