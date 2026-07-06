"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const order_controller_1 = require("./controllers/order.controller");
const order_service_1 = require("./order.service");
const order_processor_1 = require("./order.processor");
const cart_module_1 = require("../cart/cart.module");
const tracking_module_1 = require("../tracking/tracking.module");
const promotion_module_1 = require("../promotion/promotion.module");
const point_module_1 = require("../point/point.module");
const database_module_1 = require("../../database/database.module");
const admin_order_controller_1 = require("./controllers/admin-order.controller");
const ghn_module_1 = require("../ghn/ghn.module");
const payment_module_1 = require("../payment/payment.module");
const review_service_1 = require("./review.service");
const review_controller_1 = require("./review.controller");
const charity_module_1 = require("../charity/charity.module");
const notification_module_1 = require("../notification/notification.module");
let OrderModule = class OrderModule {
};
exports.OrderModule = OrderModule;
exports.OrderModule = OrderModule = __decorate([
    (0, common_1.Module)({
        imports: [
            database_module_1.DatabaseModule,
            cart_module_1.CartModule,
            tracking_module_1.TrackingModule,
            promotion_module_1.PromotionModule,
            point_module_1.PointModule,
            ghn_module_1.GhnModule,
            payment_module_1.PaymentModule,
            charity_module_1.CharityModule,
            notification_module_1.NotificationModule,
            bullmq_1.BullModule.registerQueue({
                name: 'order_queue',
            }),
        ],
        controllers: [order_controller_1.OrderController, admin_order_controller_1.AdminOrderController, review_controller_1.ReviewController],
        providers: [
            order_service_1.OrderService,
            review_service_1.ReviewService,
            order_processor_1.OrderProcessor,
        ],
        exports: [order_service_1.OrderService]
    })
], OrderModule);
//# sourceMappingURL=order.module.js.map