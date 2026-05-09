import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';

@Module({
  providers: [NotificationService],
  controllers: [NotificationController],
  exports: [NotificationService], // expose cho các module khác trigger notif
})
export class NotificationModule {}
