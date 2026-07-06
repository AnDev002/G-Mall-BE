"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const config_1 = require("@nestjs/config");
const env_validation_1 = require("./common/config/env.validation");
const database_module_1 = require("./database/database.module");
const auth_module_1 = require("./modules/auth/auth.module");
const product_module_1 = require("./modules/product/product.module");
const cart_module_1 = require("./modules/cart/cart.module");
const mailer_1 = require("@nestjs-modules/mailer");
const redis_module_1 = require("./database/redis/redis.module");
const order_module_1 = require("./modules/order/order.module");
const tracking_module_1 = require("./modules/tracking/tracking.module");
const bullmq_1 = require("@nestjs/bullmq");
const chat_module_1 = require("./modules/chat/chat.module");
const category_module_1 = require("./modules/category/category.module");
const admin_users_module_1 = require("./modules/admin-users/admin-users.module");
const storage_module_1 = require("./modules/storage/storage.module");
const point_module_1 = require("./modules/point/point.module");
const shop_module_1 = require("./modules/shop/shop.module");
const friend_module_1 = require("./modules/friend/friend.module");
const home_settings_module_1 = require("./modules/home-settings/home-settings.module");
const game_module_1 = require("./modules/game/game.module");
const event_module_1 = require("./modules/event/event.module");
const content_module_1 = require("./modules/content/content.module");
const dashboard_module_1 = require("./modules/dashboard/dashboard.module");
const finance_module_1 = require("./modules/finance/finance.module");
const flash_sale_module_1 = require("./modules/flash-sale/flash-sale.module");
const blog_module_1 = require("./modules/blog/blog.module");
const brand_module_1 = require("./modules/brand/brand.module");
const ghn_module_1 = require("./modules/ghn/ghn.module");
const address_module_1 = require("./modules/address/address.module");
const charity_module_1 = require("./modules/charity/charity.module");
const newsletter_module_1 = require("./modules/newsletter/newsletter.module");
const complaint_module_1 = require("./modules/complaint/complaint.module");
const notification_module_1 = require("./modules/notification/notification.module");
const system_setting_module_1 = require("./common/services/system-setting.module");
const image_search_module_1 = require("./modules/image-search/image-search.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                validate: env_validation_1.validateEnv,
            }),
            mailer_1.MailerModule.forRootAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: async (configService) => {
                    const mailHost = configService.get('MAIL_HOST');
                    const mailUser = configService.get('MAIL_USER');
                    const mailPass = configService.get('MAIL_PASS');
                    console.log('--- KIỂM TRA MAIL CONFIG ---');
                    console.log('HOST:', mailHost);
                    console.log('USER:', mailUser);
                    console.log('PASS:', mailPass ? '****** (Đã có pass)' : 'MISSING (Thiếu pass)');
                    console.log('----------------------------');
                    return {
                        transport: {
                            host: mailHost,
                            port: 587,
                            secure: false,
                            auth: {
                                user: mailUser,
                                pass: mailPass,
                            },
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
            bullmq_1.BullModule.forRootAsync({
                imports: [config_1.ConfigModule],
                useFactory: async (configService) => {
                    const host = configService.get('REDIS_HOST');
                    const isLocal = host === 'localhost' || host === '127.0.0.1';
                    return {
                        connection: {
                            host: host,
                            port: configService.get('REDIS_PORT'),
                            password: configService.get('REDIS_PASSWORD'),
                            tls: isLocal ? undefined : { rejectUnauthorized: false },
                        },
                    };
                },
                inject: [config_1.ConfigService],
            }),
            database_module_1.DatabaseModule,
            redis_module_1.RedisModule,
            auth_module_1.AuthModule,
            product_module_1.ProductModule,
            cart_module_1.CartModule,
            order_module_1.OrderModule,
            tracking_module_1.TrackingModule,
            chat_module_1.ChatModule,
            category_module_1.CategoryModule,
            admin_users_module_1.AdminUsersModule,
            storage_module_1.StorageModule,
            point_module_1.PointModule,
            shop_module_1.ShopModule,
            friend_module_1.FriendModule,
            home_settings_module_1.HomeSettingsModule,
            game_module_1.GameModule,
            event_module_1.EventModule,
            content_module_1.ContentModule,
            dashboard_module_1.DashboardModule,
            finance_module_1.FinanceModule,
            flash_sale_module_1.FlashSaleModule,
            blog_module_1.BlogModule,
            brand_module_1.BrandModule,
            ghn_module_1.GhnModule,
            address_module_1.AddressModule,
            system_setting_module_1.SystemSettingModule,
            charity_module_1.CharityModule,
            newsletter_module_1.NewsletterModule,
            complaint_module_1.ComplaintModule,
            notification_module_1.NotificationModule,
            image_search_module_1.ImageSearchModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map