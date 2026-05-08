import { Module } from '@nestjs/common';
import { CharityService } from './charity.service';
import {
  AdminCharityController,
  CharityController,
} from './charity.controller';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../../database/redis/redis.module';

@Module({
  imports: [AuthModule, RedisModule], // JwtAuthGuard + RolesGuard dùng từ AuthModule; RedisService dùng cho cache invalidation
  controllers: [CharityController, AdminCharityController],
  providers: [CharityService],
  exports: [CharityService],
})
export class CharityModule {}
