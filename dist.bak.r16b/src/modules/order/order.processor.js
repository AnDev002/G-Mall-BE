"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var OrderProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const cart_service_1 = require("../cart/cart.service");
const tracking_service_1 = require("../tracking/tracking.service");
const track_event_dto_1 = require("../tracking/dto/track-event.dto");
let OrderProcessor = OrderProcessor_1 = class OrderProcessor extends bullmq_1.WorkerHost {
    prisma;
    cartService;
    trackingService;
    logger = new common_1.Logger(OrderProcessor_1.name);
    constructor(prisma, cartService, trackingService) {
        super();
        this.prisma = prisma;
        this.cartService = cartService;
        this.trackingService = trackingService;
    }
    async process(job) {
        const { userId, orderData, trackingId } = job.data;
        const acquiredItems = [];
        try {
            for (const item of orderData.items) {
                const acquired = await this.cartService.acquireStock(item.productId, item.quantity);
                if (acquired) {
                    acquiredItems.push(item);
                }
                else {
                    throw new Error(`Sản phẩm ${item.productId} hết hàng.`);
                }
            }
            await this.prisma.$transaction(async (tx) => {
                const productIds = orderData.items.map(i => i.productId);
                const products = await tx.product.findMany({
                    where: { id: { in: productIds } },
                    select: { id: true, price: true, stock: true }
                });
                const productMap = new Map(products.map(p => [p.id, p]));
                let totalAmount = 0;
                const orderItemsData = [];
                for (const item of orderData.items) {
                    const product = productMap.get(item.productId);
                    if (!product)
                        throw new Error(`Sản phẩm ${item.productId} không tồn tại trong DB`);
                    const itemPrice = Number(product.price);
                    const itemTotal = itemPrice * item.quantity;
                    totalAmount += itemTotal;
                    orderItemsData.push({
                        productId: item.productId,
                        quantity: item.quantity,
                        price: itemPrice
                    });
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stock: { decrement: item.quantity } }
                    });
                }
                await tx.order.create({
                    data: {
                        id: trackingId,
                        userId: userId,
                        totalAmount: totalAmount,
                        status: 'PENDING',
                        paymentMethod: orderData.paymentMethod,
                        items: {
                            create: orderItemsData
                        }
                    }
                });
            });
            if (!orderData.isBuyNow) {
                await this.cartService.clearCart(userId);
            }
            await this.trackingService.trackEvent(userId, 'worker', {
                type: track_event_dto_1.EventType.PURCHASE,
                targetId: trackingId,
                metadata: { revenue: orderData.totalAmount }
            });
            this.logger.log(`✅ Order [${trackingId}] created successfully.`);
            return { success: true, orderId: trackingId };
        }
        catch (error) {
            this.logger.error(`❌ Order Failed [${trackingId}]: ${error.message}`);
            if (acquiredItems.length > 0) {
                this.logger.warn(`🔄 Rolling back Redis stock for ${acquiredItems.length} items...`);
                await Promise.all(acquiredItems.map(item => this.cartService.releaseStock(item.productId, item.quantity)));
            }
            throw error;
        }
    }
};
exports.OrderProcessor = OrderProcessor;
exports.OrderProcessor = OrderProcessor = OrderProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('order_queue', {
        concurrency: 5
    }),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cart_service_1.CartService,
        tracking_service_1.TrackingService])
], OrderProcessor);
//# sourceMappingURL=order.processor.js.map