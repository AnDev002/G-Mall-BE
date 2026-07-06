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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
let ReviewService = class ReviewService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listPending(userId) {
        const orders = await this.prisma.order.findMany({
            where: {
                userId,
                status: 'DELIVERED',
                isReviewed: false,
            },
            include: {
                items: {
                    include: {
                        product: {
                            select: { id: true, name: true, slug: true, images: true, price: true },
                        },
                    },
                },
            },
            orderBy: { updatedAt: 'desc' },
            take: 50,
        });
        return orders;
    }
    async listMine(userId) {
        const [productReviews, shopReviews] = await Promise.all([
            this.prisma.productReview.findMany({
                where: { userId },
                include: {
                    product: {
                        select: { id: true, name: true, slug: true, images: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: 100,
            }),
            this.prisma.shopReview.findMany({
                where: { userId },
                include: {
                    shop: {
                        select: { id: true, name: true, avatar: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: 100,
            }),
        ]);
        return { productReviews, shopReviews };
    }
    async submitReview(userId, dto) {
        const { orderId, shopRating, shopComment, productReviews } = dto;
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { items: {
                    include: { product: true }
                } },
        });
        if (!order)
            throw new common_1.BadRequestException('Đơn hàng không tồn tại');
        if (order.userId !== userId)
            throw new common_1.BadRequestException('Bạn không có quyền đánh giá đơn hàng này');
        if (order.isReviewed)
            throw new common_1.BadRequestException('Đơn hàng này đã được đánh giá');
        const validStatuses = ['SHIPPING', 'DELIVERED', 'CONFIRMED'];
        if (!validStatuses.includes(order.status)) {
            throw new common_1.BadRequestException('Trạng thái đơn hàng chưa thể đánh giá');
        }
        const isPaid = order.paymentStatus === 'PAID' || String(order.paymentMethod).toLowerCase() === 'cod';
        if (!isPaid) {
            throw new common_1.BadRequestException('Đơn hàng chưa thanh toán nên chưa thể đánh giá');
        }
        if (!productReviews || productReviews.length === 0) {
            throw new common_1.BadRequestException('Phải có ít nhất một đánh giá sản phẩm');
        }
        const shopId = order.shopId || order.items[0]?.product?.shopId;
        if (!shopId) {
            throw new common_1.BadRequestException('Không tìm thấy thông tin Shop của đơn hàng này');
        }
        const orderProductIds = new Set(order.items.map((it) => it.productId));
        const seenReview = new Set();
        for (const pr of productReviews) {
            if (!orderProductIds.has(pr.productId)) {
                throw new common_1.BadRequestException('Sản phẩm không thuộc đơn hàng này');
            }
            if (seenReview.has(pr.productId)) {
                throw new common_1.BadRequestException('Mỗi sản phẩm chỉ được đánh giá 1 lần trong đơn.');
            }
            seenReview.add(pr.productId);
        }
        return await this.prisma.$transaction(async (tx) => {
            await tx.shopReview.create({
                data: {
                    userId,
                    shopId: shopId,
                    orderId,
                    rating: shopRating,
                    content: shopComment,
                },
            });
            for (const item of productReviews) {
                await tx.productReview.create({
                    data: {
                        userId,
                        productId: item.productId,
                        orderId,
                        rating: item.rating,
                        content: item.comment,
                    },
                });
                const pStats = await tx.productReview.aggregate({
                    where: { productId: item.productId },
                    _avg: { rating: true },
                    _count: { rating: true },
                });
                await tx.product.update({
                    where: { id: item.productId },
                    data: {
                        rating: pStats._avg.rating || 0,
                        reviewCount: { increment: 1 },
                    }
                });
            }
            const sStats = await tx.shopReview.aggregate({
                where: { shopId: shopId },
                _avg: { rating: true },
                _count: { rating: true },
            });
            await tx.shop.update({
                where: { id: shopId },
                data: {
                    rating: sStats._avg.rating || 0,
                    reviewCount: { increment: 1 }
                }
            });
            const updatedOrder = await tx.order.update({
                where: { id: orderId },
                data: {
                    isReviewed: true,
                },
            });
            return { success: true, message: 'Đánh giá thành công', order: updatedOrder };
        });
    }
};
exports.ReviewService = ReviewService;
exports.ReviewService = ReviewService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ReviewService);
//# sourceMappingURL=review.service.js.map