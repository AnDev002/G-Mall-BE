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
exports.PromotionService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const redis_service_1 = require("../../database/redis/redis.service");
const client_1 = require("@prisma/client");
let PromotionService = class PromotionService {
    prisma;
    redisService;
    constructor(prisma, redisService) {
        this.prisma = prisma;
        this.redisService = redisService;
    }
    async calculateMultiShopVouchers(voucherIds, shopGroups) {
        if (!voucherIds || voucherIds.length === 0) {
            return {
                shopDiscounts: {},
                systemDiscount: 0,
                freeshipDiscount: 0,
                appliedVouchers: []
            };
        }
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
        {
            const globalCount = vouchers.filter(v => v.scope === client_1.VoucherScope.GLOBAL && v.type !== client_1.VoucherType.FREESHIP).length;
            if (globalCount > 1) {
                throw new common_1.BadRequestException('Mỗi đơn chỉ áp dụng tối đa 1 voucher của sàn');
            }
            const freeshipCount = vouchers.filter(v => v.type === client_1.VoucherType.FREESHIP).length;
            if (freeshipCount > 1) {
                throw new common_1.BadRequestException('Mỗi đơn chỉ áp dụng tối đa 1 voucher freeship');
            }
            const shopVoucherCount = {};
            for (const v of vouchers) {
                const isShopScope = (v.scope === client_1.VoucherScope.SHOP || v.scope === client_1.VoucherScope.PRODUCT || v.scope === client_1.VoucherScope.CATEGORY)
                    && v.type !== client_1.VoucherType.FREESHIP
                    && v.shopId;
                if (!isShopScope)
                    continue;
                const sid = v.shopId;
                shopVoucherCount[sid] = (shopVoucherCount[sid] || 0) + 1;
                if (shopVoucherCount[sid] > 1) {
                    throw new common_1.BadRequestException('Mỗi shop chỉ áp dụng tối đa 1 voucher');
                }
            }
        }
        const appliedVouchers = [];
        const shopDiscounts = {};
        let systemDiscount = 0;
        const shopVouchers = vouchers.filter((v) => v.type !== client_1.VoucherType.FREESHIP &&
            (v.scope === client_1.VoucherScope.SHOP ||
                v.scope === client_1.VoucherScope.PRODUCT ||
                v.scope === client_1.VoucherScope.CATEGORY));
        const systemVouchers = vouchers.filter(v => v.scope === client_1.VoucherScope.GLOBAL && v.type !== client_1.VoucherType.FREESHIP);
        for (const voucher of shopVouchers) {
            const targetShopId = voucher.shopId;
            if (!targetShopId || !shopGroups[targetShopId])
                continue;
            const group = shopGroups[targetShopId];
            let eligibleAmount = 0;
            if (voucher.scope === client_1.VoucherScope.PRODUCT) {
                const validProductIds = voucher.products.map(p => p.id);
                eligibleAmount = group.items
                    .filter((i) => validProductIds.includes(i.productId))
                    .reduce((sum, i) => sum + i.subtotal, 0);
            }
            else if (voucher.scope === client_1.VoucherScope.CATEGORY) {
                const validCatIds = voucher.categories?.map((c) => c.id) ?? [];
                eligibleAmount = group.items
                    .filter((i) => i.categoryId && validCatIds.includes(i.categoryId))
                    .reduce((sum, i) => sum + i.subtotal, 0);
            }
            else {
                eligibleAmount = group.subtotal;
            }
            if (eligibleAmount < Number(voucher.minOrderValue))
                continue;
            let discount = 0;
            if (voucher.type === client_1.VoucherType.FIXED_AMOUNT) {
                discount = Number(voucher.amount);
            }
            else {
                discount = (eligibleAmount * Number(voucher.amount)) / 100;
                if (voucher.maxDiscount)
                    discount = Math.min(discount, Number(voucher.maxDiscount));
            }
            discount = Math.max(0, Math.min(discount, eligibleAmount));
            shopDiscounts[targetShopId] = (shopDiscounts[targetShopId] || 0) + discount;
            appliedVouchers.push({
                ...voucher,
                appliedAmount: discount,
                shopId: targetShopId,
                isSystem: false
            });
        }
        let totalAfterShopDiscount = 0;
        Object.keys(shopGroups).forEach(shopId => {
            const originalSub = shopGroups[shopId].subtotal;
            const shopDisc = shopDiscounts[shopId] || 0;
            totalAfterShopDiscount += Math.max(0, originalSub - shopDisc);
        });
        for (const voucher of systemVouchers) {
            if (totalAfterShopDiscount < Number(voucher.minOrderValue))
                continue;
            let discount = 0;
            if (voucher.type === client_1.VoucherType.FIXED_AMOUNT) {
                discount = Number(voucher.amount);
            }
            else {
                discount = (totalAfterShopDiscount * Number(voucher.amount)) / 100;
                if (voucher.maxDiscount)
                    discount = Math.min(discount, Number(voucher.maxDiscount));
            }
            systemDiscount += discount;
            appliedVouchers.push({
                ...voucher,
                appliedAmount: discount,
                isSystem: true
            });
        }
        if (systemDiscount > totalAfterShopDiscount)
            systemDiscount = totalAfterShopDiscount;
        const freeshipVouchers = vouchers.filter((v) => v.type === client_1.VoucherType.FREESHIP);
        let freeshipDiscount = 0;
        for (const voucher of freeshipVouchers) {
            const amt = Number(voucher.amount) || 0;
            freeshipDiscount += amt;
            appliedVouchers.push({
                ...voucher,
                appliedAmount: amt,
                isSystem: voucher.scope === client_1.VoucherScope.GLOBAL,
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
    async validateAndCalculateVouchers(voucherIds, orderTotal, items) {
        if (!voucherIds || voucherIds.length === 0) {
            return { totalDiscount: 0, appliedVouchers: [] };
        }
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
        const productIds = items.map(i => i.productId);
        const dbProducts = await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, categoryId: true }
        });
        let totalDiscount = 0;
        const appliedVouchers = [];
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
                const validItems = items.filter(item => {
                    const productInfo = dbProducts.find(p => p.id === item.productId);
                    return productInfo && productInfo.categoryId && validCatIds.includes(productInfo.categoryId);
                });
                eligibleTotal = validItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
            }
            if (eligibleTotal < Number(voucher.minOrderValue))
                continue;
            let amount = 0;
            if (voucher.type === 'FIXED_AMOUNT') {
                amount = Number(voucher.amount);
            }
            else if (voucher.type === 'PERCENTAGE') {
                amount = (eligibleTotal * Number(voucher.amount)) / 100;
                if (voucher.maxDiscount) {
                    amount = Math.min(amount, Number(voucher.maxDiscount));
                }
            }
            totalDiscount += amount;
            appliedVouchers.push(voucher);
        }
        if (totalDiscount > orderTotal)
            totalDiscount = orderTotal;
        return { totalDiscount, appliedVouchers };
    }
    async getPublicSystemVouchers() {
        const now = new Date();
        return this.prisma.voucher.findMany({
            where: {
                scope: client_1.VoucherScope.GLOBAL,
                isActive: true,
                startDate: { lte: now },
                endDate: { gte: now },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async calculateDiscount(dto) {
        const voucherIds = dto.voucherCode ? [dto.voucherCode] : [];
        return this.validateAndCalculateVouchers(voucherIds, dto.total, dto.items || []);
    }
    async createShopVoucher(sellerId, dto) {
        if (new Date(dto.endDate) <= new Date(dto.startDate)) {
            throw new common_1.BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
        }
        const existingVoucher = await this.prisma.voucher.findUnique({
            where: { code: dto.code }
        });
        if (existingVoucher) {
            throw new common_1.BadRequestException(`Mã voucher '${dto.code}' đã tồn tại. Vui lòng chọn mã khác.`);
        }
        if (dto.scope === client_1.VoucherScope.PRODUCT && !dto.productIds?.length) {
            throw new common_1.BadRequestException('Vui lòng chọn sản phẩm');
        }
        if (dto.scope === client_1.VoucherScope.CATEGORY && !dto.categoryIds?.length) {
            throw new common_1.BadRequestException('Vui lòng chọn danh mục');
        }
        const shop = await this.prisma.shop.findUnique({ where: { ownerId: sellerId } });
        if (!shop)
            throw new common_1.BadRequestException('Bạn chưa có shop nên không thể tạo voucher.');
        if (dto.scope === client_1.VoucherScope.PRODUCT && dto.productIds?.length) {
            const ownedCount = await this.prisma.product.count({
                where: { id: { in: dto.productIds }, shopId: shop.id },
            });
            if (ownedCount !== new Set(dto.productIds).size) {
                throw new common_1.BadRequestException('Voucher chỉ được áp cho sản phẩm thuộc shop của bạn.');
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
                    amount: new client_1.Prisma.Decimal(dto.amount),
                    usageLimit: dto.usageLimit,
                    startDate: new Date(dto.startDate),
                    endDate: new Date(dto.endDate),
                    minOrderValue: new client_1.Prisma.Decimal(dto.minOrderValue || 0),
                    maxDiscount: dto.maxDiscount ? new client_1.Prisma.Decimal(dto.maxDiscount) : null,
                    products: dto.scope === client_1.VoucherScope.PRODUCT && dto.productIds ? {
                        connect: dto.productIds.map(id => ({ id }))
                    } : undefined,
                    categories: dto.scope === client_1.VoucherScope.CATEGORY && dto.categoryIds ? {
                        connect: dto.categoryIds.map(id => ({ id }))
                    } : undefined
                }
            });
            return voucher;
        });
    }
    async createSystemVoucher(dto) {
        if (new Date(dto.endDate) <= new Date(dto.startDate)) {
            throw new common_1.BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
        }
        const existingVoucher = await this.prisma.voucher.findUnique({
            where: { code: dto.code }
        });
        if (existingVoucher) {
            throw new common_1.BadRequestException(`Mã voucher '${dto.code}' đã tồn tại.`);
        }
        if (dto.scope === client_1.VoucherScope.PRODUCT && !dto.productIds?.length) {
            throw new common_1.BadRequestException('Vui lòng chọn sản phẩm áp dụng');
        }
        return await this.prisma.$transaction(async (tx) => {
            const voucher = await tx.voucher.create({
                data: {
                    sellerId: null,
                    code: dto.code,
                    name: dto.name,
                    type: dto.type,
                    scope: dto.scope,
                    amount: new client_1.Prisma.Decimal(dto.amount),
                    usageLimit: dto.usageLimit,
                    startDate: new Date(dto.startDate),
                    endDate: new Date(dto.endDate),
                    minOrderValue: new client_1.Prisma.Decimal(dto.minOrderValue || 0),
                    maxDiscount: dto.maxDiscount ? new client_1.Prisma.Decimal(dto.maxDiscount) : null,
                    products: dto.scope === client_1.VoucherScope.PRODUCT && dto.productIds ? {
                        connect: dto.productIds.map(id => ({ id }))
                    } : undefined,
                    categories: dto.scope === client_1.VoucherScope.CATEGORY && dto.categoryIds ? {
                        connect: dto.categoryIds.map(id => ({ id }))
                    } : undefined
                }
            });
            return voucher;
        });
    }
    async claimVoucher(userId, code) {
        const voucher = await this.prisma.voucher.findUnique({ where: { code } });
        if (!voucher)
            throw new common_1.BadRequestException('Voucher không tồn tại');
        const now = new Date();
        if (voucher.endDate < now) {
            throw new common_1.BadRequestException('Voucher đã hết hạn');
        }
        if (voucher.startDate > now) {
            throw new common_1.BadRequestException('Voucher chưa bắt đầu');
        }
        if (!voucher.isActive) {
            throw new common_1.BadRequestException('Voucher đã bị tạm dừng');
        }
        const usersKey = `voucher:${code}:users`;
        const script = `
      if redis.call('SISMEMBER', KEYS[1], ARGV[1]) == 1 then return -2 end
      redis.call('SADD', KEYS[1], ARGV[1])
      return 1
    `;
        const client = this.redisService.getClient();
        const result = await client.eval(script, 1, usersKey, userId);
        if (result === -2)
            throw new common_1.BadRequestException('Bạn đã lưu voucher này rồi');
        await this.prisma.userVoucher.create({
            data: { userId, voucherId: voucher.id }
        }).catch(() => { });
        return { message: 'Lưu voucher thành công!' };
    }
    async getShopVouchers(sellerId) {
        return this.prisma.voucher.findMany({
            where: { sellerId },
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { userVouchers: true, orders: true } } }
        });
    }
    async getMyVouchers(userId) {
        const userVouchers = await this.prisma.userVoucher.findMany({
            where: { userId, isUsed: false },
            include: { voucher: true },
            orderBy: { createdAt: 'desc' }
        });
        return userVouchers.map(uv => ({ ...uv.voucher, savedAt: uv.createdAt, userVoucherId: uv.id }));
    }
    async getSystemVouchers() {
        return this.prisma.voucher.findMany({
            where: { scope: client_1.VoucherScope.GLOBAL },
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { userVouchers: true, orders: true } } }
        });
    }
    async getAllVouchers(filter) {
        const where = {};
        if (filter.scope)
            where.scope = filter.scope;
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
};
exports.PromotionService = PromotionService;
exports.PromotionService = PromotionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService])
], PromotionService);
//# sourceMappingURL=promotion.service.js.map