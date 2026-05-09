import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config'; // Import ConfigService
import { validateEnv } from './common/config/env.validation';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProductModule } from './modules/product/product.module';
import { CartModule } from './modules/cart/cart.module';
import { MailerModule } from '@nestjs-modules/mailer'; 
import { RedisModule } from './database/redis/redis.module';
import { OrderModule } from './modules/order/order.module';
import { TrackingModule } from './modules/tracking/tracking.module'; 
import { BullModule } from '@nestjs/bullmq';
import { ChatModule } from './modules/chat/chat.module';
import { CategoryModule } from './modules/category/category.module';
import { AdminUsersModule } from './modules/admin-users/admin-users.module';
import { StorageModule } from './modules/storage/storage.module';
import { PointModule } from './modules/point/point.module';
import { ShopModule } from './modules/shop/shop.module';
import { FriendModule } from './modules/friend/friend.module';
import { HomeSettingsModule } from './modules/home-settings/home-settings.module';
import { GameModule } from './modules/game/game.module';
import { EventModule } from './modules/event/event.module';
import { ContentModule } from './modules/content/content.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { FinanceModule } from './modules/finance/finance.module';
import { FlashSaleModule } from './modules/flash-sale/flash-sale.module';
import { BlogModule } from './modules/blog/blog.module';
import { BrandModule } from './modules/brand/brand.module';
import { GhnModule } from './modules/ghn/ghn.module';
import { AddressModule } from './modules/address/address.module';
import { CharityModule } from './modules/charity/charity.module';
import { NewsletterModule } from './modules/newsletter/newsletter.module';
import { ComplaintModule } from './modules/complaint/complaint.module';
import { NotificationModule } from './modules/notification/notification.module';
import { SystemSettingModule } from './common/services/system-setting.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv, // Fail-fast nếu thiếu env bắt buộc (xem common/config/env.validation.ts)
    }),

    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        // --- ĐOẠN DEBUG QUAN TRỌNG ---
        const mailHost = configService.get<string>('MAIL_HOST');
        const mailUser = configService.get<string>('MAIL_USER');
        const mailPass = configService.get<string>('MAIL_PASS');

        console.log('--- KIỂM TRA MAIL CONFIG ---');
        console.log('HOST:', mailHost);
        console.log('USER:', mailUser); // Nếu hiện undefined -> Lỗi chưa đọc được .env
        console.log('PASS:', mailPass ? '****** (Đã có pass)' : 'MISSING (Thiếu pass)');
        console.log('----------------------------');

        return {
          transport: {
            host: mailHost,
            port: 587,
            secure: false,
            auth: {
              user: mailUser,
              pass: mailPass, // Nodemailer dùng key là 'pass', không phải 'password'
            },
            // Fix B-NEW-PERF-2 (wiki 0029): bound nodemailer timeouts.
            // Why: fire-and-forget sendMail (PERF-1 fix) vẫn có thể accumulate
            // trong Node event loop nếu SMTP chậm/down. Default nodemailer
            // timeouts là 2 phút (connect) + 10 phút (socket) — quá dài.
            // Giảm xuống 3s/8s để fail fast.
            // KHÔNG dùng pool:true — pool keep persistent connection, nếu SMTP
            // refused thì pool retry liên tục background → block event loop.
            connectionTimeout: 3000,
            greetingTimeout: 3000,
            socketTimeout: 8000,
          },
          defaults: {
            from: `"No Reply" <${mailUser}>`,
          },
        };
      },
    }),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const host = configService.get<string>('REDIS_HOST');
        const isLocal = host === 'localhost' || host === '127.0.0.1';

        return {
          connection: {
            host: host,
            port: configService.get<number>('REDIS_PORT'),
            password: configService.get<string>('REDIS_PASSWORD'),
            // Tắt TLS nếu chạy local
            tls: isLocal ? undefined : { rejectUnauthorized: false },
          },
        };
      },
      inject: [ConfigService],
    },),
    DatabaseModule,
    RedisModule,
    AuthModule,
    ProductModule,
    CartModule,
    OrderModule,
    TrackingModule,
    ChatModule,
    CategoryModule,
    AdminUsersModule,
    StorageModule,
    PointModule,
    ShopModule,
    FriendModule,
    HomeSettingsModule,
    GameModule,
    EventModule,
    ContentModule,
    DashboardModule,
    FinanceModule,
    FlashSaleModule,
    BlogModule,
    BrandModule,
    GhnModule,
    AddressModule,
    SystemSettingModule,
    CharityModule,
    NewsletterModule,
    ComplaintModule,
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
