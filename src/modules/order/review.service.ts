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
            select: { id: true, name: true, avatar: true },
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

    // Wiki 0086: đơn ONLINE chưa thanh toán (paymentStatus !== 'PAID') KHÔNG được đánh giá →
    // tránh "verified purchase" giả / thổi phồng rating. Chỉ cho phép khi COD hoặc đã PAID.
    // Dùng cùng convention với order.service.ts (paymentMethod là String tự do nên so sánh case-insensitive).
    const isPaid = order.paymentStatus === 'PAID' || String(order.paymentMethod).toLowerCase() === 'cod';
    if (!isPaid) {
        throw new BadRequestException('Đơn hàng chưa thanh toán nên chưa thể đánh giá');
    }

    // Không cho phép đánh dấu đơn "đã đánh giá" khi mảng review rỗng (0 review).
    if (!productReviews || productReviews.length === 0) {
        throw new BadRequestException('Phải có ít nhất một đánh giá sản phẩm');
    }

    const shopId = order.shopId || order.items[0]?.product?.shopId;

    if (!shopId) {
        throw new BadRequestException('Không tìm thấy thông tin Shop của đơn hàng này');
    }

    // Wiki 0075: chỉ cho đánh giá sản phẩm THỰC SỰ có trong đơn. Trước đây loop tạo
    // ProductReview theo productId từ DTO mà KHÔNG kiểm productId thuộc order.items →
    // user review + sửa rating sản phẩm chưa mua (fake review / phá rating đối thủ,
    // lại đội mác "đã mua" vì có orderId).
    const orderProductIds = new Set(order.items.map((it: any) => it.productId));
    // Wiki 0082: chống productId TRÙNG trong mảng → tạo nhiều ProductReview cho 1 đơn
    // (fake review / phá rating). One-review-per-product-per-order.
    const seenReview = new Set<string>();
    for (const pr of productReviews) {
        if (!orderProductIds.has(pr.productId)) {
            throw new BadRequestException('Sản phẩm không thuộc đơn hàng này');
        }
        if (seenReview.has(pr.productId)) {
            throw new BadRequestException('Mỗi sản phẩm chỉ được đánh giá 1 lần trong đơn.');
        }
        seenReview.add(pr.productId);
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

      // 5. Đánh dấu đơn đã được đánh giá.
      // Wiki 0082: KHÔNG còn ép paymentStatus='PAID' ở đây — đó là BYPASS thanh toán (đơn
      // online/COD chưa trả vẫn thành "đã thanh toán" chỉ bằng cách viết review). Chỉ đánh dấu
      // đã review; trạng thái thanh toán do IPN / luồng giao hàng quyết định.
      // DECOUPLE: KHÔNG ép status='DELIVERED' ở đây. Cho phép đánh giá khi đơn còn SHIPPING,
      // nhưng không được tự nhảy state — nếu set DELIVERED thì confirmOrderReceived sẽ bị
      // khoá và user mất phần thưởng (xu/điểm) của bước "đã nhận hàng".
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          isReviewed: true,
        },
      });

      return { success: true, message: 'Đánh giá thành công', order: updatedOrder };
    });
  }
}