import { Module } from '@nestjs/common';
import { ComplaintController, AdminComplaintController } from './complaint.controller';
import { ComplaintService } from './complaint.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ComplaintController, AdminComplaintController],
  providers: [ComplaintService],
  exports: [ComplaintService],
})
export class ComplaintModule {}
