// BE-110/modules/order/order.service.ts

// ... (Giữ nguyên các import)
import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CartService } from '../../modules/cart/cart.service';
import { PromotionService } from '../../modules/promotion/promotion.service';
import { TrackingService } from '../../modules/tracking/tracking.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { EventType } from '../../modules/tracking/dto/track-event.dto';
import { PointService } from '../../modules/point/point.service';
import { OrderStatus, PointType, Prisma, Order } from '@prisma/client';
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

  // --- HELPER: Lấy items, Validate tồn kho, Group theo Shop ---
  private async resolveItemsAndGroup(userId: string, dto: CreateOrderDto) {
    let itemsToCheckout: any[] = [];

    // Ưu tiên: Nếu payload có items thì dùng luôn (cho cả BuyNow và Checkout từ giỏ)
    if (dto.items && dto.items.length > 0) {
      itemsToCheckout = dto.items;
    } 
    // Fallback: Nếu không gửi items, mới lấy toàn bộ từ Cart (Logic cũ)
    else if (!dto.isBuyNow) {
      const cart = await this.cartService.getCart(userId);
      if (cart?.items) {
        itemsToCheckout = cart.items.map(i => {
           const itemAny = i as any;
           return {
             productId: i.productId,
             quantity: i.quantity,
             variantId: itemAny.productVariantId || itemAny.variantId 
           };
        });
      }
    }

    if (!itemsToCheckout.length) throw new BadRequestException('Giỏ hàng trống hoặc chưa chọn sản phẩm');

    // ... (Giữ nguyên phần query database lấy product info và group shop phía dưới)
    const productIds = itemsToCheckout.map(i => i.productId);
    
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { 
          id: true, name: true, price: true, originalPrice: true, 
          stock: true, weight: true, images: true, variants: true,
          shopId: true, shop: { select: { id: true, name: true, districtId: true, wardCode: true } }
      } 
    });

    const shopGroups: Record<string, any> = {};

    for (const item of itemsToCheckout) {
      // ... (Logic trong vòng lặp giữ nguyên)
      const product = products.find(p => p.id === item.productId);
      if (!product) throw new NotFoundException(`Sản phẩm ID ${item.productId} không tồn tại`);
      if (product.stock < item.quantity) throw new BadRequestException(`Sản phẩm ${product.name} không đủ hàng`);
      if (!product.shopId) throw new BadRequestException(`Dữ liệu sản phẩm ${product.name} lỗi (thiếu ShopId)`);

      let selectedVariant: any = null;
      let finalPrice = Number(product.price);

      if (item.variantId) {
         selectedVariant = product.variants.find(v => v.id === item.variantId);
         // if (selectedVariant) finalPrice = Number(selectedVariant.price);
      }

      const productImages = product.images as unknown as string[];
      const finalImageUrl = (Array.isArray(productImages) && productImages.length > 0)
          ? productImages[0] : '/assets/placeholder.png';

      if (!shopGroups[product.shopId]) {
        shopGroups[product.shopId] = {
          shopId: product.shopId,
          shopName: product.shop?.name,
          items: [],
          subtotal: 0,
          weight: 0,
          fromDistrictId: product.shop?.districtId,
          fromWardCode: product.shop?.wardCode
        };
      }

      const lineTotal = finalPrice * item.quantity;
      
      shopGroups[product.shopId].items.push({
        productId: product.id,
        variantId: selectedVariant?.id || null, 
        name: product.name,
        imageUrl: finalImageUrl,
        price: finalPrice,
        quantity: item.quantity,
        subtotal: lineTotal,
        weight: (product.weight || 200) * item.quantity,
        shopId: product.shopId 
      });

      shopGroups[product.shopId].subtotal += lineTotal;
      shopGroups[product.shopId].weight += (product.weight || 200) * item.quantity;
    }

    return shopGroups;
  }

  // ... (Phần còn lại của OrderService giữ nguyên như logic trước đó)
  
  // --- 1. TÍNH TOÁN GIÁ (Preview) ---
  async previewOrder(userId: string, dto: CreateOrderDto) {
    const shopGroups = await this.resolveItemsAndGroup(userId, dto);
    const receiver = dto.receiverInfo || {};
    
    for (const shopId in shopGroups) {
        const group = shopGroups[shopId];
        let shippingFee = 30000; 

        if (receiver.districtId && receiver.wardCode && group.fromDistrictId) {
            try {
                const fee = await this.ghnService.calculateFee({
                    toDistrictId: Number(receiver.districtId),
                    toWardCode: String(receiver.wardCode),
                    weight: group.weight,
                    insuranceValue: group.subtotal,
                });
                if(fee) shippingFee = fee;
            } catch (e) {
                this.logger.warn(`Lỗi tính ship shop ${group.shopName}: ${e.message}`);
            }
        }
        group.shippingFee = shippingFee;
    }

    const { shopDiscounts, systemDiscount, appliedVouchers } = 
        await this.promotionService.calculateMultiShopVouchers(dto.voucherIds || [], shopGroups);

    let coinDiscount = 0;
    if (dto.useCoins) {
        const wallet = await this.prisma.pointWallet.findUnique({ where: { userId } });
        coinDiscount = Math.min(wallet?.balance || 0, 50000); 
    }

    let totalSubtotal = 0;
    let totalShipping = 0;
    let totalShopDiscount = 0;

    const breakdown = Object.values(shopGroups).map((group: any) => {
        const sDiscount = shopDiscounts[group.shopId] || 0;
        const groupTotalBeforeSystem = Math.max(0, group.subtotal + group.shippingFee - sDiscount);

        totalSubtotal += group.subtotal;
        totalShipping += group.shippingFee;
        totalShopDiscount += sDiscount;

        return {
            ...group,
            shopDiscount: sDiscount,
            totalBeforeSystem: groupTotalBeforeSystem
        };
    });

    let giftFee = 0;
    if (dto.isGift) {
        giftFee = (GIFT_WRAP_PRICES[dto.giftWrapIndex || 0] || 0) + (CARD_PRICES[dto.cardIndex || 0] || 0);
    }

    const grandTotal = Math.max(0, 
        totalSubtotal + totalShipping + giftFee - totalShopDiscount - systemDiscount - coinDiscount
    );

    return {
        breakdown, 
        summary: {
            subtotal: totalSubtotal,
            shippingFee: totalShipping,
            giftFee,
            discounts: {
                shopVoucher: totalShopDiscount,
                systemVoucher: systemDiscount,
                coin: coinDiscount
            },
            total: grandTotal
        },
        appliedVouchers
    };
  }

  // --- 2. TẠO ORDER (Transaction) ---
  async createOrder(userId: string, dto: CreateOrderDto) {
    const preview = await this.previewOrder(userId, dto);
    const receiver = dto.receiverInfo || {};
    
    let noteMap: Record<string, string> = {};
    if (typeof dto.note === 'object') {
        noteMap = dto.note;
    } else if (typeof dto.note === 'string') {
        noteMap['ALL'] = dto.note;
    }

    // [BẮT ĐẦU TRANSACTION]
    // Biến result sẽ hứng giá trị return từ block này
    const result = await this.prisma.$transaction(async (tx) => {
      const createdOrders: Order[] = [];
      const totalOrderValue = preview.summary.subtotal;

      // ... (Logic trừ xu, cập nhật voucher giữ nguyên) ...
      if (preview.summary.discounts.coin > 0) {
        const amount = preview.summary.discounts.coin;
        await tx.pointWallet.update({ where: { userId }, data: { balance: { decrement: amount } } });
        await tx.pointHistory.create({
           data: { userId, amount: -amount, type: PointType.SPEND_ORDER, source: 'ORDER', description: 'Thanh toán đơn hàng' }
        });
      }

      for (const voucher of preview.appliedVouchers) {
         await tx.voucher.update({ where: { id: voucher.id }, data: { usageCount: { increment: 1 } } });
         // ... (Logic cập nhật userVoucher giữ nguyên)
      }

      // ... (Vòng lặp tạo từng đơn hàng theo shop) ...
      for (const group of preview.breakdown) {
          // ... (Tính toán phân bổ giảm giá giữ nguyên) ...
          let ratio = 0;
          if (totalOrderValue > 0) ratio = group.subtotal / totalOrderValue;
          const allocatedSystemDisc = Math.floor(preview.summary.discounts.systemVoucher * ratio);
          const allocatedCoinDisc = Math.floor(preview.summary.discounts.coin * ratio);

          const finalAmount = Math.max(0, 
              group.subtotal + group.shippingFee - group.shopDiscount - allocatedSystemDisc - allocatedCoinDisc
          );

          // ... (Logic tìm voucherIdToSave giữ nguyên) ...
          const shopVoucher = preview.appliedVouchers.find((v: any) => v.shopId === group.shopId);
          const systemVoucher = preview.appliedVouchers.find((v: any) => v.isSystem === true);
          const voucherIdToSave = shopVoucher ? shopVoucher.id : (systemVoucher ? systemVoucher.id : null);

          // Trừ tồn kho
          for (const item of group.items) {
             const update = await tx.product.updateMany({
                where: { id: item.productId, stock: { gte: item.quantity } },
                data: { stock: { decrement: item.quantity } }
             });
             if (update.count === 0) throw new BadRequestException(`Sản phẩm ${item.name} vừa hết hàng.`);
          }

          const note = noteMap[group.shopId] || noteMap['ALL'] || '';
          
          // Tạo Order
          const newOrder = await tx.order.create({
             data: {
                 userId,
                 shopId: group.shopId,
                 totalAmount: new Prisma.Decimal(finalAmount),
                 shippingFee: new Prisma.Decimal(group.shippingFee),
                 voucherId: voucherIdToSave,
                 recipientName: receiver.name || dto.senderInfo?.name,
                 recipientPhone: receiver.phone || dto.senderInfo?.phone,
                 recipientAddress: receiver.fullAddress || receiver.address,
                 message: note,
                 isGift: dto.isGift || false,
                 paymentMethod: dto.paymentMethod,
                 paymentStatus: 'PENDING',
                 items: {
                     create: group.items.map((i: any) => ({
                         productId: i.productId,
                         quantity: i.quantity,
                         price: i.price,
                     }))
                 }
             }
          });
          createdOrders.push(newOrder);
      }

      // Xóa giỏ hàng (sử dụng logic mới đã fix ở bước trước)
      if (!dto.isBuyNow) {
           if (dto.items && dto.items.length > 0) {
               for (const item of dto.items) {
                   await this.cartService.removeItem(userId, item.productId);
               }
           } else {
               await this.cartService.clearCart(userId);
           }
      }

      return createdOrders; // Trả về danh sách đơn hàng
    }); 
    // [KẾT THÚC TRANSACTION]
    // Lúc này 'result' mới có dữ liệu. Mọi logic sử dụng 'result' PHẢI nằm dưới dòng này.

    // --- PAY2S (Đã Fix vị trí) ---
    let paymentUrl: string | null = null;
    if (dto.paymentMethod === 'pay2s') {
        try {
            // [FIX] Truy cập result[0] ở đây là an toàn vì transaction đã xong
            const masterOrderId = result[0].id; 
            const totalPay = preview.summary.total;
            const desc = `Thanh toan ${result.length} don hang`;
            
            paymentUrl = await this.paymentService.createPay2SPayment(
                masterOrderId,
                Number(totalPay),
                desc 
            );
        } catch (error) {
            this.logger.error(`Pay2S Error:`, error);
        }
    }

    // --- GHN (Đã Fix log) ---
    if (dto.paymentMethod === 'cod') {
        for (const order of result) {
            const groupInfo = preview.breakdown.find((g: any) => g.shopId === order.shopId);
            if (!groupInfo) continue;
            
            // [FIX] Bỏ qua GHN nếu thiếu thông tin địa chỉ quan trọng để tránh lỗi 400
            if (!dto.receiverInfo?.wardCode || !dto.receiverInfo?.districtId) {
                this.logger.warn(`Skip GHN for Order ${order.id}: Missing district/ward`);
                continue;
            }

            try {
                const ghnData = {
                    to_name: order.recipientName,
                    to_phone: order.recipientPhone,
                    to_address: order.recipientAddress,
                    to_ward_code: dto.receiverInfo['wardCode'],
                    to_district_id: Number(dto.receiverInfo['districtId']),
                    cod_amount: Math.floor(Number(order.totalAmount)),
                    weight: groupInfo.weight,
                    items: groupInfo.items.map((i: any) => ({
                         name: i.name, code: i.productId,
                         quantity: i.quantity, price: Number(i.price), weight: 200
                    })),
                    note: order.message,
                    required_note: 'CHOXEMHANGKHONGTHU'
                };
                const ghnRes = await this.ghnService.createShippingOrder(ghnData);
                if (ghnRes?.order_code) {
                    await this.prisma.order.update({
                        where: { id: order.id },
                        data: { shippingOrderCode: ghnRes.order_code }
                    });
                }
            } catch (err: any) {
                // Log gọn hơn để đỡ spam console
                this.logger.warn(`GHN Error Order ${order.id}: ${err.message || JSON.stringify(err)}`);
            }
        }
    }

    // --- Tracking ---
    this.trackingService.trackEvent(userId, 'server', {
        type: EventType.PURCHASE,
        targetId: result[0].id,
        metadata: { revenue: preview.summary.total, orderCount: result.length }
    });

    return {
        orders: result,
        paymentUrl,
        totalAmount: preview.summary.total
    };
  }
  
  // ... (Các hàm còn lại giữ nguyên)
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

  async getUserOrders(userId: string, status?: string) {
    const whereCondition: any = { userId };
    if (status && status.trim() !== '' && status !== 'ALL') {
        whereCondition.status = status; 
    }
    return this.prisma.order.findMany({
      where: whereCondition,
      include: {
        items: {
          include: {
             product: { select: { id: true, name: true, slug: true, images: true, shopId: true } }
          }
        },
        shop: { select: { id: true, name: true, avatar: true } }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSellerOrders(userId: string, status?: string) {
    const shop = await this.prisma.shop.findUnique({ where: { ownerId: userId } });
    if (!shop) return []; 
    const shouldFilterStatus = status && status.toLowerCase() !== 'all';
    return this.prisma.order.findMany({
      where: {
        shopId: shop.id,
        ...(shouldFilterStatus ? { status: status as any } : {})
      },
      include: {
        user: { select: { name: true, phone: true } },
        items: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async cancelOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: true }
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (order.status !== 'PENDING') throw new BadRequestException('Không thể hủy đơn hàng này.');

    return this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' }
      });
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId ?? undefined },
          data: { stock: { increment: item.quantity } }
        });
      }
      return updatedOrder;
    });
  }

  async updateOrderStatus(orderId: string, sellerId: string, status: OrderStatus) {
    const shop = await this.prisma.shop.findUnique({ where: { ownerId: sellerId } });
    if (!shop) throw new NotFoundException('Shop không tồn tại');

    const order = await this.prisma.order.findFirst({
        where: { id: orderId, shopId: shop.id } 
    });
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại hoặc không thuộc quyền quản lý');

    return this.prisma.order.update({
      where: { id: orderId },
      data: { status }
    });
  }

  async getSellerOrderDetail(orderId: string, sellerId: string) {
    const shop = await this.prisma.shop.findUnique({ where: { ownerId: sellerId } });
    if (!shop) throw new NotFoundException('Shop không tồn tại');

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, shopId: shop.id },
      include: {
        user: { select: { name: true, phone: true, email: true } },
        items: { include: { product: true } }
      }
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    return order;
  }

  async findOne(id: string, userId: string) {
    if (!id || id === 'undefined') throw new NotFoundException('ID không hợp lệ');
    const order = await this.prisma.order.findFirst({
      where: {
        AND: [
          { userId: userId },
          { OR: [{ id: id }, { shippingOrderCode: id }] }
        ]
      },
      include: {
        items: { include: { product: { select: { id: true, name: true, slug: true, images: true } } } },
        voucher: true,
        shop: { select: { id: true, name: true } }
      }
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    return order;
  }
}