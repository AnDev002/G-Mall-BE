// BE-1.0/modules/order/order.module.ts

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OrderController } from './controllers/order.controller';
import { OrderService } from './order.service'; // <--- THÊM
import { OrderProcessor } from './order.processor';
import { CartModule } from '../cart/cart.module'; // Check lại path tương đối
import { TrackingModule } from '../tracking/tracking.module'; 
import { PromotionModule } from '../promotion/promotion.module'; // <--- THÊM IMPORT
import { PointModule } from '../point/point.module';
import { DatabaseModule } from 'src/database/database.module';
import { AdminOrderController } from './controllers/admin-order.controller';
import { GhnModule } from '../ghn/ghn.module';
import { PaymentModule } from '../payment/payment.module';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';
import { CharityModule } from '../charity/charity.module';
import { NotificationModule } from '../notification/notification.module';
import { AffiliateModule } from '../affiliate/affiliate.module'; // wiki 0105
@Module({
  imports: [
    DatabaseModule,
    CartModule,
    TrackingModule,
    PromotionModule,
    PointModule,
    GhnModule,
    PaymentModule,
    CharityModule, // Cho OrderService.confirmOrderReceived hook auto-trích quỹ (spec [0018])
    NotificationModule, // wiki 0046: trigger notif khi cancel/confirm/status update
    AffiliateModule, // wiki 0105: sinh/chốt/huỷ hoa hồng affiliate theo vòng đời đơn
    BullModule.registerQueue({
      name: 'order_queue',
    }),
  ],
  controllers: [OrderController, AdminOrderController, ReviewController],
  providers: [
    OrderService,  
    ReviewService,
    OrderProcessor,
  ],
  exports: [OrderService] 
})
export class OrderModule {}