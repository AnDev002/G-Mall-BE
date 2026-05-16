import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service'; // Điều chỉnh path nếu cần (vd: 'src/database/prisma/prisma.service')
import { SubmitOrderReviewDto } from './dto/submit-review.dto';

@Injectable()
export class ReviewService {
  constructor(private prisma: PrismaService) {}

  // Wiki 0044: list các order đã DELIVERED nhưng chưa review → để hiển thị
  // ở /user/reviews tab "Cần đánh giá". FE gọi /reviews/pending.
  async listPending(userId: string) {
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

  // Wiki 0044: list mọi review user đã submit (product + shop). FE gọi /reviews/me.
  async listMine(userId: string) {
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
            select: { id: true, shopName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);
    return { productReviews, shopReviews };
  }

  async submitReview(userId: string, dto: SubmitOrderReviewDto) {
    const { orderId, shopRating, shopComment, productReviews } = dto;

    // 1. Kiểm tra đơn hàng
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: {
          include: { product: true } // 👇 Include thêm Product để lấy shopId
      } },
    });

    if (!order) throw new BadRequestException('Đơn hàng không tồn tại');
    if (order.userId !== userId) throw new BadRequestException('Bạn không có quyền đánh giá đơn hàng này');
    if (order.isReviewed) throw new BadRequestException('Đơn hàng này đã được đánh giá');
    
    // Chỉ cho phép đánh giá khi đơn hàng ở trạng thái hợp lệ (SHIPPING, DELIVERED hoặc CONFIRMED)
    const validStatuses = ['SHIPPING', 'DELIVERED', 'CONFIRMED'];
    if (!validStatuses.includes(order.status)) { 
        throw new BadRequestException('Trạng thái đơn hàng chưa thể đánh giá');
    }

    const shopId = order.shopId || order.items[0]?.product?.shopId;

    if (!shopId) {
        throw new BadRequestException('Không tìm thấy thông tin Shop của đơn hàng này');
    }

    return await this.prisma.$transaction(async (tx) => {
      // 2. Tạo Shop Review (Đánh giá Shop)
      await tx.shopReview.create({
        data: {
          userId,
          shopId: shopId,
          orderId,
          rating: shopRating,
          content: shopComment,
        },
      });

      // 3. Tạo Product Reviews (Đánh giá từng sản phẩm)
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

        // 3.1 Tính lại điểm trung bình cho Sản phẩm (Realtime)
        const pStats = await tx.productReview.aggregate({
          where: { productId: item.productId },
          _avg: { rating: true },
          _count: { rating: true },
        });
        
        await tx.product.update({
            where: { id: item.productId },
            data: { 
                rating: pStats._avg.rating || 0,
                reviewCount: pStats._count.rating 
            }
        });
      }

      // 4. Tính lại điểm trung bình cho Shop (Realtime)
      const sStats = await tx.shopReview.aggregate({
        where: { shopId: shopId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      // Kiểm tra xem model Shop có trường reviewCount không, nếu chưa có trong schema thì bỏ dòng reviewCount đi
      await tx.shop.update({
          where: { id: shopId },
          data: { 
              rating: sStats._avg.rating || 0,
              reviewCount: sStats._count.rating // Cần đảm bảo đã chạy prisma db push có field này
          }
      });

      // 5. Cập nhật trạng thái đơn hàng -> Hoàn tất & Đã đánh giá
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'DELIVERED', 
          isReviewed: true,
          paymentStatus: 'PAID', // Giả sử nhận hàng xong & đánh giá là đã thanh toán
        },
      });

      return { success: true, message: 'Đánh giá thành công', order: updatedOrder };
    });
  }
}