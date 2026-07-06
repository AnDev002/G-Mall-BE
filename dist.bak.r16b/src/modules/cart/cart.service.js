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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var CartService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CartService = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = require("ioredis");
const redis_constants_1 = require("../../database/redis/redis.constants");
const prisma_service_1 = require("../../database/prisma/prisma.service");
let CartService = CartService_1 = class CartService {
    redis;
    prisma;
    logger = new common_1.Logger(CartService_1.name);
    constructor(redis, prisma) {
        this.redis = redis;
        this.prisma = prisma;
    }
    getCartKey(userId) {
        return `cart:${userId}`;
    }
    buildCartField(productId, variantId) {
        return variantId ? `${productId}:${variantId}` : productId;
    }
    parseCartField(field) {
        const idx = field.indexOf(':');
        if (idx === -1) {
            return { productId: field, variantId: null };
        }
        const productId = field.slice(0, idx);
        const variantPart = field.slice(idx + 1);
        return { productId, variantId: variantPart === '' ? null : variantPart };
    }
    resolveGuardStock(product, variantId) {
        if (!variantId)
            return product.stock;
        const variant = product.variants.find(v => v.id === variantId || v.sku === variantId);
        return variant ? variant.stock : product.stock;
    }
    async acquireStock(productId, quantity) {
        const key = `product:stock:${productId}`;
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
            return false;
        }
        return result === 1;
    }
    async releaseStock(productId, quantity) {
        await this.redis.incrby(`product:stock:${productId}`, quantity);
    }
    async addToCart(userId, dto) {
        const exists = await this.prisma.product.findUnique({
            where: { id: dto.productId },
            select: {
                id: true,
                stock: true,
                variants: { select: { id: true, sku: true, stock: true } },
            },
        });
        if (!exists) {
            throw new common_1.NotFoundException('Sản phẩm không tồn tại');
        }
        const key = this.getCartKey(userId);
        const field = this.buildCartField(dto.productId, dto.productVariantId);
        const currentRaw = await this.redis.hget(key, field);
        const currentQty = Number(currentRaw) || 0;
        const guardStock = this.resolveGuardStock(exists, dto.productVariantId);
        if (currentQty + dto.quantity > guardStock) {
            throw new common_1.BadRequestException('Vượt quá tồn kho');
        }
        await this.redis.hincrby(key, field, dto.quantity);
        await this.redis.expire(key, 60 * 60 * 24 * 7);
        return { message: 'Đã cập nhật giỏ hàng (Redis Cache)' };
    }
    async getCart(userId) {
        const key = this.getCartKey(userId);
        const cartItemsRaw = await this.redis.hgetall(key);
        const fields = Object.keys(cartItemsRaw);
        if (fields.length === 0) {
            return { items: [], total: 0 };
        }
        const parsed = fields.map(f => ({ field: f, ...this.parseCartField(f) }));
        const productIds = [...new Set(parsed.map(p => p.productId))];
        const products = await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: {
                id: true,
                name: true,
                price: true,
                images: true,
                stock: true,
                slug: true,
                shop: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });
        const productMap = new Map(products.map(p => [p.id, p]));
        const items = parsed
            .filter(entry => productMap.has(entry.productId))
            .map(entry => {
            const p = productMap.get(entry.productId);
            const quantity = parseInt(cartItemsRaw[entry.field]);
            const images = p.images;
            return {
                id: entry.field,
                productId: p.id,
                productVariantId: entry.variantId,
                title: p.name,
                imageUrl: Array.isArray(images) ? (images[0]?.url || images[0]) : '',
                price: Number(p.price),
                quantity: quantity,
                stock: p.stock,
                totalPrice: Number(p.price) * quantity,
                shopId: p.shop?.id || 'unknown-shop',
                shopName: p.shop?.name || 'Cửa hàng'
            };
        });
        const orphans = parsed
            .filter(entry => !productMap.has(entry.productId))
            .map(entry => entry.field);
        if (orphans.length > 0) {
            try {
                await this.redis.hdel(key, ...orphans);
                this.logger.warn(`[cart-sync] dọn ${orphans.length} SP đã xóa khỏi Redis cart của user ${userId}`);
            }
            catch (e) {
                this.logger.error(`[cart-sync] hdel orphans fail: ${e.message}`);
            }
        }
        const total = items.reduce((sum, item) => sum + item.totalPrice, 0);
        return { items, total };
    }
    async removeItem(userId, field) {
        const key = this.getCartKey(userId);
        const removed = await this.redis.hdel(key, field);
        if (removed === 0 && !field.includes(':')) {
            const all = await this.redis.hgetall(key);
            const matches = Object.keys(all).filter(f => this.parseCartField(f).productId === field);
            if (matches.length > 0) {
                await this.redis.hdel(key, ...matches);
            }
        }
        return { success: true };
    }
    async updateQuantity(userId, field, quantity) {
        if (quantity <= 0)
            return this.removeItem(userId, field);
        const key = this.getCartKey(userId);
        const exists = await this.redis.hexists(key, field);
        if (!exists) {
            throw new common_1.NotFoundException('Item không tồn tại trong giỏ hàng');
        }
        const { productId, variantId } = this.parseCartField(field);
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
            select: {
                stock: true,
                variants: { select: { id: true, sku: true, stock: true } },
            },
        });
        if (!product) {
            throw new common_1.NotFoundException('Sản phẩm không tồn tại');
        }
        const guardStock = this.resolveGuardStock(product, variantId);
        if (quantity > guardStock) {
            throw new common_1.BadRequestException('Vượt quá tồn kho');
        }
        await this.redis.hset(key, field, quantity);
        return { success: true };
    }
    async syncToDatabase(userId) {
        const redisCart = await this.redis.hgetall(this.getCartKey(userId));
        if (Object.keys(redisCart).length === 0)
            return;
        const qtyByProduct = new Map();
        for (const [field, qty] of Object.entries(redisCart)) {
            const { productId } = this.parseCartField(field);
            const quantity = parseInt(qty);
            if (!Number.isFinite(quantity) || quantity <= 0)
                continue;
            qtyByProduct.set(productId, (qtyByProduct.get(productId) || 0) + quantity);
        }
        await this.prisma.$transaction(async (tx) => {
            let cart = await tx.cart.findUnique({ where: { userId } });
            if (!cart)
                cart = await tx.cart.create({ data: { userId } });
            for (const [productId, quantity] of qtyByProduct.entries()) {
                await tx.cartItem.upsert({
                    where: { cartId_productId: { cartId: cart.id, productId } },
                    update: { quantity },
                    create: { cartId: cart.id, productId, quantity }
                });
            }
        });
    }
    async clearCart(userId) {
        const key = this.getCartKey(userId);
        await this.redis.del(key);
        return { success: true };
    }
};
exports.CartService = CartService;
exports.CartService = CartService = CartService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_constants_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [ioredis_1.Redis,
        prisma_service_1.PrismaService])
], CartService);
//# sourceMappingURL=cart.service.js.map