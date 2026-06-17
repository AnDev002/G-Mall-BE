// BE-110/modules/order/order.service.ts

// ... (Giữ nguyên các import)
import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { getPagination } from 'src/common/utils/pagination.util';
import { CartService } from '../../modules/cart/cart.service';
import { PromotionService } from '../../modules/promotion/promotion.service';
import { TrackingService } from '../../modules/tracking/tracking.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { EventType } from '../../modules/tracking/dto/track-event.dto';
import { PointService } from '../../modules/point/point.service';
import { OrderStatus, PointType, Prisma, Order } from '@prisma/client';
import { GhnService } from '../../modules/ghn/ghn.service';
import { PaymentService } from '../payment/payment.service';
import { CharityService } from '../charity/charity.service';
import { SystemSettingService } from '../../common/services/system-setting.service';
import { NotificationService } from '../notification/notification.service';

// Spec [0018]: gói quà bỏ free/20k, còn 30k và 50k. Index 0 (30k) là tùy chọn
// rẻ nhất, không có "không gói".
// Thiệp: 5k mặc định. Nếu khách muốn thiệp cao hơn → chuyển sang mục thiệp
// riêng để chọn (sẽ thêm sau khi có catalog thiệp).
const GIFT_WRAP_PRICES = [30000, 50000];
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
    private paymentService: PaymentService,
    private charityService: CharityService,
    private systemSetting: SystemSettingService,
    private notificationService: NotificationService,
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
          status: true, // Wiki 0075: chặn mua SP không ACTIVE (ẩn/chưa duyệt)
          categoryId: true, // B7.9: cần cho voucher scope CATEGORY match theo danh mục
          shopId: true, shop: { select: { id: true, name: true, districtId: true, wardCode: true } }
      }
    });

    const shopGroups: Record<string, any> = {};

    for (const item of itemsToCheckout) {
      // ... (Logic trong vòng lặp giữ nguyên)
      const product = products.find(p => p.id === item.productId);
      if (!product) throw new NotFoundException(`Sản phẩm ID ${item.productId} không tồn tại`);
      // Wiki 0075: chỉ cho mua SP ACTIVE — chặn mua SP seller đã ẩn (INACTIVE) hoặc
      // admin chưa duyệt (PENDING). Trước đây fetch không lọc status → mua được hết.
      if ((product as any).status !== 'ACTIVE') throw new BadRequestException(`Sản phẩm ${product.name} hiện không khả dụng`);
      if (product.stock < item.quantity) throw new BadRequestException(`Sản phẩm ${product.name} không đủ hàng`);
      if (!product.shopId) throw new BadRequestException(`Dữ liệu sản phẩm ${product.name} lỗi (thiếu ShopId)`);

      let selectedVariant: any = null;
      let finalPrice = Number(product.price);
      let flashSaleProductId: string | null = null;

      if (item.variantId) {
         selectedVariant = product.variants.find(v => v.id === item.variantId);
         // [FIX M4 - wiki 0088] variantId KHÔNG thuộc product (id biến thể của SP khác / đã xóa / stale)
         // → trước đây fallback giá gốc + chỉ trừ product.stock → lệch tồn kho biến thể + buyer trả
         // giá gốc (thường rẻ hơn) cho biến thể đắt. Giờ CHẶN thẳng.
         if (!selectedVariant) throw new BadRequestException(`Phân loại của sản phẩm ${product.name} không hợp lệ.`);
         // Wiki 0075: tính theo GIÁ BIẾN THỂ. Trước đây dòng này bị comment → đặt
         // variant vẫn tính theo product.price (giá gốc) → sai tiền (variant đắt/rẻ hơn đều lệch).
         finalPrice = Number(selectedVariant.price);
         // Wiki 0084: nếu biến thể đang trong Flash Sale (session ACTIVE + còn flash stock) → áp
         // GIÁ SALE. Trước đây checkout tính giá gốc dù UI hiện giá sale → buyer bị tính dư (overcharge).
         const nowTs = new Date();
         const fsp = await this.prisma.flashSaleProduct.findFirst({
           where: {
             variantId: item.variantId,
             status: 'APPROVED',
             session: { status: 'ENABLED', startTime: { lte: nowTs }, endTime: { gt: nowTs } },
           },
           select: { id: true, salePrice: true, stock: true, sold: true },
         });
         // [FIX flash - wiki 0088] CHỈ áp giá flash khi TOÀN BỘ quantity còn nằm trong suất flash
         // (sold + qty <= stock). Trước đây `sold < stock` chỉ cần còn 1 suất là áp giá flash cho
         // CẢ line qty lớn → bán dưới giá vượt cam kết flash của seller.
         if (fsp && fsp.sold + item.quantity <= fsp.stock) {
           finalPrice = Number(fsp.salePrice);
           flashSaleProductId = fsp.id;
         }
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
        shopId: product.shopId,
        categoryId: product.categoryId, // B7.9: cần cho voucher scope CATEGORY
        flashSaleProductId, // Wiki 0084: để trừ flash sold lúc tạo đơn
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

    const { shopDiscounts, systemDiscount, freeshipDiscount, appliedVouchers } =
        await this.promotionService.calculateMultiShopVouchers(dto.voucherIds || [], shopGroups);

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

    // [FIX H2 - wiki 0088] FREESHIP giảm vào PHÍ SHIP (cap ≤ tổng ship), không vào subtotal.
    // Trước đây OrderService destructure bỏ `freeshipDiscount` → freeship KHÔNG được áp dụng
    // (buyer trả full ship) dù voucher vẫn bị đốt. Giờ trừ vào ship + báo trong summary để
    // createOrder phân bổ đúng cho từng đơn (đối soát cổng/COD).
    const freeship = Math.min(Math.max(0, freeshipDiscount || 0), totalShipping);

    // Wiki 0075: cap xu theo số tiền THỰC phải trả (sau ship + voucher). Trước đây
    // coinDiscount = min(balance, 50000) không xét bill → đơn rẻ hơn mức xu dùng thì
    // ví vẫn bị trừ đủ 50000 trong khi total chỉ giảm tới 0 → khách MẤT OAN xu.
    const payableBeforeCoins = Math.max(0,
        totalSubtotal + totalShipping + giftFee - totalShopDiscount - systemDiscount - freeship
    );
    let coinDiscount = 0;
    if (dto.useCoins) {
        const wallet = await this.prisma.pointWallet.findUnique({ where: { userId } });
        coinDiscount = Math.min(wallet?.balance || 0, 50000, payableBeforeCoins);
    }

    const grandTotal = Math.max(0, payableBeforeCoins - coinDiscount);

    return {
        breakdown, 
        summary: {
            subtotal: totalSubtotal,
            shippingFee: totalShipping,
            giftFee,
            discounts: {
                shopVoucher: totalShopDiscount,
                systemVoucher: systemDiscount,
                freeship, // [FIX H2 - wiki 0088] để createOrder phân bổ giảm ship cho từng đơn
                coin: coinDiscount
            },
            total: grandTotal
        },
        appliedVouchers
    };
  }

  // --- 2. TẠO ORDER (Transaction) ---
  async createOrder(userId: string, dto: CreateOrderDto, clientIp: string | null = null) {
    const preview = await this.previewOrder(userId, dto);
    const receiver = dto.receiverInfo || {};
    
    let noteMap: Record<string, string> = {};
    if (typeof dto.note === 'object') {
        noteMap = dto.note;
    } else if (typeof dto.note === 'string') {
        noteMap['ALL'] = dto.note;
    }

    // [FIX 1] Cấu hình timeout cho Transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const createdOrders: Order[] = [];
      const totalOrderValue = preview.summary.subtotal;
      const paymentGroupId = randomUUID(); // Wiki 0083: 1 id nhóm cho cả batch (multi-shop checkout)

      if (preview.summary.discounts.coin > 0) {
        const amount = preview.summary.discounts.coin;
        // Wiki 0082: trừ xu CÓ ĐIỀU KIỆN (balance>=amount) — chặn double-spend/âm ví khi 2 đơn
        // song song cùng đọc balance ở preview (TOCTOU). Trước đây update vô điều kiện → ví âm.
        const w = await tx.pointWallet.updateMany({
          where: { userId, balance: { gte: amount } },
          data: { balance: { decrement: amount } },
        });
        if (w.count === 0) throw new BadRequestException('Số dư xu không đủ hoặc vừa thay đổi, vui lòng thử lại.');
        await tx.pointHistory.create({
           data: { userId, amount: -amount, type: PointType.SPEND_ORDER, source: 'ORDER', description: 'Thanh toán đơn hàng' }
        });
      }

      for (const voucher of preview.appliedVouchers) {
         // Wiki 0082: enforce per-user (userUsageLimit) + global (usageLimit) ATOMIC khi redeem.
         // Trước đây increment vô điều kiện + tạo userVoucher cho voucher chưa claim → 1 user
         // dùng lại 1 voucher vô hạn + vượt tổng usageLimit (lỗ tiền). calculateMultiShopVouchers
         // KHÔNG check ownership/limit nên phải chặn ở đây.
         const perUserLimit = Number((voucher as any).userUsageLimit ?? 1) || 1;
         const globalLimit = Number((voucher as any).usageLimit ?? 0);
         // [FIX round15 #9 - wiki 0088] re-validate isActive + thời hạn ATOMIC lúc redeem (TOCTOU: admin
         // tắt/hết hạn voucher giữa preview và create) + global usageLimit. where không khớp → count=0 → reject.
         const _vNow = new Date();
         const _vWhere: any = { id: voucher.id, isActive: true, startDate: { lte: _vNow }, endDate: { gte: _vNow } };
         if (globalLimit > 0) _vWhere.usageCount = { lt: globalLimit };
         const inc = await tx.voucher.updateMany({ where: _vWhere, data: { usageCount: { increment: 1 } } });
         if (inc.count === 0) throw new BadRequestException(`Voucher ${(voucher as any).code || ''} không còn hiệu lực hoặc đã hết lượt.`);
         // [FIX round15 #2 - wiki 0088] CLAIM per-user ATOMIC chống race 2 checkout đồng thời cùng user
         // vượt userUsageLimit. Trước đây count()→update/create KHÔNG atomic (cả 2 đọc count=0 → cùng
         // dùng). Thử claim 1 userVoucher CHƯA dùng (isUsed false→true atomic). Không có row chưa-dùng →
         // đếm đã-dùng: nếu < limit thì tạo mới (unique(userId,voucherId) serialize concurrent create,
         // tx thua sẽ abort); >= limit thì reject.
         const claimUsed = await tx.userVoucher.updateMany({
            where: { userId, voucherId: voucher.id, isUsed: false },
            data: { isUsed: true, usedAt: new Date() },
         });
         if (claimUsed.count === 0) {
            const usedByUser = await tx.userVoucher.count({ where: { userId, voucherId: voucher.id, isUsed: true } });
            if (usedByUser >= perUserLimit) {
               throw new BadRequestException(`Bạn đã dùng hết lượt voucher ${(voucher as any).code || ''}.`);
            }
            // [round14 review3-FIX MEDIUM] create có thể đụng @@unique(userId,voucherId) khi userUsageLimit>1
            // (đã có 1 row isUsed) hoặc race → P2002 làm vỡ cả checkout. Bắt P2002 = coi như đã giữ slot
            // (row tồn tại) → không nhân đôi, không crash. Lỗi khác vẫn ném.
            try {
               await tx.userVoucher.create({ data: { userId, voucherId: voucher.id, isUsed: true, usedAt: new Date() } });
            } catch (e: any) {
               if (e?.code !== 'P2002') throw e;
            }
         }
      }

      // [FIX M3/H2/H4 - wiki 0088] Phân bổ giảm hệ thống/xu/freeship theo tỉ lệ subtotal, NHƯNG đơn
      // CUỐI nhận phần DƯ (total - đã phân bổ) để Σ(phân bổ) == tổng đã trừ ở ví/cổng. Trước đây bare
      // Math.floor mỗi shop → rơi vài đồng → Σ Order.totalAmount > tiền charge (COD thu dư / xu trừ
      // nhiều hơn giảm; edge subtotal=0 → mất sạch xu). giftFee gắn vào đơn ĐẦU (trước không lưu →
      // COD không thu, online lệch sổ). freeship trừ vào phí ship của đơn.
      const _groups = preview.breakdown;
      const _totalSystem = preview.summary.discounts.systemVoucher || 0;
      const _totalCoin = preview.summary.discounts.coin || 0;
      const _totalFreeship = (preview.summary.discounts as any).freeship || 0;
      const _giftFee = preview.summary.giftFee || 0;
      // [FIX review2-H4 - wiki 0088] Phân bổ freeship/system/xu GREEDY từ POOL chung, CLAMP theo khả
      // năng hấp thụ THỰC của từng đơn (gross = subtotal+effShip+gift-shopDiscount), carry phần dư
      // sang đơn sau. Bản trước phân bổ system/xu theo tỉ-lệ-subtotal ĐỘC LẬP rồi Math.max(0) → đơn
      // (không-cuối) có shop-voucher lớn (gross nhỏ) bị FLOOR mất phần system/xu → Σ Order.totalAmount
      // > grandTotal (thu dư). Vì payableBeforeCoins ≥ coin và Σgross = payableBeforeCoins + system ≥
      // system+coin nên greedy luôn tiêu hết pool → Σ finalAmount == grandTotal mọi phân bố.
      let _freeshipPool = _totalFreeship, _sysPool = _totalSystem, _coinPool = _totalCoin;
      for (let _gi = 0; _gi < _groups.length; _gi++) {
          const group = _groups[_gi];
          const _fsForThis = Math.min(group.shippingFee, _freeshipPool);
          _freeshipPool -= _fsForThis;
          const _effShipping = group.shippingFee - _fsForThis;
          const _giftForThis = _gi === 0 ? _giftFee : 0;
          const _gross = Math.max(0, group.subtotal + _effShipping + _giftForThis - group.shopDiscount);
          const allocatedSystemDisc = Math.min(_gross, _sysPool);
          _sysPool -= allocatedSystemDisc;
          const allocatedCoinDisc = Math.min(_gross - allocatedSystemDisc, _coinPool);
          _coinPool -= allocatedCoinDisc;

          const finalAmount = _gross - allocatedSystemDisc - allocatedCoinDisc;

          // [FIX round15 #1 - wiki 0088] LOẠI freeship khỏi shopVoucher (per-shop). Voucher SHOP-scope
          // type=FREESHIP có CẢ shopId LẪN isFreeship → vừa rơi vào order.voucherId vừa vào appliedVoucherIds
          // → cancel nhả 2 LẦN (per-shop + shared) → usageCount under-count → over-issuance. Freeship luôn
          // đi nhánh shared (appliedVoucherIds) → nhả 1 lần.
          const shopVoucher = preview.appliedVouchers.find((v: any) => v.shopId === group.shopId && !v.isFreeship);
          const systemVoucher = preview.appliedVouchers.find((v: any) => v.isSystem === true);
          // [FIX review-round14b - wiki 0088] order.voucherId = CHỈ voucher SHOP của đơn này (per-shop)
          // → nhả NGAY khi đơn này hủy. System/freeship (shared) lưu riêng ở appliedVoucherIds, nhả khi
          // group hủy hết. Trước đây fallback systemVoucher vào voucherId làm lẫn per-shop với shared.
          const voucherIdToSave = shopVoucher ? shopVoucher.id : null;

          // Trừ tồn kho
          for (const item of group.items) {
             // Wiki 0082: nếu có biến thể, trừ tồn kho BIẾN THỂ (ProductVariant.stock) atomic —
             // trước đây chỉ trừ product.stock nên bán được biến thể đã hết hàng (oversell variant).
             if (item.variantId) {
                const vu = await tx.productVariant.updateMany({
                   where: { id: item.variantId, stock: { gte: item.quantity } },
                   data: { stock: { decrement: item.quantity } },
                });
                if (vu.count === 0) throw new BadRequestException(`Sản phẩm ${item.name} (phân loại đã chọn) vừa hết hàng.`);
             }
             const update = await tx.product.updateMany({
                where: { id: item.productId, stock: { gte: item.quantity } },
                data: { stock: { decrement: item.quantity } }
             });
             if (update.count === 0) throw new BadRequestException(`Sản phẩm ${item.name} vừa hết hàng.`);
             // [FIX flash - wiki 0088] tăng sold ATOMIC có guard `sold <= stock - qty` → KHÔNG cho
             // sold vượt stock (trước đây increment vô điều kiện → 2 đơn đua / qty lớn đẩy sold>stock,
             // bán dưới giá vượt suất). Thua race → báo hết suất (buyer thử lại).
             if (item.flashSaleProductId) {
                const fspNow = await tx.flashSaleProduct.findUnique({ where: { id: item.flashSaleProductId }, select: { stock: true } });
                const incFlash = await tx.flashSaleProduct.updateMany({
                   where: { id: item.flashSaleProductId, sold: { lte: (fspNow?.stock ?? 0) - item.quantity } },
                   data: { sold: { increment: item.quantity } },
                });
                if (incFlash.count === 0) throw new BadRequestException(`Sản phẩm ${item.name} vừa hết suất Flash Sale.`);
             }
          }

          const note = noteMap[group.shopId] || noteMap['ALL'] || '';
          
          const newOrder = await tx.order.create({
             data: {
                 userId,
                 shopId: group.shopId,
                 totalAmount: new Prisma.Decimal(finalAmount),
                 shippingFee: new Prisma.Decimal(group.shippingFee),
                 coinUsed: allocatedCoinDisc, // Wiki 0083: xu phân bổ cho đơn này (để hoàn khi hủy)
                 paymentGroupId, // Wiki 0083: nhóm thanh toán (multi-shop)
                 voucherId: voucherIdToSave,
                 appliedVoucherIds: preview.appliedVouchers.filter((v: any) => v.isSystem || v.isFreeship).map((v: any) => v.id), // [FIX #10b/review-round14b] CHỈ voucher SHARED (system/freeship) — nhả khi group hủy hết; shop voucher đã ở order.voucherId (nhả per-đơn)
                 recipientName: receiver.name || dto.senderInfo?.name,
                 recipientPhone: receiver.phone || dto.senderInfo?.phone,
                 recipientAddress: receiver.fullAddress || receiver.address,
                 message: note,
                 isGift: dto.isGift || false,
                 paymentMethod: dto.paymentMethod,
                 paymentStatus: 'PENDING',
                 clientIp, // G4 (wiki 0044/0045): IP để anti-farm referral
                 items: {
                     create: group.items.map((i: any) => ({
                         productId: i.productId,
                         variantId: i.variantId || null, // Wiki 0083: lưu variant để hoàn kho khi hủy
                         flashSaleProductId: i.flashSaleProductId || null, // Wiki 0088: để hoàn flash sold khi hủy
                         quantity: i.quantity,
                         price: i.price,
                     }))
                 }
             }
          });
          createdOrders.push(newOrder);
      }

      // [FIX 2] Đã xóa logic clearCart ở đây để giảm tải cho DB Transaction
      // return createdOrders ra ngoài để dùng tiếp
      return createdOrders;

    }, {
        // [QUAN TRỌNG] Tăng timeout lên 40s (mặc định là 5s) để xử lý đơn hàng lớn
        maxWait: 5000, 
        timeout: 40000 
    }); 

    // [FIX 3] Di chuyển logic xóa giỏ hàng (Redis) ra ngoài transaction DB
    // Redis nhanh nhưng network I/O có thể làm chậm DB lock nếu để bên trong
    try {
        if (!dto.isBuyNow) {
            if (dto.items && dto.items.length > 0) {
                // Xóa từng item đã mua (Partial Checkout)
                // Dùng Promise.all để chạy song song cho nhanh hơn
                await Promise.all(dto.items.map(item => 
                    this.cartService.removeItem(userId, item.productId)
                ));
            } else {
                // Fallback: Xóa hết
                await this.cartService.clearCart(userId);
            }
        }
    } catch (e) {
        // Log lỗi xóa cart nhưng không chặn flow đặt hàng thành công
        this.logger.warn(`Lỗi xóa giỏ hàng sau khi đặt đơn: ${e.message}`);
    }

    // --- PAY2S Logic (Giữ nguyên) ---
    let paymentUrl: string | null = null;
    if (dto.paymentMethod === 'pay2s') {
        try {
            const masterOrderId = result[0].id;
            const totalPay = preview.summary.total;
            const desc = `Thanh toan ${result.length} don hang`;
            paymentUrl = await this.paymentService.createPay2SPayment(
                masterOrderId,
                Number(totalPay),
                desc
            );
        } catch (error) {
            // Wiki 0076: KHÔNG nuốt lỗi nữa. Trước đây catch chỉ log → paymentUrl
            // để null → FE tưởng đặt hàng thành công nhưng đơn PENDING vĩnh viễn,
            // không ai biết thanh toán fail. Giờ throw như nhánh MoMo (contract 0064).
            this.logger.error(`Pay2S Error:`, error);
            throw new BadRequestException(
                error?.message ||
                'Không tạo được link thanh toán Pay2S, vui lòng thử lại hoặc chọn phương thức khác',
            );
        }
    }

    if (dto.paymentMethod === 'momo') {
        const masterOrderId = result[0].id;
        const totalPay = preview.summary.total;
        const desc = `Thanh toan ${result.length} don hang Gmall`;
        // Lỗi MoMo không nuốt — bật BadRequest để FE hiển thị message.
        paymentUrl = await this.paymentService.createMomoPayment(
            masterOrderId,
            Number(totalPay),
            desc,
        );
    }

    // --- GHN Logic (Giữ nguyên) ---
    if (dto.paymentMethod === 'cod') {
         // ... (Logic GHN cũ giữ nguyên)
         for (const order of result) {
            const groupInfo = preview.breakdown.find((g: any) => g.shopId === order.shopId);
            if (!groupInfo) continue;
            
            if (!dto.receiverInfo?.wardCode || !dto.receiverInfo?.districtId) {
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
                this.logger.warn(`GHN Error Order ${order.id}: ${err.message}`);
            }
        }
    }

    // ... (Tracking và Return giữ nguyên)
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
    const { status, search } = params;
    // Wiki 0074: clamp page/limit (page=-1 → skip âm → Prisma 500).
    const { page, limit, skip } = getPagination(params.page, params.limit);
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
    // [FIX round15 #4 - wiki 0088] CHẶN tự hủy đơn ĐÃ THANH TOÁN (online PAID nhưng status còn PENDING
    // do IPN về trước khi giao). cancelOrder hoàn kho/xu/voucher nhưng KHÔNG hoàn tiền cổng → buyer
    // vừa được hoàn hàng vừa giữ tiền đã trả. Đơn PAID phải đi luồng hoàn tiền/khiếu nại, không tự hủy.
    if ((order as any).paymentStatus === 'PAID') {
      throw new BadRequestException('Đơn đã thanh toán, vui lòng liên hệ hỗ trợ để được hoàn tiền thay vì hủy.');
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      // Wiki 0086: ATOMIC claim PENDING→CANCELLED. Trước đây check status NGOÀI tx rồi update
      // vô điều kiện TRONG tx → 2 request hủy đồng thời cùng pass check, cùng chạy khối hoàn
      // kho/xu/voucher → DOUBLE refund (xu free, kho/voucher sai). Thua race thì bail.
      const claim = await tx.order.updateMany({
        // [round14 review3-FIX MEDIUM] thêm paymentStatus != PAID vào claim ATOMIC → đóng cửa sổ TOCTOU
        // (IPN set PAID giữa lúc đọc order ngoài-tx và claim) → không hủy + hoàn kho/xu/voucher đơn đã
        // thanh toán mà KHÔNG hoàn tiền cổng. count=0 → bail như đơn đã xử lý.
        where: { id: orderId, status: 'PENDING', paymentStatus: { not: 'PAID' } },
        data: { status: 'CANCELLED' },
      });
      if (claim.count === 0) throw new BadRequestException('Đơn hàng đã được xử lý.');
      for (const item of order.items) {
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } }
          });
        }
        // Wiki 0083: hoàn tồn kho BIẾN THỂ (đã trừ lúc tạo đơn) — nếu không sẽ leak stock variant.
        if ((item as any).variantId) {
          await tx.productVariant.updateMany({
            where: { id: (item as any).variantId },
            data: { stock: { increment: item.quantity } },
          });
        }
        // [FIX flash - wiki 0088] HOÀN flashSaleProduct.sold khi hủy (trước đây không hoàn → place+cancel
        // lặp lại đẩy sold tới stock vĩnh viễn → buyer thật mất giá flash / hiện sold-out dù chưa bán).
        if ((item as any).flashSaleProductId) {
          await tx.flashSaleProduct.updateMany({
            where: { id: (item as any).flashSaleProductId, sold: { gte: item.quantity } },
            data: { sold: { decrement: item.quantity } },
          });
        }
      }
      // Wiki 0083: HOÀN XU đã trừ + NHẢ voucher khi hủy đơn (trước đây mất trắng xu + voucher).
      if ((order as any).coinUsed && (order as any).coinUsed > 0) {
        await tx.pointWallet.update({ where: { userId }, data: { balance: { increment: (order as any).coinUsed } } });
        await tx.pointHistory.create({
          data: { userId, amount: (order as any).coinUsed, type: PointType.REFUND, source: 'ORDER', description: `Hoàn xu hủy đơn #${orderId.slice(0, 8)}` },
        });
      }
      // [FIX #10/#10b + review-round14b - wiki 0088] Nhả voucher đúng phạm vi:
      // (1) PER-SHOP (order.voucherId): voucher shop chỉ gắn 1 đơn → nhả NGAY khi đơn này hủy (như
      //     round13). Guard siblingUsing phòng hiếm 2 đơn cùng voucherId.
      // (2) SHARED (system/freeship trong appliedVoucherIds): redeem 1 lần/checkout → CHỈ nhả khi đơn
      //     CUỐI active của group bị hủy (otherActive===0) tránh nhả N lần (drift âm).
      // Trước round14 chỉ nhả order.voucherId (1 cái) → system/freeship kẹt. Round14 blanket otherActive
      // làm shop-voucher kẹt khi partial-cancel. Tách 2 nhánh sửa cả hai.
      if (order.voucherId) {
        const siblingUsing = (order as any).paymentGroupId
          ? await tx.order.count({ where: { paymentGroupId: (order as any).paymentGroupId, voucherId: order.voucherId, id: { not: orderId }, status: { not: 'CANCELLED' } } })
          : 0;
        if (siblingUsing === 0) {
          await tx.voucher.updateMany({ where: { id: order.voucherId, usageCount: { gt: 0 } }, data: { usageCount: { decrement: 1 } } });
          await tx.userVoucher.updateMany({ where: { userId, voucherId: order.voucherId }, data: { isUsed: false, usedAt: null } });
        }
      }
      const _sharedIds: string[] = Array.isArray((order as any).appliedVoucherIds) ? (order as any).appliedVoucherIds : [];
      if (_sharedIds.length) {
        const otherActive = (order as any).paymentGroupId
          ? await tx.order.count({ where: { paymentGroupId: (order as any).paymentGroupId, id: { not: orderId }, status: { not: 'CANCELLED' } } })
          : 0;
        if (otherActive === 0) {
          for (const vId of _sharedIds) {
            await tx.voucher.updateMany({ where: { id: vId, usageCount: { gt: 0 } }, data: { usageCount: { decrement: 1 } } });
            await tx.userVoucher.updateMany({ where: { userId, voucherId: vId }, data: { isUsed: false, usedAt: null } });
          }
        }
      }
      // Notification trigger (wiki 0046 hookup point #1)
      await this.notificationService.create({
        userId,
        type: 'ORDER',
        title: 'Đơn hàng đã hủy',
        content: `Đơn hàng #${orderId.slice(0, 8)} đã được hủy theo yêu cầu của bạn. Tồn kho đã được hoàn lại.`,
        link: `/user/purchase`,
      }, tx).catch(() => {/* best-effort, không fail order */});
      return await tx.order.findUnique({ where: { id: orderId } });
    });
    return updatedOrder;
  }
  async confirmOrderReceived(userId: string, orderId: string) {
    // 1. Kiểm tra đơn hàng có tồn tại và thuộc về user này không
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: true } // Lấy items để tính toán nếu cần
    });

    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');

    // [SAFETY CHECK 1] Chặn nếu đơn hàng đã hoàn thành hoặc hủy
    if (order.status === 'DELIVERED' || order.status === 'CANCELLED') {
      throw new BadRequestException('Đơn hàng này đã được xử lý trước đó.');
    }

    // [SAFETY CHECK 2] Chỉ cho phép xác nhận khi đang vận chuyển hoặc đã xác nhận
    if (!['SHIPPING', 'CONFIRMED'].includes(order.status)) {
      throw new BadRequestException('Trạng thái đơn hàng không hợp lệ để xác nhận.');
    }

    // [round14 review-FIX HIGH] Đơn ONLINE CHƯA thanh toán KHÔNG được confirm-nhận → DELIVERED (terminal),
    // vì nếu IPN trả tiền về SAU thì creditSellerOnDelivered không chạy lại được (DELIVERED là terminal)
    // → seller MẤT doanh thu vĩnh viễn. Đối xứng với gate seller-path updateOrderStatus (round15 #3).
    // COD vẫn cho xác nhận (trả tiền khi nhận hàng).
    if (order.paymentStatus !== 'PAID' && String(order.paymentMethod).toLowerCase() !== 'cod') {
      throw new BadRequestException('Đơn thanh toán online chưa được thanh toán, không thể xác nhận đã nhận.');
    }

    // 2. TRANSACTION: Cập nhật trạng thái + Cộng xu + Ghi lịch sử
    return this.prisma.$transaction(async (tx) => {
      // A. Cập nhật trạng thái sang DELIVERED — ATOMIC guard (Wiki 0082): chỉ 1 request thắng
      // khi 2 confirm song song; còn lại count===0 → throw, KHÔNG cộng xu/điểm 2 lần.
      const claim = await tx.order.updateMany({
        where: { id: orderId, status: { in: ['SHIPPING', 'CONFIRMED'] } },
        data: { status: 'DELIVERED', updatedAt: new Date() },
      });
      if (claim.count === 0) throw new BadRequestException('Đơn hàng đã được xử lý.');
      const updatedOrder = await tx.order.findUnique({ where: { id: orderId } });
      if (!updatedOrder) throw new NotFoundException('Đơn hàng không tồn tại');

      // [round14 FIX H1] Payment-gate phần thưởng trên LUỒNG BUYER confirm nhận hàng — trước đây
      // confirmOrderReceived mint xu + charity + referral VÔ ĐIỀU KIỆN cho đơn ONLINE chưa PAID
      // (seller có thể set SHIPPING cho đơn online chưa trả → buyer confirm → đúc xu free). Gate
      // giống seller-path updateOrderStatus (line ~960): chỉ thưởng khi PAID hoặc COD.
      // creditSellerOnDelivered tự gate (line ~879) nên để nguyên.
      const isPaidForReward = order.paymentStatus === 'PAID' || String(order.paymentMethod).toLowerCase() === 'cod';

      // B. Tính toán xu thưởng (Ví dụ: 1% giá trị đơn hàng, làm tròn xuống)
      // Logic: 100.000đ = 10 xu (Tùy logic dự án của bạn)
      const conversionRate = await this.pointService.getConversionRate();
      const rawPoints = Number(order.totalAmount) / conversionRate;
      const pointsToEarn = isPaidForReward ? Math.floor(rawPoints) : 0;

      let newBalance = 0;

      // C. Cộng xu (Nếu có)
      if (pointsToEarn > 0) {
         // Gọi hàm addPoints nhưng truyền transaction (tx) vào để đảm bảo atomic
         // Lưu ý: Cần sửa hàm addPoints trong PointService để nhận tx (đã có trong file bạn gửi)
         newBalance = await this.pointService.addPoints(
            userId,
            pointsToEarn,
            PointType.EARN_ORDER,
            `REWARD_${orderId}`,
            `Hoàn xu đơn hàng #${orderId.slice(0, 8)}`,
            tx
         );
      } else {
         // Nếu không có xu thưởng thì lấy balance hiện tại để trả về FE update store
         const wallet = await tx.pointWallet.findUnique({ where: { userId } });
         newBalance = wallet?.balance || 0;
      }

      // [round14 FIX H1] charity + referral CHỈ chạy cho đơn đã thanh toán (PAID/COD) — không trích
      // hoa hồng từ thiện / không trả thưởng giới thiệu cho đơn online chưa trả tiền.
      if (isPaidForReward) {
        // D. Spec [0018]: trích 1% phí hoa hồng vào quỹ từ thiện. Idempotent qua
        // Donation.orderId @unique, an toàn nếu user spam confirm.
        try {
          await this.charityService.processOrderDelivered(tx, {
            orderId: updatedOrder.id,
            orderTotal: Number(order.totalAmount),
          });
        } catch (e: any) {
          // Không fail order vì lỗi charity — log và tiếp tục
          this.logger.warn(`[Charity hook fail] order=${updatedOrder.id} err=${e?.message}`);
        }

        // E. Spec [0018]: thưởng người giới thiệu nếu đơn này là đơn ĐẦU của
        // người được giới thiệu, giá trị ≥ REFERRAL_MIN_ORDER, và chưa từng được
        // tính (referralRewardPaid=false).
        try {
          await this.processReferralReward(tx, userId, Number(order.totalAmount));
        } catch (e: any) {
          this.logger.warn(`[Referral hook fail] order=${updatedOrder.id} err=${e?.message}`);
        }
      }

      // Wiki 0084: cộng doanh thu vào ví seller (mảnh ghép để payout chạy E2E).
      await this.creditSellerOnDelivered(tx, order);

      // F. Notification trigger (wiki 0046 hookup point #2): "Đơn hàng đã giao".
      try {
        await this.notificationService.create({
          userId,
          type: 'ORDER',
          title: 'Giao hàng thành công',
          content: pointsToEarn > 0
            ? `Đơn hàng #${updatedOrder.id.slice(0, 8)} đã giao thành công. Bạn nhận được +${pointsToEarn.toLocaleString()} xu thưởng.`
            : `Đơn hàng #${updatedOrder.id.slice(0, 8)} đã giao thành công. Hãy đánh giá sản phẩm để nhận xu nhé!`,
          link: `/user/purchase?type=completed`,
        }, tx);
      } catch (e: any) {
        this.logger.warn(`[Notif delivered fail] order=${updatedOrder.id} err=${e?.message}`);
      }

      return {
        success: true,
        orderId: updatedOrder.id,
        earnedPoints: pointsToEarn,
        newBalance: newBalance // Trả về số dư mới nhất để FE cập nhật ngay lập tức
      };

    }, {
      timeout: 15000, // Spec [0018]: charity + referral hook tăng workload, nâng timeout
      maxWait: 5000
    });
  }

  /**
   * Thưởng người giới thiệu — gọi từ trong transaction confirmOrderReceived.
   *
   * Spec [0018] + G4 (wiki 0044/0045):
   * - Trigger khi user có `referredBy` đặt đơn DELIVERED ≥ REFERRAL_MIN_ORDER (300k).
   * - Chỉ trả 1 lần — flag `referralRewardPaid` lock.
   * - **Anti-farm IP check**: nếu referrer và referee từng đặt đơn từ CÙNG IP →
   *   skip reward + log warn. Lý do: kẻ farm thường tạo nhiều account trên cùng
   *   máy/mạng để tự tích điểm. Edge case false-positive: gia đình share WiFi —
   *   chấp nhận trade-off vì spec ưu tiên chống abuse.
   *   Location check (geoip-lite/external): defer — IP-only đã chặn 90% case.
   */
  private async processReferralReward(
    tx: Prisma.TransactionClient,
    userId: string,
    orderTotal: number,
  ) {
    const minOrder = await this.systemSetting.getNumber('REFERRAL_MIN_ORDER', 300000);
    const rewardAmount = await this.systemSetting.getNumber('REFERRAL_REWARD_AMOUNT', 20000);
    if (orderTotal < minOrder) return;

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, referredById: true, referralRewardPaid: true },
    });
    if (!user || !user.referredById || user.referralRewardPaid) return;

    // G4: anti-farm check — nếu IP của referee từng trùng với bất kỳ IP của referrer → skip.
    const refereeIps = await tx.order.findMany({
      where: { userId, clientIp: { not: null } },
      select: { clientIp: true },
      distinct: ['clientIp'],
      take: 10, // bound — chỉ check 10 IP gần nhất
    });
    const refereeIpSet = new Set(refereeIps.map(o => o.clientIp).filter(Boolean));
    if (refereeIpSet.size > 0) {
      const overlap = await tx.order.findFirst({
        where: { userId: user.referredById, clientIp: { in: Array.from(refereeIpSet) as string[] } },
        select: { id: true, clientIp: true },
      });
      if (overlap) {
        this.logger.warn(`[Referral SKIP anti-farm] referrer=${user.referredById} referee=${userId} cùng IP=${overlap.clientIp}`);
        // Vẫn flag referralRewardPaid để không bị retry vô tận
        await tx.user.update({ where: { id: userId }, data: { referralRewardPaid: true } });
        return;
      }
    }

    // Bump điểm referrer + flag user đã trả thưởng
    await this.pointService.addPoints(
      user.referredById,
      rewardAmount,
      PointType.EARN_AFFILIATE,
      `REFERRAL_${userId}`,
      `Thưởng giới thiệu user ${userId.slice(0, 8)}`,
      tx,
    );
    await tx.user.update({
      where: { id: userId },
      data: { referralRewardPaid: true },
    });
    this.logger.log(`[Referral] +${rewardAmount}đ cho ${user.referredById} từ user ${userId} (đơn ${orderTotal}đ)`);
  }
  // Wiki 0084: cộng doanh thu vào ví seller khi đơn DELIVERED + đã thanh toán (COD/PAID).
  // Best-effort (try/catch) — không làm fail flow giao hàng. Là mảnh ghép để payout chạy E2E.
  private async creditSellerOnDelivered(tx: Prisma.TransactionClient, order: any) {
    try {
      if (!order?.shopId) return;
      const isPaid = order.paymentStatus === 'PAID' || String(order.paymentMethod).toLowerCase() === 'cod';
      if (!isPaid) return;
      const feeRate = await this.systemSetting.getNumber('ORDER_PLATFORM_FEE_RATE', 0.05);
      const net = Math.floor(Number(order.totalAmount) * (1 - feeRate));
      if (net <= 0) return;
      // Wiki 0086: idempotent — nếu đã có giao dịch ORDER_INCOME cho đơn này thì bỏ qua
      // (lưới an toàn cuối: chống credit ví seller 2 lần dù bị gọi lại do race/toggle).
      const already = await tx.walletTransaction.findFirst({ where: { referenceId: order.id, type: 'ORDER_INCOME' } });
      if (already) return;
      const shop = await tx.shop.findUnique({ where: { id: order.shopId }, select: { ownerId: true } });
      if (!shop?.ownerId) return;
      await tx.user.update({ where: { id: shop.ownerId }, data: { walletBalance: { increment: net } } });
      await tx.walletTransaction.create({
        data: { userId: shop.ownerId, amount: net, type: 'ORDER_INCOME', status: 'COMPLETED', referenceId: order.id, description: `Doanh thu đơn #${order.id.slice(0, 8)}` },
      });
    } catch (e: any) {
      // [FIX review-finance/MEDIUM - wiki 0088] RETHROW để tx CUỐN NGƯỢC (rollback) toàn bộ thao tác
      // DELIVERED. Trước đây chỉ log + nuốt → đơn vẫn commit DELIVERED nhưng ví seller KHÔNG được
      // cộng và KHÔNG có job đối soát nào credit lại (DELIVERED là terminal) → seller MẤT doanh thu
      // đơn đó vĩnh viễn khi gặp lỗi transient (deadlock/lock-wait). Rollback → có thể thử lại.
      this.logger.error(`[SellerCredit fail → rollback] order=${order?.id} err=${e?.message}`);
      throw e;
    }
  }

  async updateOrderStatus(orderId: string, sellerId: string, status: OrderStatus) {
    const shop = await this.prisma.shop.findUnique({ where: { ownerId: sellerId } });
    if (!shop) throw new NotFoundException('Shop không tồn tại');

    const order = await this.prisma.order.findFirst({
        where: { id: orderId, shopId: shop.id }
    });

    if (!order) throw new NotFoundException('Đơn hàng không tồn tại hoặc không thuộc quyền quản lý');

    // [round14 review-FIX MEDIUM] Chuẩn hoá status về UPPERCASE NGAY đầu vào. Trước đây check dùng
    // String(status).toUpperCase() nhưng nhánh write KHÔNG-DELIVERED ghi status THÔ → client gửi
    // 'confirmed' (thường) lọt guard rồi ghi enum sai → Prisma 500. Gán lại 1 lần, dùng xuyên suốt.
    status = String(status).toUpperCase() as OrderStatus;

    // [DEBUG] Log trạng thái ban đầu và input
    this.logger.log(`[OrderUpdate] Start update Order #${orderId}. Input Status: "${status}". Order Total: ${order.totalAmount}`);

    // Wiki 0086: DELIVERED/CANCELLED là trạng thái CUỐI — chặn đổi tiếp. Trước đây cho phép
    // DELIVERED→SHIPPING rồi SHIPPING→DELIVERED lại → mỗi lần set DELIVERED lại credit ví seller
    // + mint xu (toggle = đúc tiền vô hạn). Chặn terminal-state ở đây + atomic claim bên dưới.
    if (order.status === 'DELIVERED' || order.status === 'CANCELLED') {
      throw new BadRequestException('Đơn đã ở trạng thái cuối, không thể đổi trạng thái.');
    }

    // [round14 FIX H3] Chặn status rác (không thuộc enum) → tránh tx.order.update ném Prisma 500.
    const _validStatuses = ['PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'CANCELLED'];
    if (!_validStatuses.includes(String(status).toUpperCase())) {
      throw new BadRequestException('Trạng thái đơn hàng không hợp lệ.');
    }

    // [round14 review-FIX HIGH] Seller KHÔNG được hủy đơn ĐÃ THANH TOÁN online (paymentStatus=PAID):
    // hoàn kho/xu/voucher mà KHÔNG hoàn tiền cổng = buyer mất tiền. Đối xứng buyer cancelOrder (round15 #4)
    // — đơn PAID phải đi luồng hoàn tiền/khiếu nại.
    if (status === 'CANCELLED' && (order as any).paymentStatus === 'PAID') {
      throw new BadRequestException('Đơn đã thanh toán, không thể hủy trực tiếp — cần luồng hoàn tiền/khiếu nại.');
    }

    // [round14 FIX H3] Seller chuyển đơn sang CANCELLED qua /status: TRƯỚC ĐÂY ghi status trống
    // (tx.order.update) → KHÔNG hoàn kho/variant/flash-sold/xu/voucher → leak tồn kho + buyer mất
    // xu/voucher. Nay bồi hoàn đầy đủ giống buyer-cancel, ATOMIC claim chống double-restore.
    if (status === 'CANCELLED') {
      return this.prisma.$transaction(async (tx) => {
        const claim = await tx.order.updateMany({
          // [round14 review3-FIX MEDIUM] +paymentStatus != PAID → đóng TOCTOU (IPN set PAID xen giữa
          // gate ngoài-tx và claim) để không hủy đơn đã thanh toán mà thiếu hoàn tiền cổng.
          where: { id: orderId, status: { notIn: ['DELIVERED', 'CANCELLED'] }, paymentStatus: { not: 'PAID' } },
          data: { status: 'CANCELLED' },
        });
        if (claim.count === 0) throw new BadRequestException('Đơn đã được xử lý, không thể hủy.');
        const full = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
        if (full) {
          for (const item of (full as any).items) {
            if (item.productId) {
              await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
            }
            if (item.variantId) {
              await tx.productVariant.updateMany({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
            }
            if (item.flashSaleProductId) {
              await tx.flashSaleProduct.updateMany({ where: { id: item.flashSaleProductId, sold: { gte: item.quantity } }, data: { sold: { decrement: item.quantity } } });
            }
          }
          if ((full as any).coinUsed && (full as any).coinUsed > 0) {
            await tx.pointWallet.update({ where: { userId: full.userId }, data: { balance: { increment: (full as any).coinUsed } } });
            await tx.pointHistory.create({ data: { userId: full.userId, amount: (full as any).coinUsed, type: PointType.REFUND, source: 'ORDER', description: `Hoàn xu shop hủy đơn #${orderId.slice(0, 8)}` } });
          }
          if (full.voucherId) {
            const siblingUsing = (full as any).paymentGroupId
              ? await tx.order.count({ where: { paymentGroupId: (full as any).paymentGroupId, voucherId: full.voucherId, id: { not: orderId }, status: { not: 'CANCELLED' } } })
              : 0;
            if (siblingUsing === 0) {
              await tx.voucher.updateMany({ where: { id: full.voucherId, usageCount: { gt: 0 } }, data: { usageCount: { decrement: 1 } } });
              await tx.userVoucher.updateMany({ where: { userId: full.userId, voucherId: full.voucherId }, data: { isUsed: false, usedAt: null } });
            }
          }
          const _shared: string[] = Array.isArray((full as any).appliedVoucherIds) ? (full as any).appliedVoucherIds : [];
          if (_shared.length) {
            const otherActive = (full as any).paymentGroupId
              ? await tx.order.count({ where: { paymentGroupId: (full as any).paymentGroupId, id: { not: orderId }, status: { not: 'CANCELLED' } } })
              : 0;
            if (otherActive === 0) {
              for (const vId of _shared) {
                await tx.voucher.updateMany({ where: { id: vId, usageCount: { gt: 0 } }, data: { usageCount: { decrement: 1 } } });
                await tx.userVoucher.updateMany({ where: { userId: full.userId, voucherId: vId }, data: { isUsed: false, usedAt: null } });
              }
            }
          }
        }
        await this.notificationService.create({ userId: order.userId, type: 'ORDER', title: 'Đơn hàng đã hủy', content: `Đơn hàng #${orderId.slice(0, 8)} đã bị shop hủy. Tồn kho/xu/voucher đã được hoàn lại.`, link: `/user/purchase` }, tx).catch(() => {/* best-effort */});
        return await tx.order.findUnique({ where: { id: orderId } });
      });
    }

    // [M1 - wiki 0088] CÂN NHẮC & KHÔNG enforce FSM cứng (PENDING→DELIVERED): mô hình COD cho phép
    // seller chuyển nhanh; abuse "credit hàng chưa giao" đã được giảm thiểu bằng idempotent
    // creditSellerOnDelivered (round11) + terminal-guard + luồng khiếu nại. Ép FSM một chiều sẽ phá
    // luồng FE và bộ test hiện hữu (round7/9/11 cố ý set thẳng DELIVERED). Để mở, ghi nhận accepted-risk.

    // [FIX round15 #3 - wiki 0088] CHẶN DELIVERED cho đơn ONLINE CHƯA THANH TOÁN. Trước đây cho phép
    // (chỉ skip reward) → nếu IPN về SAU khi đã DELIVERED thì set PAID nhưng creditSeller KHÔNG chạy
    // lại (DELIVERED là terminal) → seller MẤT doanh thu đơn đó vĩnh viễn. Bắt buộc đơn online phải
    // PAID trước khi giao; IPN set PAID xong, seller giao → creditSeller chạy đúng.
    if (String(status).toUpperCase() === 'DELIVERED') {
      const isPaidOrCod = order.paymentStatus === 'PAID' || String(order.paymentMethod).toLowerCase() === 'cod';
      if (!isPaidOrCod) {
        throw new BadRequestException('Đơn thanh toán online chưa được thanh toán, không thể đánh dấu đã giao.');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Cập nhật trạng thái — chuyển sang DELIVERED phải ATOMIC: claim where status != DELIVERED.
      //    Thua race (buyer confirm nhận hàng / seller bấm 2 lần đồng thời) → bail, KHÔNG reward/credit lần 2.
      if (String(status).toUpperCase() === 'DELIVERED') {
        const claim = await tx.order.updateMany({
          where: { id: orderId, status: { not: 'DELIVERED' } },
          data: { status },
        });
        if (claim.count === 0) {
          return await tx.order.findUnique({ where: { id: orderId } });
        }
      } else {
        await tx.order.update({ where: { id: orderId }, data: { status } });
      }
      const updatedOrder = await tx.order.findUnique({ where: { id: orderId } });

      this.logger.log(`[OrderUpdate] DB Update Status Success: ${updatedOrder?.status}`);

      // [FIX LOGIC] Chuẩn hóa status về UpperCase để so sánh cho chắc chắn
      // Và đảm bảo so sánh với Enum hoặc string chuẩn
      const isPaidForReward = order.paymentStatus === 'PAID' || String(order.paymentMethod).toLowerCase() === 'cod';
      if (String(status).toUpperCase() === 'DELIVERED' && !isPaidForReward) {
          // Wiki 0082: KHÔNG cộng xu cho đơn thanh toán ONLINE chưa trả (paymentStatus != PAID).
          // Trước đây seller tự set DELIVERED = mint xu cho đơn chưa trả. COD vẫn thưởng (trả khi nhận).
          this.logger.warn(`[Reward] SKIP — order ${orderId} chưa thanh toán (paymentStatus=${order.paymentStatus}, method=${order.paymentMethod}).`);
      } else if (String(status).toUpperCase() === 'DELIVERED') {

          // Tính toán
          const conversionRate = await this.pointService.getConversionRate(); // Lấy từ DB/Redis
          const rawPoints = Number(order.totalAmount) / conversionRate;
          const pointsToEarn = Math.floor(rawPoints);

          // [DEBUG] Log tính toán chi tiết
          this.logger.log(`[OrderUpdate] Calculation: Total=${order.totalAmount} / 10000 = ${rawPoints} -> Floor = ${pointsToEarn} points.`);

          if (pointsToEarn > 0) {
              try {
                  // Gọi pointService với Transaction Context (tx)
                  const newBalance = await this.pointService.addPoints(
                      order.userId,
                      pointsToEarn,
                      PointType.EARN_ORDER, 
                      `REWARD_${order.id}`, 
                      `Hoàn xu đơn hàng #${order.id.slice(0, 8)}`,
                      tx 
                  );
                  this.logger.log(`[Reward] SUCCESS! User ${order.userId} received ${pointsToEarn} points. New Balance: ${newBalance}`);
              } catch (err) {
                  // [QUAN TRỌNG] Log lỗi nếu addPoints thất bại (ví dụ do Enum sai)
                  this.logger.error(`[Reward] FAILED to add points: ${err.message}`, err.stack);
                  // Tùy bạn quyết định: Có throw lỗi để rollback status Order không?
                  // Nếu muốn rollback order khi cộng xu lỗi thì uncomment dòng dưới:
                  // throw err; 
              }
          } else {
              this.logger.warn(`[Reward] SKIPPED. Reason: Calculated points is 0 (Order value too low).`);
          }
      } else {
          this.logger.log(`[OrderUpdate] Logic skipped because status "${status}" is not DELIVERED.`);
      }

      // Wiki 0084: cộng doanh thu ví seller khi DELIVERED (E2E payout).
      if (String(status).toUpperCase() === 'DELIVERED') {
        await this.creditSellerOnDelivered(tx, order);
      }

      // Notification trigger (wiki 0046 hookup point #3): khi seller chuyển status,
      // báo cho buyer biết. Mapping status → message gọn.
      try {
        const statusMsg: Record<string, { title: string; content: (id: string) => string }> = {
          CONFIRMED: { title: 'Đơn hàng đã được xác nhận', content: (id) => `Shop đã xác nhận đơn #${id.slice(0, 8)}. Hàng sẽ được chuẩn bị và gửi sớm.` },
          SHIPPING: { title: 'Đơn hàng đang vận chuyển', content: (id) => `Đơn #${id.slice(0, 8)} đã được giao cho đơn vị vận chuyển. Vui lòng chú ý điện thoại.` },
          DELIVERED: { title: 'Giao hàng thành công', content: (id) => `Đơn #${id.slice(0, 8)} đã giao thành công. Hãy đánh giá để nhận xu nhé!` },
          CANCELLED: { title: 'Đơn hàng đã hủy', content: (id) => `Đơn #${id.slice(0, 8)} đã bị hủy.` },
        };
        const cfg = statusMsg[String(status).toUpperCase()];
        if (cfg) {
          await this.notificationService.create({
            userId: order.userId,
            type: 'ORDER',
            title: cfg.title,
            content: cfg.content(order.id),
            link: `/user/purchase`,
          }, tx);
        }
      } catch (e: any) {
        this.logger.warn(`[Notif status fail] order=${order.id} err=${e?.message}`);
      }

      return updatedOrder;
    }, {
        timeout: 20000 // Tăng timeout nếu cần
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

  // Admin xem chi tiết bất kỳ order nào (không filter userId).
  // Khác `findOne()` ở chỗ không yêu cầu order thuộc user — phục vụ Admin
  // dashboard #55 view order detail.
  async findOneAsAdmin(id: string) {
    if (!id || id === 'undefined') throw new NotFoundException('ID không hợp lệ');
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id }, { shippingOrderCode: id }] },
      include: {
        items: { include: { product: { select: { id: true, name: true, slug: true, images: true, price: true } } } },
        voucher: true,
        shop: { select: { id: true, name: true, slug: true } },
        user: { select: { id: true, name: true, email: true, phone: true, avatar: true } },
      },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    return order;
  }
}