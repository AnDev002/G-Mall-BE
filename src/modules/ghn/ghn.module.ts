import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GhnService } from './ghn.service';
import { GhnController } from './ghn.controller';
import { DatabaseModule } from 'src/database/database.module';
import { ShopModule } from '../shop/shop.module';

@Module({
  imports: [HttpModule, DatabaseModule, ShopModule],
  controllers: [GhnController],
  providers: [GhnService],
  exports: [GhnService],
})
export class GhnModule {}