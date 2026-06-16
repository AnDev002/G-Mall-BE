import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { SellerFinanceController } from './seller-finance.controller';
import { FinanceService } from './finance.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [FinanceController, SellerFinanceController],
  providers: [FinanceService],
})
export class FinanceModule {}