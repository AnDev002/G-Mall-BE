import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CartService } from '../../modules/cart/cart.service';
import { PromotionService } from '../../modules/promotion/promotion.service';
import { TrackingService } from '../../modules/tracking/tracking.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { EventType } from '../../modules/tracking/dto/track-event.dto';
import { PointService } from '../../modules/point/point.service';
import { PointType, Prisma } from '@prisma/client';
import { GhnService } from '../../modules/ghn/ghn.service';
import { PaymentService } from '../payment/payment.service';

const GIFT_WRAP_PRICES = [0, 20000, 50000]; 
const CARD_PRICES = [0, 5000, 15000]; 

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private prisma: PrismaService,
    private cartService: CartService,
    private promotionService: PromotionService,
    private trackingService: TrackingService,
    private pointService: PointService,
    private ghnService: GhnService,
    private paymentService: PaymentService
  ) {}

  // --- HELPER: Lấy items và check tồn kho & tính khối lượng ---
  private async resolveItems(userId: string, dto: CreateOrderDto) {
    let itemsToCheckout: { productId: string; quantity: number }[] = [];

    if (dto.isBuyNow && dto.items?.length) {
      itemsToCheckout = dto.items;
    } else {
      const cart = await this.cartService.getCart(userId);
      if (cart?.items) {
        itemsToCheckout = cart.items.map(i => ({
          productId: i.productId,
          quantity: i.quantity
        }));
      }
    }

    if (!itemsToCheckout.length) throw new BadRequestException('Giỏ hàng trống');

    const productIds = itemsToCheckout.map(i => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, price: true, stock: true, weight: true } 
    });

    const finalItems = itemsToCheckout.map(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product) throw new NotFoundException(`Sản phẩm ID ${item.productId} không tồn tại`);
      
      if (product.stock < item.quantity) throw new BadRequestException(`Sản phẩm ${product.name} không đủ hàng`);

      // Mặc định weight là 200g nếu chưa cấu hình
      const itemWeight = (product.weight || 200);

      return {
        productId: product.id,
        name: product.name,
        price: Number(product.price),
        quantity: item.quantity,
        subtotal: Number(product.price) * item.quantity,
        weight: itemWeight * item.quantity, // Tổng cân nặng của item line này
      };
    });

    const subtotal = finalItems.reduce((sum, i) => sum + i.subtotal, 0);
    return { finalItems, subtotal };
  }

  // --- 1. TÍNH TOÁN GIÁ & PHÍ SHIP (Preview) ---
  async previewOrder(userId: string, dto: CreateOrderDto) {
    const { finalItems, subtotal } = await this.resolveItems(userId, dto);

    // [GHN UPDATE] Tính tổng khối lượng đơn hàng
    const totalWeight = finalItems.reduce((sum, item) => sum + item.weight, 0);

    // [GHN UPDATE] Tính phí ship động
    let shippingFee = 30000; // Giá fallback
    const receiver = dto.receiverInfo;

    // Yêu cầu DTO receiverInfo phải có districtId và wardCode (được gửi từ Frontend)
    if (receiver && receiver['districtId'] && receiver['wardCode']) {
        try {
            shippingFee = await this.ghnService.calculateFee({
                toDistrictId: Number(receiver['districtId']),
                toWardCode: String(receiver['wardCode']),
                weight: totalWeight,
                insuranceValue: subtotal // Khai báo giá trị để tính bảo hiểm
            });
        } catch (error) {
            this.logger.warn('Không thể tính phí GHN, dùng phí mặc định', error);
        }
    }

    let giftFee = 0;
    if (dto.isGift) {
      const wrapPrice = GIFT_WRAP_PRICES[dto.giftWrapIndex || 0] || 0;
      const cardPrice = CARD_PRICES[dto.cardIndex || 0] || 0;
      giftFee = wrapPrice + cardPrice;
    }

    const { totalDiscount, appliedVouchers } = await this.promotionService.validateAndCalculateVouchers(
      dto.voucherIds || [],
      subtotal,
      finalItems
    );

    const coinDiscount = dto.useCoins ? 1000 : 0; 

    // Đảm bảo không âm
    const total = Math.max(0, subtotal + shippingFee + giftFee - totalDiscount - coinDiscount);

    return {
      items: finalItems,
      subtotal,
      shippingFee, // Phí ship đã tính toán từ GHN
      giftFee,
      discounts: {
        voucher: totalDiscount,
        coin: coinDiscount
      },
      appliedVouchers, 
      total
    };
  }

  // ... (Hàm findAll giữ nguyên) ...
  async findAll(params: { page?: number; limit?: number; status?: string; search?: string; }) {
    const { page = 1, limit = 10, status, search } = params;
    const skip = (page - 1) * limit;
    const where: Prisma.OrderWhereInput = {};
    if (status && status !== 'ALL') { where.status = status as any; }
    if (search) {
      where.OR = [
        { id: { contains: search } },
        { recipientName: { contains: search } },
        { user: { email: { contains: search } } },
      ];
    }
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where, skip, take: Number(limit), orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true, avatar: true } }, items: true },
      }),
      this.prisma.order.count({ where }),
    ]);
    return { data: orders, meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) } };
  }

  // --- 2. TẠO ORDER ---
  async createOrder(userId: string, dto: CreateOrderDto) {
    const preview = await this.previewOrder(userId, dto);
    const order = await this.prisma.$transaction(async (tx) => {
      // A. Trừ kho
      for (const item of preview.items) {
        const update = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } }
        });
        if (update.count === 0) throw new BadRequestException(`Sản phẩm ${item.name} vừa hết hàng.`);
      }

      // B. Xử lý Voucher
      if (preview.appliedVouchers.length > 0) {
        for (const voucher of preview.appliedVouchers) {
          const vUpdate = await tx.voucher.updateMany({
            where: { id: voucher.id, usageCount: { lt: voucher.usageLimit }, isActive: true },
            data: { usageCount: { increment: 1 } }
          });
          if (vUpdate.count === 0) throw new BadRequestException(`Voucher ${voucher.code} đã hết lượt dùng.`);

          const userVoucher = await tx.userVoucher.findUnique({
              where: { userId_voucherId: { userId, voucherId: voucher.id } }
          });
          if (userVoucher) {
             await tx.userVoucher.update({ where: { id: userVoucher.id }, data: { isUsed: true, usedAt: new Date() } });
          } else {
             await tx.userVoucher.create({ data: { userId, voucherId: voucher.id, isUsed: true, usedAt: new Date() } });
          }
        }
      }

      // C. Lưu Order vào DB
      const receiver = dto.receiverInfo || {};
      
      const newOrder = await tx.order.create({
        data: {
          userId,
          totalAmount: preview.total,
          shippingFee: preview.shippingFee, // Lưu phí ship GHN vào DB
          
          recipientName: receiver.name || dto.senderInfo?.name,
          recipientPhone: receiver.phone || dto.senderInfo?.phone,
          recipientAddress: receiver.address || receiver.fullAddress,
          message: dto.isGift ? 'Gửi tặng món quà ý nghĩa' : null,
          isGift: dto.isGift || false,

          paymentMethod: dto.paymentMethod,
          paymentStatus: 'PENDING',

          items: {
            create: preview.items.map(i => ({
              productId: i.productId,
              quantity: i.quantity,
              price: i.price
            }))
          },
          voucherId: preview.appliedVouchers[0]?.id || null,
        }
      });

      if (!dto.isBuyNow) await this.cartService.clearCart(userId);

      // D. Trừ Xu
      if (dto.useCoins && preview.discounts.coin > 0) {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) throw new BadRequestException('Người dùng không tồn tại'); 
        if (user.points < 1000) throw new BadRequestException('Không đủ xu');
            
        await tx.user.update({
            where: { id: userId },
            data: { points: { decrement: 1000 } }
        });
            
        await tx.pointTransaction.create({
            data: {
                userId,
                amount: -1000,
                type: PointType.SPEND_ORDER,
                balanceAfter: user.points - 1000,
                referenceId: `ORDER_SPEND_${Date.now()}`, 
                description: 'Dùng xu giảm giá đơn hàng'
            }
        });
      }

      return newOrder;
    });

    // --- [GHN INTEGRATION] TẠO ĐƠN GHN ---
    // Chỉ tạo đơn GHN khi phương thức là COD hoặc (nếu muốn) sau khi thanh toán Online thành công.
    // Ở đây ta làm mẫu cho trường hợp COD.
    
    let paymentUrl: any = null;
    if (order && dto.paymentMethod === 'cod') {
        try {
            const receiver = dto.receiverInfo || {};
            
            const ghnOrderData = {
                to_name: order.recipientName,
                to_phone: order.recipientPhone,
                to_address: order.recipientAddress,
                to_ward_code: receiver['wardCode'],
                to_district_id: Number(receiver['districtId']),
                
                // [FIX LỖI TẠI ĐÂY] Ép kiểu về số nguyên (Integer)
                cod_amount: Math.floor(Number(order.totalAmount)), 

                weight: preview.items.reduce((sum, i) => sum + (i.weight || 200), 0),
                items: preview.items.map(i => ({
                    name: i.name,
                    code: i.productId,
                    quantity: i.quantity,
                    price: Number(i.price), // [Nên ép kiểu cả giá sản phẩm cho chắc chắn]
                    weight: i.weight || 200
                })),
                note: `Đơn hàng #${order.id} từ Gmall`,
                required_note: 'CHOXEMHANGKHONGTHU'
            };

            const ghnResponse = await this.ghnService.createShippingOrder(ghnOrderData);

            // Cập nhật lại Order với Mã vận đơn từ GHN
            if (ghnResponse && ghnResponse.order_code) {
                await this.prisma.order.update({
                    where: { id: order.id },
                    data: { 
                        shippingOrderCode: ghnResponse.order_code,
                        // Có thể cập nhật lại fee nếu muốn khớp 100% với lúc tạo
                        // shippingFee: ghnResponse.total_fee 
                    }
                });
                this.logger.log(`Tạo đơn GHN thành công: ${ghnResponse.order_code}`);
            }
        } catch (error) {
            // Không throw lỗi ở đây để tránh rollback đơn hàng đã tạo trong DB
            this.logger.error('Lỗi khi đẩy đơn sang GHN:', error);
            // TODO: Bắn noti cho Admin hoặc đánh dấu đơn cần xử lý thủ công
        }
    }
    else if (dto.paymentMethod === 'pay2s') {
        try {
            // Gọi service tạo link (đảm bảo bạn đã inject PaymentService)
            paymentUrl = await this.paymentService.createPay2SPayment(order.id, Number(order.totalAmount));
        } catch (error) {
            this.logger.error(`Lỗi tạo Pay2S: ${error.message}`);
            // Không throw lỗi để tránh rollback đơn hàng
        }
    }

    this.trackingService.trackEvent(userId, 'server', {
      type: EventType.PURCHASE,
      targetId: order.id,
      metadata: { revenue: Number(order.totalAmount), items: preview.items }
    });

    return {
        order,
        paymentUrl 
    };
  }

  async completeOrder(orderId: string) {
      // Logic hoàn thành đơn hàng...
  }

  async findOne(id: string, userId: string) {
    // 1. Kiểm tra đầu vào
    if (!id || id === 'undefined' || id === 'null') {
       throw new NotFoundException('Mã đơn hàng không hợp lệ');
    }

    // 2. Tìm đơn hàng khớp với ID (UUID) HOẶC Mã vận đơn (shippingOrderCode)
    // Và BẮT BUỘC phải thuộc về userId đang đăng nhập
    const order = await this.prisma.order.findFirst({
      where: {
        AND: [
          { userId: userId }, // Bảo mật: Chỉ chủ sở hữu mới xem được
          {
            OR: [
              { id: id }, // Tìm theo UUID chính của đơn
              { shippingOrderCode: id } // Tìm theo mã vận đơn (phòng trường hợp FE truyền mã GHN)
            ]
          }
        ]
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                slug: true,
                images: true,
              }
            }
          }
        },
        voucher: true
      }
    });

    if (!order) {
      // Log để debug xem tại sao không tìm thấy (do sai ID hay sai User)
      this.logger.warn(`Failed to find order: ${id} for user: ${userId}`);
      throw new NotFoundException('Không tìm thấy đơn hàng hoặc bạn không có quyền truy cập.');
    }

    return order;
  }
}