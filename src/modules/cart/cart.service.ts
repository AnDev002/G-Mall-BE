import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from 'src/database/redis/redis.constants'; // Import từ module vừa tạo
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AddToCartDto } from './dto/add-to-cart.dto';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private prisma: PrismaService,
  ) {}

  private getCartKey(userId: string) {
    return `cart:${userId}`;
  }

  // [round15 FIX cart-variant] Biến variant thành first-class trong Redis hash.
  // Field giờ là composite `${productId}:${variantId ?? ''}` để 2 variant khác nhau của
  // cùng 1 SP KHÔNG bị gộp và removeItem/updateQuantity chỉ tác động đúng 1 variant.
  // Item không có variant → field = `${productId}:` (đuôi rỗng).
  private buildCartField(productId: string, variantId?: string | null): string {
    // [round15 FIX cart-variant-compat] Item KHÔNG variant → field = bare `productId` (KHÔNG đuôi ':')
    // để giữ ĐÚNG hợp đồng cũ: PATCH/DELETE /store/cart/:itemId với itemId = productId vẫn trúng (FE
    // legacy + test). Chỉ item CÓ variant mới dùng composite `productId:variantId`. parseCartField xử
    // lý cả 2 (không ':' → variantId=null). Nhờ vậy 2 variant vẫn tách field, no-variant vẫn tương thích.
    return variantId ? `${productId}:${variantId}` : productId;
  }

  // [round15 FIX cart-variant] Parse 1 hash field ra { productId, variantId }.
  // Backward-compat: field LEGACY (lưu trước fix, chỉ là bare productId không có dấu ':')
  // → coi như productId thuần, variantId = null. Field mới luôn có ít nhất 1 dấu ':'.
  private parseCartField(field: string): { productId: string; variantId: string | null } {
    const idx = field.indexOf(':');
    if (idx === -1) {
      // Legacy field: chỉ là productId.
      return { productId: field, variantId: null };
    }
    const productId = field.slice(0, idx);
    const variantPart = field.slice(idx + 1);
    return { productId, variantId: variantPart === '' ? null : variantPart };
  }

  // [round15 L2 FIX] Chọn tồn kho để guard cart cho 1 item:
  // - KHÔNG variantId → product.stock (như cũ).
  // - CÓ variantId → tồn kho của ĐÚNG variant (khớp theo id HOẶC sku để chịu được FE gửi
  //   sku-preferred). Không tìm thấy variant (stale/unknown id) → fallback product.stock; order
  //   time sẽ chặn variant không hợp lệ nên không oversell, mà cart vẫn không vỡ hành vi đang pass.
  private resolveGuardStock(
    product: { stock: number; variants: { id: string; sku: string | null; stock: number }[] },
    variantId?: string | null,
  ): number {
    if (!variantId) return product.stock;
    const variant = product.variants.find(v => v.id === variantId || v.sku === variantId);
    return variant ? variant.stock : product.stock;
  }

  async acquireStock(productId: string, quantity: number): Promise<boolean> {
    const key = `product:stock:${productId}`;
    
    // Lua script: Kiểm tra stock >= quantity thì trừ, trả về 1 (thành công). Ngược lại trả về 0.
    const script = `
      local stock = tonumber(redis.call("get", KEYS[1]))
      if not stock then return -1 end -- Chưa sync stock lên Redis
      if stock >= tonumber(ARGV[1]) then
        redis.call("decrby", KEYS[1], ARGV[1])
        return 1
      else
        return 0
      end
    `;

    const result = await this.redis.eval(script, 1, key, quantity);
    
    if (result === -1) {
      // Trường hợp Redis chưa có key stock -> Fallback: Gọi DB lấy stock set vào Redis rồi thử lại (Lazy load)
      // Tạm thời return false để đơn giản hoá, hoặc bạn implement logic sync ở đây.
      return false; 
    }
    
    return result === 1;
  }

  async releaseStock(productId: string, quantity: number) {
      // Trả lại kho nếu tạo đơn thất bại
      await this.redis.incrby(`product:stock:${productId}`, quantity);
  }
  // 1. Thêm vào giỏ (Thao tác Redis - O(1))
  async addToCart(userId: string, dto: AddToCartDto) {
    // Fix B-NEW-1 (wiki 0023): pre-check productId tồn tại trong DB.
    // Trước đây HINCRBY thẳng vào Redis -> cart chứa ghost productId ->
    // checkout JOIN Product crash 500 (chain bug).
    // [round15 L2 FIX] Lấy luôn các variant để guard tồn kho ĐÚNG cấp (variant vs product).
    const exists = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: {
        id: true,
        stock: true,
        variants: { select: { id: true, sku: true, stock: true } },
      },
    });
    if (!exists) {
      throw new NotFoundException('Sản phẩm không tồn tại');
    }

    const key = this.getCartKey(userId);
    // [round15 FIX cart-variant] Dùng composite field theo productId + variant.
    const field = this.buildCartField(dto.productId, dto.productVariantId);
    // Reject nếu tổng số lượng (đã có trong cart + thêm mới) vượt quá tồn kho.
    const currentRaw = await this.redis.hget(key, field);
    // Fix #10 (Wiki 0086): coerce qty hiện tại bằng Number(...)||0.
    // Trước đây parseInt(rác phi-số) -> NaN; mà NaN + quantity > stock luôn = false
    // -> guard tồn kho bị bypass khi data Redis bị hỏng/phi-số. Number(...)||0 ép NaN về 0.
    const currentQty = Number(currentRaw) || 0;
    // [round15 L2 FIX] Stock guard per-variant. ProductVariant.stock là tồn kho authoritative
    // cho item có biến thể (order.service trừ ProductVariant.stock atomic, khớp variant theo id).
    // Khi item CÓ variantId → guard theo tồn kho của ĐÚNG variant đó (composite field đã tách mỗi
    // variant 1 dòng nên currentQty + quantity là tổng đúng của riêng variant này). Khi KHÔNG có
    // variant → guard theo product.stock như cũ. Khớp variant theo id HOẶC sku để chịu được FE gửi
    // sku-preferred; nếu không tìm thấy (stale/unknown) → fallback product.stock (order-time sẽ
    // chặn variant không hợp lệ), giữ nguyên hành vi đang pass.
    const guardStock = this.resolveGuardStock(exists, dto.productVariantId);
    if (currentQty + dto.quantity > guardStock) {
      throw new BadRequestException('Vượt quá tồn kho');
    }

    // HINCRBY: Tăng số lượng item trong hash. Nếu chưa có tự tạo mới.
    // Thao tác này là Atomic trên Redis.
    await this.redis.hincrby(key, field, dto.quantity);

    // Set TTL (Time to live) cho giỏ hàng (ví dụ 7 ngày) để tự dọn dẹp rác
    await this.redis.expire(key, 60 * 60 * 24 * 7);

    return { message: 'Đã cập nhật giỏ hàng (Redis Cache)' };
  }

  // 2. Lấy giỏ hàng (Gộp data từ Redis + Info sản phẩm từ DB)
  async getCart(userId: string) {
    const key = this.getCartKey(userId);

    const cartItemsRaw = await this.redis.hgetall(key);
    // [round15 FIX cart-variant] Field giờ là composite `${productId}:${variantId}` → parse
    // ra productId để JOIN Product, nhưng giữ nguyên field gốc làm `id` để FE remove/update
    // đúng 1 variant. Backward-compat: legacy field (bare productId) parse ra variantId=null.
    const fields = Object.keys(cartItemsRaw);

    if (fields.length === 0) {
      return { items: [], total: 0 };
    }

    const parsed = fields.map(f => ({ field: f, ...this.parseCartField(f) }));
    const productIds = [...new Set(parsed.map(p => p.productId))];

    // [FIX 1] Thêm shop vào select để lấy thông tin cửa hàng
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        price: true,
        images: true,
        stock: true,
        slug: true,
        // Thêm phần này:
        shop: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    const productMap = new Map(products.map(p => [p.id, p]));

    // [round15 FIX cart-variant] Map theo từng field (1 dòng cart = 1 variant), không gộp
    // theo product nữa. Bỏ qua field mà product không còn tồn tại (dọn orphan bên dưới).
    const items = parsed
      .filter(entry => productMap.has(entry.productId))
      .map(entry => {
        const p = productMap.get(entry.productId)!;
        const quantity = parseInt(cartItemsRaw[entry.field]);
        const images = p.images as any[];
        return {
          // id = composite field để FE gọi DELETE/PATCH :itemId trúng đúng variant này.
          id: entry.field,
          productId: p.id,
          productVariantId: entry.variantId,
          title: p.name,
          imageUrl: Array.isArray(images) ? (images[0]?.url || images[0]) : '',
          price: Number(p.price),
          quantity: quantity,
          stock: p.stock,
          totalPrice: Number(p.price) * quantity,
          // [FIX 2] Map thông tin shop ra ngoài object
          shopId: p.shop?.id || 'unknown-shop',
          shopName: p.shop?.name || 'Cửa hàng'
        };
      });

    // Audit Buyer Cart/Checkout #22 wiki 0062: Redis-DB drift cleanup.
    // Nếu Redis có productId nhưng DB không tìm thấy (SP bị xóa) → orphan.
    // Tự dọn trong Redis để lần sau getCart() không phải skip nữa, và để
    // count "totalItems" của FE khớp với data thực tế.
    // [round15 FIX cart-variant] Dọn theo composite field (mỗi orphan variant 1 field).
    const orphans = parsed
      .filter(entry => !productMap.has(entry.productId))
      .map(entry => entry.field);
    if (orphans.length > 0) {
      try {
        await this.redis.hdel(key, ...orphans);
        this.logger.warn(`[cart-sync] dọn ${orphans.length} SP đã xóa khỏi Redis cart của user ${userId}`);
      } catch (e: any) {
        this.logger.error(`[cart-sync] hdel orphans fail: ${e.message}`);
      }
    }

    const total = items.reduce((sum, item) => sum + item.totalPrice, 0);
    return { items, total };
  }

  // 3. Xóa item (Redis HDEL)
  // [round15 FIX cart-variant] `field` đến từ route param :itemId, là composite field
  // (`productId:variantId`) mà getCart trả ra ở `id`. HDEL trúng đúng 1 variant, không
  // còn xoá tất cả variant của 1 SP.
  // Backward-compat: caller cũ (order.service partial-checkout) truyền BARE productId (không
  // có ':'), và data Redis legacy cũng lưu bare productId. Nếu HDEL theo field literal không
  // xoá được gì VÀ field không phải composite (không có ':') → coi như xoá theo productId:
  // gỡ tất cả field thuộc productId đó (mọi variant). Đảm bảo đơn đặt xong vẫn dọn sạch cart.
  async removeItem(userId: string, field: string) {
    const key = this.getCartKey(userId);
    const removed = await this.redis.hdel(key, field);
    if (removed === 0 && !field.includes(':')) {
      const all = await this.redis.hgetall(key);
      const matches = Object.keys(all).filter(
        f => this.parseCartField(f).productId === field,
      );
      if (matches.length > 0) {
        await this.redis.hdel(key, ...matches);
      }
    }
    return { success: true };
  }

  // 4. Update số lượng
  // [round15 FIX cart-variant] `field` là composite hash field từ getCart (`id`). HEXISTS/HSET
  // tác động đúng 1 variant; DB lookup tồn kho dùng productId đã parse ra từ field.
  async updateQuantity(userId: string, field: string, quantity: number) {
    if (quantity <= 0) return this.removeItem(userId, field);
    // Fix B-NEW-2 (wiki 0023): chỉ update nếu item đã tồn tại trong cart.
    // Trước đây hset blind -> ghost item silent insert.
    const key = this.getCartKey(userId);
    const exists = await this.redis.hexists(key, field);
    if (!exists) {
      throw new NotFoundException('Item không tồn tại trong giỏ hàng');
    }
    // [round15 FIX cart-variant] Tách productId thực ra khỏi composite field để query tồn kho.
    const { productId, variantId } = this.parseCartField(field);
    // Reject nếu số lượng yêu cầu vượt quá tồn kho.
    // [round15 L2 FIX] Lấy kèm variants để guard ĐÚNG cấp tồn kho (variant authoritative khi có
    // variantId). Khớp variant theo id HOẶC sku; không thấy → fallback product.stock.
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        stock: true,
        variants: { select: { id: true, sku: true, stock: true } },
      },
    });
    if (!product) {
      throw new NotFoundException('Sản phẩm không tồn tại');
    }
    const guardStock = this.resolveGuardStock(product, variantId);
    if (quantity > guardStock) {
      throw new BadRequestException('Vượt quá tồn kho');
    }
    await this.redis.hset(key, field, quantity);
    return { success: true };
  }

  // 5. Đồng bộ xuống DB
  // [round15 L2 FIX] DEAD CODE — không có caller nào trong src (grep xác nhận chỉ còn định nghĩa
  // này). Comment cũ ('Dùng khi Checkout hoặc Logout') là STALE/sai: checkout đọc cart từ Redis
  // (getCart) hoặc dto.items, KHÔNG đọc lại bảng CartItem; logout cũng không gọi hàm này. Ngoài ra
  // nó VARIANT-LOSSY: bảng CartItem unique theo (cartId, productId) — không có cột variant (KHÔNG
  // đổi schema theo yêu cầu round15) — nên gom mọi variant của 1 SP về 1 dòng, mất phân biệt variant.
  // Giữ lại (không xoá) phòng khi cần persist cart xuống DB sau này, NHƯNG nếu wire-up thật phải
  // thêm cột variant vào CartItem trước, nếu không multi-variant sẽ bị collapse.
  async syncToDatabase(userId: string) {
    const redisCart = await this.redis.hgetall(this.getCartKey(userId));
    if (Object.keys(redisCart).length === 0) return;

    // [round15 FIX cart-variant] Field Redis giờ là composite `productId:variantId`. Bảng
    // cartItem chỉ unique theo (cartId, productId) (không có cột variant — không đổi schema),
    // nên gom số lượng theo productId TRƯỚC khi upsert để nhiều variant của cùng SP không
    // ghi đè lẫn nhau (mỗi upsert sẽ set lại quantity → variant cuối thắng). Backward-compat:
    // legacy field (bare productId) parse ra productId thuần.
    const qtyByProduct = new Map<string, number>();
    for (const [field, qty] of Object.entries(redisCart)) {
        const { productId } = this.parseCartField(field);
        const quantity = parseInt(qty);
        if (!Number.isFinite(quantity) || quantity <= 0) continue;
        qtyByProduct.set(productId, (qtyByProduct.get(productId) || 0) + quantity);
    }

    // Sử dụng Transaction của Prisma để insert hàng loạt
    await this.prisma.$transaction(async (tx) => {
        // Tìm hoặc tạo Cart trong DB
        let cart = await tx.cart.findUnique({ where: { userId } });
        if (!cart) cart = await tx.cart.create({ data: { userId } });

        // Loop qua các item (đã gom theo productId) và upsert vào DB
        for (const [productId, quantity] of qtyByProduct.entries()) {
            await tx.cartItem.upsert({
                where: { cartId_productId: { cartId: cart.id, productId } },
                update: { quantity },
                create: { cartId: cart.id, productId, quantity }
            });
        }
    });
    
    // (Tuỳ chọn) Xóa cart trên Redis sau khi sync xong
    // await this.redis.del(this.getCartKey(userId));
  }
  async clearCart(userId: string) {
    const key = this.getCartKey(userId);
    // Xóa key trong Redis -> Thao tác Atomic, rất nhanh
    await this.redis.del(key);
    return { success: true };
  }
}