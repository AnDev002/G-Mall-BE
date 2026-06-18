import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisService } from '../../database/redis/redis.service';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { Prisma, VoucherScope, VoucherType } from '@prisma/client';

@Injectable()
export class PromotionService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService
  ) {}

  // =================================================================
  // 🆕 PHẦN MỚI: LOGIC TÍNH TOÁN MULTI-SHOP (Dùng cho OrderService mới)
  // =================================================================
  
  /**
   * Tính toán voucher cho đơn hàng gồm nhiều Shop.
   * Logic:
   * 1. Tách voucher Shop và voucher Hệ thống.
   * 2. Áp dụng voucher Shop trước (trừ vào subtotal của từng shop).
   * 3. Tính lại tổng tiền sau khi trừ voucher Shop.
   * 4. Áp dụng voucher Hệ thống trên tổng tiền mới.
   */
  async calculateMultiShopVouchers(
    voucherIds: string[],
    shopGroups: Record<string, any> // Map: { shopId: { subtotal: number, items: [] } }
  ) {
    if (!voucherIds || voucherIds.length === 0) {
      return {
        shopDiscounts: {}, // Map<shopId, number>
        systemDiscount: 0,
        freeshipDiscount: 0, // [FIX H2 - wiki 0088] luôn trả field này để OrderService không nhận undefined
        appliedVouchers: []
      };
    }

    // 1. Fetch Vouchers (Kèm shopId để phân loại).
    // B7.11: trước đây thiếu include `categories` → voucher scope CATEGORY load
    // thiếu data → chạy vào nhánh else và bị bỏ qua. Thêm include để chuẩn.
    const vouchers = await this.prisma.voucher.findMany({
      where: {
        code: { in: voucherIds },
        isActive: true,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
      include: {
        products: { select: { id: true } },
        categories: { select: { id: true } },
        shop: { select: { id: true } }
      }
    });

    // G2 (wiki 0044/0045): enforce stack rule theo Require GMall §4 — TỐI ĐA:
    //   1 voucher GLOBAL (sàn) + 1 voucher SHOP/PRODUCT/CATEGORY mỗi shop + 1 voucher FREESHIP.
    // Trước đây code loop không cap → user có thể stack vô hạn voucher.
    {
      const globalCount = vouchers.filter(v => v.scope === VoucherScope.GLOBAL && v.type !== VoucherType.FREESHIP).length;
      if (globalCount > 1) {
        throw new BadRequestException('Mỗi đơn chỉ áp dụng tối đa 1 voucher của sàn');
      }

      const freeshipCount = vouchers.filter(v => v.type === VoucherType.FREESHIP).length;
      if (freeshipCount > 1) {
        throw new BadRequestException('Mỗi đơn chỉ áp dụng tối đa 1 voucher freeship');
      }

      const shopVoucherCount: Record<string, number> = {};
      for (const v of vouchers) {
        const isShopScope = (v.scope === VoucherScope.SHOP || v.scope === VoucherScope.PRODUCT || v.scope === VoucherScope.CATEGORY)
          && v.type !== VoucherType.FREESHIP
          && v.shopId;
        if (!isShopScope) continue;
        const sid = v.shopId as string;
        shopVoucherCount[sid] = (shopVoucherCount[sid] || 0) + 1;
        if (shopVoucherCount[sid] > 1) {
          throw new BadRequestException('Mỗi shop chỉ áp dụng tối đa 1 voucher');
        }
      }
    }

    const appliedVouchers: any[] = [];
    const shopDiscounts: Record<string, number> = {};
    let systemDiscount = 0;

    // 2. Phân loại.
    // B7.9: voucher scope CATEGORY có `shopId` (voucher shop giới hạn theo danh mục)
    // trước đây bị exclude khỏi shopVouchers loop nên không được tính → bỏ qua hoặc
    // bị xử lý sai shop. Thêm CATEGORY vào nhóm shopVouchers để loop xử lý.
    // [FIX H2 - wiki 0088] LOẠI voucher type=FREESHIP khỏi nhóm shop/system. Trước đây
    // voucher GLOBAL+FREESHIP bị match cả systemVouchers (scope===GLOBAL) LẪN freeshipVouchers
    // (type===FREESHIP) → push 2 lần vào appliedVouchers → (a) freeship trừ nhầm vào subtotal,
    // (b) redeem loop đốt voucher 2 lần → throw "đã hết lượt" → FAIL đơn. Giờ FREESHIP CHỈ do
    // nhánh freeshipVouchers xử lý (push 1 lần, giảm vào phí ship).
    const shopVouchers = vouchers.filter(
      (v) =>
        v.type !== VoucherType.FREESHIP &&
        (v.scope === VoucherScope.SHOP ||
          v.scope === VoucherScope.PRODUCT ||
          v.scope === VoucherScope.CATEGORY),
    );
    const systemVouchers = vouchers.filter(v => v.scope === VoucherScope.GLOBAL && v.type !== VoucherType.FREESHIP);

    // 3. Xử lý Voucher Shop
    for (const voucher of shopVouchers) {
      const targetShopId = voucher.shopId;
      // Nếu voucher không thuộc shop nào trong giỏ hàng -> Bỏ qua
      if (!targetShopId || !shopGroups[targetShopId]) continue; 

      const group = shopGroups[targetShopId];
      let eligibleAmount = 0;

      if (voucher.scope === VoucherScope.PRODUCT) {
        // Chỉ tính tổng tiền các sản phẩm được chọn trong voucher
        const validProductIds = voucher.products.map(p => p.id);
        eligibleAmount = group.items
          .filter((i: any) => validProductIds.includes(i.productId))
          .reduce((sum: number, i: any) => sum + i.subtotal, 0);
      } else if (voucher.scope === VoucherScope.CATEGORY) {
        // B7.9: scope CATEGORY chỉ tính item thuộc danh mục voucher CẤM shop khác.
        // voucher.categories đã include ở query; check item.categoryId.
        const validCatIds = (voucher as any).categories?.map((c: any) => c.id) ?? [];
        eligibleAmount = group.items
          .filter((i: any) => i.categoryId && validCatIds.includes(i.categoryId))
          .reduce((sum: number, i: any) => sum + i.subtotal, 0);
      } else {
        // Scope SHOP: Tính trên toàn bộ đơn của shop đó
        eligibleAmount = group.subtotal;
      }

      if (eligibleAmount < Number(voucher.minOrderValue)) continue;

      // Tính tiền giảm
      let discount = 0;
      if (voucher.type === VoucherType.FIXED_AMOUNT) {
        discount = Number(voucher.amount);
      } else {
        discount = (eligibleAmount * Number(voucher.amount)) / 100;
        if (voucher.maxDiscount) discount = Math.min(discount, Number(voucher.maxDiscount));
      }
      // [FIX M2 - wiki 0088] CAP giảm giá ≤ phần tiền hợp lệ của shop. Trước đây FIXED_AMOUNT lớn
      // (vd 1tr cho đơn 50k) không bị chặn → discount tràn, làm payableBeforeCoins (tổng đơn) bị
      // trừ lẹm sang shop/ship khác → cổng charge ÍT hơn tổng Order.totalAmount đã lưu (rò tiền).
      discount = Math.max(0, Math.min(discount, eligibleAmount));

      // Cộng dồn giảm giá cho shop đó (đề phòng shop cho dùng nhiều voucher - tùy logic business)
      // Ở đây giả định mỗi loại voucher áp dụng 1 lần, nhưng code hỗ trợ cộng dồn
      shopDiscounts[targetShopId] = (shopDiscounts[targetShopId] || 0) + discount;
      
      appliedVouchers.push({ 
          ...voucher, 
          appliedAmount: discount, 
          shopId: targetShopId,
          isSystem: false
      });
    }

    // 4. Tính tổng tiền còn lại sau khi trừ Voucher Shop để áp dụng Voucher Sàn
    let totalAfterShopDiscount = 0;
    Object.keys(shopGroups).forEach(shopId => {
      const originalSub = shopGroups[shopId].subtotal;
      const shopDisc = shopDiscounts[shopId] || 0;
      totalAfterShopDiscount += Math.max(0, originalSub - shopDisc); 
    });

    // 5. Xử lý Voucher Sàn (System)
    for (const voucher of systemVouchers) {
      // Voucher sàn tính trên tổng tiền (đã trừ Shop Voucher)
      if (totalAfterShopDiscount < Number(voucher.minOrderValue)) continue;

      let discount = 0;
      if (voucher.type === VoucherType.FIXED_AMOUNT) {
        discount = Number(voucher.amount);
      } else {
        discount = (totalAfterShopDiscount * Number(voucher.amount)) / 100;
        if (voucher.maxDiscount) discount = Math.min(discount, Number(voucher.maxDiscount));
      }

      systemDiscount += discount;
      appliedVouchers.push({ 
          ...voucher, 
          appliedAmount: discount, 
          isSystem: true 
      });
    }

    // Chốt chặn: Tổng giảm giá không vượt quá tổng tiền
    if (systemDiscount > totalAfterShopDiscount) systemDiscount = totalAfterShopDiscount;

    // Spec [0018]: voucher FREESHIP không ăn vào subtotal mà giảm vào phí ship.
    // Trả `freeshipDiscount` riêng để OrderService trừ vào shippingFee thay vì
    // total. Voucher FREESHIP có thể là sàn (apply toàn đơn) hoặc shop.
    const freeshipVouchers = vouchers.filter((v) => v.type === VoucherType.FREESHIP);
    let freeshipDiscount = 0;
    for (const voucher of freeshipVouchers) {
      // FREESHIP value = số tiền ship được giảm (FIXED), hoặc % * shippingFee.
      // Trả raw amount, OrderService cap với phí ship thực tế.
      const amt = Number(voucher.amount) || 0;
      freeshipDiscount += amt;
      appliedVouchers.push({
        ...voucher,
        appliedAmount: amt,
        isSystem: voucher.scope === VoucherScope.GLOBAL,
        isFreeship: true,
      });
    }

    return {
      shopDiscounts,
      systemDiscount,
      freeshipDiscount,
      appliedVouchers,
    };
  }

  // =================================================================
  // 🔽 LOGIC CŨ (GIỮ NGUYÊN ĐỂ KHÔNG LỖI FE/CONTROLLER CŨ)
  // =================================================================

  // --- 1. CORE LOGIC: TÍNH TOÁN GIẢM GIÁ (CŨ) ---
  async validateAndCalculateVouchers(
    voucherIds: string[], 
    orderTotal: number,   
    items: any[] 
  ) {
    if (!voucherIds || voucherIds.length === 0) {
      return { totalDiscount: 0, appliedVouchers: [] };
    }

    // Fetch Voucher kèm thông tin Product và Category
    const vouchers = await this.prisma.voucher.findMany({
      where: {
        code: { in: voucherIds },
        isActive: true,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
      include: { 
        products: { select: { id: true } },
        categories: { select: { id: true } }
      }
    });

    // Lấy thông tin category của sản phẩm trong giỏ
    const productIds = items.map(i => i.productId);
    const dbProducts = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, categoryId: true }
    });

    let totalDiscount = 0;
    const appliedVouchers: any[] = [];

    for (const voucher of vouchers) {
      let eligibleTotal = 0;

      if (voucher.scope === 'GLOBAL' || voucher.scope === 'SHOP') {
        eligibleTotal = orderTotal;
      } 
      else if (voucher.scope === 'PRODUCT') {
        const validIds = voucher.products.map(p => p.id);
        eligibleTotal = items
          .filter(i => validIds.includes(i.productId))
          .reduce((sum, i) => sum + (i.price * i.quantity), 0);
      } 
      else if (voucher.scope === 'CATEGORY') {
        const validCatIds = voucher.categories.map(c => c.id);
        
        // [FIX] Lọc item thuộc category (Check null an toàn)
        const validItems = items.filter(item => {
          const productInfo = dbProducts.find(p => p.id === item.productId);
          return productInfo && productInfo.categoryId && validCatIds.includes(productInfo.categoryId);
        });

        eligibleTotal = validItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
      }

      if (eligibleTotal < Number(voucher.minOrderValue)) continue;

      let amount = 0;
      if (voucher.type === 'FIXED_AMOUNT') {
        amount = Number(voucher.amount);
      } else if (voucher.type === 'PERCENTAGE') {
        amount = (eligibleTotal * Number(voucher.amount)) / 100;
        if (voucher.maxDiscount) {
          amount = Math.min(amount, Number(voucher.maxDiscount));
        }
      }

      totalDiscount += amount;
      appliedVouchers.push(voucher);
    }

    if (totalDiscount > orderTotal) totalDiscount = orderTotal;

    return { totalDiscount, appliedVouchers };
  }

  async getPublicSystemVouchers() {
    const now = new Date();
    return this.prisma.voucher.findMany({
      where: {
        scope: VoucherScope.GLOBAL, // Chỉ lấy voucher toàn sàn
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: { createdAt: 'desc' },
      // Có thể include thêm số lượng đã dùng nếu cần hiển thị progress bar
    });
  }

  // --- 2. WRAPPER CHO CONTROLLER ---
  async calculateDiscount(dto: any) {
    const voucherIds = dto.voucherCode ? [dto.voucherCode] : [];
    return this.validateAndCalculateVouchers(voucherIds, dto.total, dto.items || []);
  }

  // --- 3. SELLER: TẠO VOUCHER SHOP ---
  async createShopVoucher(sellerId: string, dto: CreateVoucherDto) {
    // 1. Validate ngày
    if (new Date(dto.endDate) <= new Date(dto.startDate)) {
        throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    }

    // 2. [THÊM MỚI] Kiểm tra mã voucher đã tồn tại chưa
    const existingVoucher = await this.prisma.voucher.findUnique({
      where: { code: dto.code }
    });
    if (existingVoucher) {
      throw new BadRequestException(`Mã voucher '${dto.code}' đã tồn tại. Vui lòng chọn mã khác.`);
    }

    // 3. Validate Scope
    if (dto.scope === VoucherScope.PRODUCT && !dto.productIds?.length) {
        throw new BadRequestException('Vui lòng chọn sản phẩm');
    }
    if (dto.scope === VoucherScope.CATEGORY && !dto.categoryIds?.length) {
        throw new BadRequestException('Vui lòng chọn danh mục');
    }

    // [FIX H1 - wiki 0088] LẤY shopId của seller và GẮN vào voucher. Trước đây create chỉ set
    // sellerId, để shopId=NULL → calculateMultiShopVouchers (line `targetShopId=voucher.shopId;
    // if(!targetShopId) continue`) BỎ QUA mọi voucher shop → giảm 0đ, voucher seller vô dụng &
    // không hiện trong list shop. shopId = Shop.id (KHÁC sellerId/ownerId).
    const shop = await this.prisma.shop.findUnique({ where: { ownerId: sellerId } });
    if (!shop) throw new BadRequestException('Bạn chưa có shop nên không thể tạo voucher.');

    // [FIX V1 - wiki 0091] IDOR: trước đây connect dto.productIds mà KHÔNG kiểm sản phẩm thuộc shop của
    // seller → seller A gắn voucher vào sản phẩm shop B (ô nhiễm _ProductToVoucher + griefing trang SP shop B).
    // Bắt buộc mọi productId thuộc shop.id. (categoryIds là taxonomy toàn sàn nên KHÔNG cần check.)
    if (dto.scope === VoucherScope.PRODUCT && dto.productIds?.length) {
      const ownedCount = await this.prisma.product.count({
        where: { id: { in: dto.productIds }, shopId: shop.id },
      });
      if (ownedCount !== new Set(dto.productIds).size) {
        throw new BadRequestException('Voucher chỉ được áp cho sản phẩm thuộc shop của bạn.');
      }
    }

    return await this.prisma.$transaction(async (tx) => {
      const voucher = await tx.voucher.create({
        data: {
          sellerId,
          shopId: shop.id,
          code: dto.code,
          name: dto.name,
          type: dto.type,
          scope: dto.scope,
          amount: new Prisma.Decimal(dto.amount),
          usageLimit: dto.usageLimit,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          minOrderValue: new Prisma.Decimal(dto.minOrderValue || 0),
          maxDiscount: dto.maxDiscount ? new Prisma.Decimal(dto.maxDiscount) : null,
          
          products: dto.scope === VoucherScope.PRODUCT && dto.productIds ? {
            connect: dto.productIds.map(id => ({ id }))
          } : undefined,

          categories: dto.scope === VoucherScope.CATEGORY && dto.categoryIds ? {
            connect: dto.categoryIds.map(id => ({ id }))
          } : undefined
        }
      });
      
      // [round14 review-FIX] Bỏ ghi `voucher:CODE:stock` — sau M9 key này KHÔNG còn được đọc/DECR
      // (ngân sách lượt dùng do DB usageCount lo ở redeem). Tránh để lại dead key trong Redis.

      return voucher;
    });
  }

  // --- 4. ADMIN: TẠO VOUCHER HỆ THỐNG ---
  async createSystemVoucher(dto: CreateVoucherDto) {
    // 1. Validate ngày
    if (new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    }

    // 2. [THÊM MỚI] Kiểm tra trùng mã
    const existingVoucher = await this.prisma.voucher.findUnique({
      where: { code: dto.code }
    });
    if (existingVoucher) {
      throw new BadRequestException(`Mã voucher '${dto.code}' đã tồn tại.`);
    }
    
    // Validate Scope cho Admin
    if (dto.scope === VoucherScope.PRODUCT && !dto.productIds?.length) {
        throw new BadRequestException('Vui lòng chọn sản phẩm áp dụng');
    }
    // Admin cũng có thể tạo voucher theo Category nếu muốn (Logic tương tự)

    return await this.prisma.$transaction(async (tx) => {
      const voucher = await tx.voucher.create({
        data: {
          sellerId: null, // Admin
          code: dto.code,
          name: dto.name,
          type: dto.type,
          scope: dto.scope, 
          amount: new Prisma.Decimal(dto.amount),
          usageLimit: dto.usageLimit,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          minOrderValue: new Prisma.Decimal(dto.minOrderValue || 0),
          maxDiscount: dto.maxDiscount ? new Prisma.Decimal(dto.maxDiscount) : null,
          
          products: dto.scope === VoucherScope.PRODUCT && dto.productIds ? {
            connect: dto.productIds.map(id => ({ id }))
          } : undefined,
          
          // Nếu Admin muốn support Category scope thì thêm đoạn này:
          categories: dto.scope === VoucherScope.CATEGORY && dto.categoryIds ? {
            connect: dto.categoryIds.map(id => ({ id }))
          } : undefined
        }
      });

      // [round14 review-FIX] Bỏ ghi `voucher:CODE:stock` — sau M9 key này KHÔNG còn được đọc/DECR
      // (ngân sách lượt dùng do DB usageCount lo ở redeem). Tránh để lại dead key trong Redis.

      return voucher;
    });
  }

  // --- 5. BUYER: CLAIM VOUCHER ---
  async claimVoucher(userId: string, code: string) {
    // Fix B-NEW-6 (wiki 0025): pre-check voucher tồn tại + chưa hết hạn TRƯỚC
    // khi vào Redis script. Trước đây Redis script chỉ check stock + dedup user,
    // không check endDate -> user save voucher hết hạn vào ví -> UX confusing.
    const voucher = await this.prisma.voucher.findUnique({ where: { code } });
    if (!voucher) throw new BadRequestException('Voucher không tồn tại');
    const now = new Date();
    if (voucher.endDate < now) {
      throw new BadRequestException('Voucher đã hết hạn');
    }
    if (voucher.startDate > now) {
      throw new BadRequestException('Voucher chưa bắt đầu');
    }
    if (!voucher.isActive) {
      throw new BadRequestException('Voucher đã bị tạm dừng');
    }

    const usersKey = `voucher:${code}:users`;

    // [round14 FIX M9] CLAIM giờ là "lưu vào ví" thuần — KHÔNG còn trừ budget riêng
    // `voucher:CODE:stock`. Trước đây Lua DECR stock này như một ngân sách lượt dùng,
    // nhưng redeem (order.service.ts) chỉ trừ DB usageCount và stock Redis KHÔNG BAO GIỜ
    // được hoàn lại khi cancel/un-save → budget claim tụt vĩnh viễn & lệch với usageLimit
    // thật. Giới hạn lượt dùng global+per-user ĐÃ được DB usageCount enforce đúng ở redeem.
    // Ở đây chỉ giữ set dedup per-user (SISMEMBER/SADD) để 1 user không claim trùng voucher.
    const script = `
      if redis.call('SISMEMBER', KEYS[1], ARGV[1]) == 1 then return -2 end
      redis.call('SADD', KEYS[1], ARGV[1])
      return 1
    `;

    const client = this.redisService.getClient();
    const result = await client.eval(script, 1, usersKey, userId);

    if (result === -2) throw new BadRequestException('Bạn đã lưu voucher này rồi');

    await this.prisma.userVoucher.create({
        data: { userId, voucherId: voucher.id }
    }).catch(() => {});

    return { message: 'Lưu voucher thành công!' };
  }

  // --- 6. GETTERS ---
  async getShopVouchers(sellerId: string) {
    return this.prisma.voucher.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { userVouchers: true, orders: true } } }
    });
  }

  async getMyVouchers(userId: string) {
    const userVouchers = await this.prisma.userVoucher.findMany({
      where: { userId, isUsed: false },
      include: { voucher: true },
      orderBy: { createdAt: 'desc' }
    });
    return userVouchers.map(uv => ({ ...uv.voucher, savedAt: uv.createdAt, userVoucherId: uv.id }));
  }

  async getSystemVouchers() {
    return this.prisma.voucher.findMany({
      where: { scope: VoucherScope.GLOBAL },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { userVouchers: true, orders: true } } }
    });
  }

  async getAllVouchers(filter: { scope?: VoucherScope; search?: string }) {
    const where: Prisma.VoucherWhereInput = {};
    if (filter.scope) where.scope = filter.scope;
    if (filter.search) {
      where.OR = [
        { code: { contains: filter.search } },
        { name: { contains: filter.search } }
      ];
    }
    return this.prisma.voucher.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        seller: { select: { id: true, shopName: true } },
        _count: { select: { userVouchers: true, orders: true } }
      }
    });
  }
}