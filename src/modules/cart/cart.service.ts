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
    const exists = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { id: true, stock: true },
    });
    if (!exists) {
      throw new NotFoundException('Sản phẩm không tồn tại');
    }

    const key = this.getCartKey(userId);
    // Reject nếu tổng số lượng (đã có trong cart + thêm mới) vượt quá tồn kho.
    const currentRaw = await this.redis.hget(key, dto.productId);
    // Fix #10 (Wiki 0086): coerce qty hiện tại bằng Number(...)||0.
    // Trước đây parseInt(rác phi-số) -> NaN; mà NaN + quantity > stock luôn = false
    // -> guard tồn kho bị bypass khi data Redis bị hỏng/phi-số. Number(...)||0 ép NaN về 0.
    const currentQty = Number(currentRaw) || 0;
    if (currentQty + dto.quantity > exists.stock) {
      throw new BadRequestException('Vượt quá tồn kho');
    }

    // HINCRBY: Tăng số lượng item trong hash. Nếu chưa có tự tạo mới.
    // Thao tác này là Atomic trên Redis.
    await this.redis.hincrby(key, dto.productId, dto.quantity);

    // Set TTL (Time to live) cho giỏ hàng (ví dụ 7 ngày) để tự dọn dẹp rác
    await this.redis.expire(key, 60 * 60 * 24 * 7);

    return { message: 'Đã cập nhật giỏ hàng (Redis Cache)' };
  }

  // 2. Lấy giỏ hàng (Gộp data từ Redis + Info sản phẩm từ DB)
  async getCart(userId: string) {
    const key = this.getCartKey(userId);
    
    const cartItemsRaw = await this.redis.hgetall(key);
    const productIds = Object.keys(cartItemsRaw);

    if (productIds.length === 0) {
      return { items: [], total: 0 };
    }

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

    // Map lại dữ liệu để trả về FE
    const items = products.map(p => {
      const quantity = parseInt(cartItemsRaw[p.id]);
      const images = p.images as any[];
      return {
        id: p.id,
        productId: p.id,
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
    const foundIds = new Set(products.map(p => p.id));
    const orphans = productIds.filter(id => !foundIds.has(id));
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
  async removeItem(userId: string, productId: string) {
    await this.redis.hdel(this.getCartKey(userId), productId);
    return { success: true };
  }

  // 4. Update số lượng
  async updateQuantity(userId: string, productId: string, quantity: number) {
    if (quantity <= 0) return this.removeItem(userId, productId);
    // Fix B-NEW-2 (wiki 0023): chỉ update nếu item đã tồn tại trong cart.
    // Trước đây hset blind -> ghost item silent insert.
    const key = this.getCartKey(userId);
    const exists = await this.redis.hexists(key, productId);
    if (!exists) {
      throw new NotFoundException('Item không tồn tại trong giỏ hàng');
    }
    // Reject nếu số lượng yêu cầu vượt quá tồn kho.
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { stock: true },
    });
    if (!product) {
      throw new NotFoundException('Sản phẩm không tồn tại');
    }
    if (quantity > product.stock) {
      throw new BadRequestException('Vượt quá tồn kho');
    }
    await this.redis.hset(key, productId, quantity);
    return { success: true };
  }

  // 5. Đồng bộ xuống DB (Dùng khi Checkout hoặc Logout)
  async syncToDatabase(userId: string) {
    const redisCart = await this.redis.hgetall(this.getCartKey(userId));
    if (Object.keys(redisCart).length === 0) return;

    // Sử dụng Transaction của Prisma để insert hàng loạt
    await this.prisma.$transaction(async (tx) => {
        // Tìm hoặc tạo Cart trong DB
        let cart = await tx.cart.findUnique({ where: { userId } });
        if (!cart) cart = await tx.cart.create({ data: { userId } });

        // Loop qua các item trong Redis và upsert vào DB
        for (const [productId, qty] of Object.entries(redisCart)) {
            const quantity = parseInt(qty);
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