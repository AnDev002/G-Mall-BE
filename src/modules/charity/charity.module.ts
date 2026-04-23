import { Module } from '@nestjs/common';
import { CharityService } from './charity.service';
import {
  AdminCharityController,
  CharityController,
} from './charity.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule], // JwtAuthGuard + RolesGuard dùng từ AuthModule
  controllers: [CharityController, AdminCharityController],
  providers: [CharityService],
  exports: [CharityService],
})
export class CharityModule {}
