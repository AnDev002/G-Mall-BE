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
exports.FlashSaleService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const client_1 = require("@prisma/client");
let FlashSaleService = class FlashSaleService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    mapSessionStatus(session) {
        const now = new Date();
        let timeStatus = 'UPCOMING';
        if (now >= session.startTime && now <= session.endTime) {
            timeStatus = 'ONGOING';
        }
        else if (now > session.endTime) {
            timeStatus = 'ENDED';
        }
        return {
            ...session,
            timeStatus,
        };
    }
    async getRegisteredProducts(sellerId, sessionId) {
        return this.prisma.flashSaleProduct.findMany({
            where: {
                sessionId: sessionId,
                product: {
                    shopId: sellerId
                }
            },
            include: {
                product: true,
                variant: true,
            }
        });
    }
    async findAvailableSessionsForSeller() {
        const now = new Date();
        return this.prisma.flashSaleSession.findMany({
            where: {
                status: 'ENABLED',
                endTime: { gt: now },
            },
            orderBy: { startTime: 'asc' },
            include: {
                _count: { select: { products: true } }
            }
        });
    }
    async getCurrentFlashSaleForBuyer() {
        const now = new Date();
        console.log("🕒 [FlashSale] Server Time (ISO):", now.toISOString());
        console.log("🕒 [FlashSale] Server Time (Local):", now.toLocaleString());
        const activeSessions = await this.prisma.flashSaleSession.findMany({
            where: {
                status: 'ENABLED',
                startTime: { lte: now },
                endTime: { gt: now },
            },
            orderBy: { endTime: 'asc' },
            include: {
                products: {
                    where: {
                        status: client_1.FlashSaleProductStatus.APPROVED,
                    },
                    orderBy: { sold: 'desc' },
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                images: true,
                                slug: true,
                                rating: true,
                                salesCount: true,
                                status: true,
                            }
                        },
                        variant: {
                            select: { id: true, sku: true }
                        }
                    }
                }
            }
        });
        console.log(`🔎 [FlashSale] Found ${activeSessions.length} active sessions via time query.`);
        const validSession = activeSessions.find(s => {
            if (!s.products || s.products.length === 0) {
                console.log(`   ⚠️ Session ${s.id}: No products registered or approved.`);
                return false;
            }
            const validProducts = s.products.filter(p => {
                const isProductActive = p.product.status === 'ACTIVE';
                const remaining = p.stock - p.sold;
                const hasStock = remaining > 0;
                if (!isProductActive)
                    console.log(`   ❌ Product ${p.productId} ignored: Parent Status is ${p.product.status}`);
                if (!hasStock)
                    console.log(`   ❌ Product ${p.productId} ignored: Sold out (stock=${p.stock}, sold=${p.sold}, remaining=${remaining})`);
                return isProductActive && hasStock;
            });
            s.products = validProducts.slice(0, 12);
            return validProducts.length > 0;
        });
        if (!validSession) {
            console.log(`❌ [FlashSale] No valid session with active products found for Buyer.`);
            return null;
        }
        console.log(`✅ [FlashSale] Returning Session ${validSession.id} with ${validSession.products.length} products.`);
        const mappedSession = {
            ...this.mapSessionStatus(validSession),
            products: validSession.products.map((item) => ({
                ...item,
                remaining: item.stock - item.sold,
                isSoldOut: item.stock - item.sold <= 0,
                product: {
                    ...item.product,
                    thumbnail: item.product.images && item.product.images.length > 0
                        ? item.product.images[0]
                        : null
                }
            }))
        };
        return mappedSession;
    }
    async registerProducts(sellerId, dto) {
        const { sessionId, items } = dto;
        console.log(`[DEBUG] Registering for Session: ${sessionId}, Seller: ${sellerId}`);
        const session = await this.prisma.flashSaleSession.findUnique({
            where: { id: sessionId }
        });
        if (!session)
            throw new common_1.NotFoundException('Session not found');
        if (session.status !== 'ENABLED' || session.endTime <= new Date()) {
            throw new common_1.BadRequestException('Session is not available for registration (disabled or ended)');
        }
        const results = [];
        for (const item of items) {
            console.log(`[DEBUG] Processing Item: ${item.productId} (Sent VariantId: ${item.variantId})`);
            let originalPrice = 0;
            let dbStock = 0;
            let finalVariantId = item.variantId;
            const variant = await this.prisma.productVariant.findFirst({
                where: {
                    id: item.variantId,
                    productId: item.productId,
                    product: { shopId: sellerId }
                },
                include: { product: true }
            });
            if (variant) {
                console.log(`   -> Found Variant Directly. Price: ${variant.price}`);
                originalPrice = Number(variant.price);
                dbStock = variant.stock;
                finalVariantId = variant.id;
            }
            else {
                console.log(`   -> Variant ID not found. Checking Product table...`);
                const product = await this.prisma.product.findFirst({
                    where: {
                        id: item.productId,
                        shopId: sellerId
                    }
                });
                if (!product) {
                    console.log(`   -> SKIPPED: Product not found or not owned by seller.`);
                    continue;
                }
                const defaultVariant = await this.prisma.productVariant.findFirst({
                    where: { productId: product.id }
                });
                if (defaultVariant) {
                    console.log(`   -> Found Default Variant for Product. ID: ${defaultVariant.id}`);
                    finalVariantId = defaultVariant.id;
                    originalPrice = Number(defaultVariant.price);
                    dbStock = defaultVariant.stock;
                }
                else {
                    console.log(`   -> WARN: Product has no variants in DB. Using Product Price.`);
                    originalPrice = Number(product.price);
                    dbStock = product.stock;
                }
            }
            const promoPrice = Number(item.promoPrice);
            if (promoPrice >= originalPrice) {
                console.log(`   -> SKIPPED: Promo Price (${promoPrice}) >= Original Price (${originalPrice})`);
                continue;
            }
            const promoStock = Number(item.promoStock);
            if (promoStock > dbStock) {
                console.log(`   -> SKIPPED: Promo Stock (${promoStock}) > Available Stock (${dbStock})`);
                continue;
            }
            try {
                const record = await this.prisma.flashSaleProduct.upsert({
                    where: {
                        sessionId_variantId: {
                            sessionId,
                            variantId: finalVariantId
                        }
                    },
                    update: {
                        salePrice: promoPrice,
                        stock: promoStock,
                        status: client_1.FlashSaleProductStatus.APPROVED,
                    },
                    create: {
                        sessionId,
                        productId: item.productId,
                        variantId: finalVariantId,
                        originalPrice: originalPrice,
                        salePrice: promoPrice,
                        stock: promoStock,
                        sold: 0,
                        status: client_1.FlashSaleProductStatus.APPROVED,
                    }
                });
                results.push(record);
                console.log(`   -> SUCCESS: Registered.`);
            }
            catch (error) {
                console.error(`   -> ERROR DB for Item ${item.productId}:`, error);
            }
        }
        console.log(`[DEBUG] Completed. Total Registered: ${results.length}`);
        return { success: true, registeredCount: results.length };
    }
    async registerProductsToFlashSale(user, dto) {
        const { sessionId, items } = dto;
        let registeredCount = 0;
        const errors = [];
        const session = await this.prisma.flashSaleSession.findUnique({
            where: { id: sessionId },
        });
        if (!session)
            throw new common_1.NotFoundException('Session not found');
        for (const item of items) {
            console.log(`Processing Item: Product ${item.productId} - Variant ${item.variantId}`);
            const variant = await this.prisma.productVariant.findUnique({
                where: { id: item.variantId },
                include: { product: true }
            });
            if (!variant) {
                console.error(`--> FAILED: Variant not found for ID ${item.variantId}`);
                continue;
            }
            if (variant.product.sellerId !== user.id) {
                console.error(`--> FAILED: Seller ${user.id} does not own product`);
                continue;
            }
            if (variant.stock <= 0) {
                console.error(`--> FAILED: Out of stock`);
                continue;
            }
            registeredCount++;
        }
        return {
            success: true,
            registeredCount,
            errors
        };
    }
    async createSession(dto) {
        const start = new Date(dto.startTime);
        const end = new Date(dto.endTime);
        if (end <= start) {
            throw new common_1.BadRequestException('EndTime must be greater than StartTime');
        }
        const overlapped = await this.prisma.flashSaleSession.findFirst({
            where: {
                status: 'ENABLED',
                AND: [
                    { startTime: { lt: end } },
                    { endTime: { gt: start } },
                ],
            },
        });
        if (overlapped) {
            throw new common_1.BadRequestException(`Time slot overlaps with existing session ID: ${overlapped.id}`);
        }
        const session = await this.prisma.flashSaleSession.create({
            data: {
                startTime: start,
                endTime: end,
                status: dto.status || 'ENABLED',
            },
        });
        return this.mapSessionStatus(session);
    }
    async findAll(date) {
        const whereCondition = {};
        if (date) {
            const searchDate = new Date(date);
            const nextDay = new Date(searchDate);
            nextDay.setDate(searchDate.getDate() + 1);
            whereCondition.startTime = {
                gte: searchDate,
                lt: nextDay,
            };
        }
        const sessions = await this.prisma.flashSaleSession.findMany({
            where: whereCondition,
            orderBy: { startTime: 'desc' },
            include: {
                _count: {
                    select: { products: true },
                },
            },
        });
        return sessions.map((s) => this.mapSessionStatus(s));
    }
    async update(id, dto) {
        const session = await this.prisma.flashSaleSession.findUnique({ where: { id } });
        if (!session)
            throw new common_1.NotFoundException('Flash Sale Session not found');
        const start = dto.startTime ? new Date(dto.startTime) : session.startTime;
        const end = dto.endTime ? new Date(dto.endTime) : session.endTime;
        if (end <= start) {
            throw new common_1.BadRequestException('EndTime must be greater than StartTime');
        }
        if (dto.startTime || dto.endTime) {
            const overlapped = await this.prisma.flashSaleSession.findFirst({
                where: {
                    id: { not: id },
                    status: 'ENABLED',
                    AND: [
                        { startTime: { lt: end } },
                        { endTime: { gt: start } },
                    ],
                },
            });
            if (overlapped) {
                throw new common_1.BadRequestException('Time slot overlaps with another session');
            }
        }
        const updated = await this.prisma.flashSaleSession.update({
            where: { id },
            data: {
                startTime: dto.startTime ? new Date(dto.startTime) : undefined,
                endTime: dto.endTime ? new Date(dto.endTime) : undefined,
                status: dto.status,
            },
        });
        return this.mapSessionStatus(updated);
    }
    async remove(id) {
        const session = await this.prisma.flashSaleSession.findUnique({
            where: { id },
            include: { _count: { select: { products: true } } },
        });
        if (!session)
            throw new common_1.NotFoundException('Session not found');
        const now = new Date();
        if (session.startTime <= now) {
            throw new common_1.BadRequestException('Cannot delete a session that has already started or ended.');
        }
        if (session._count.products > 0) {
            throw new common_1.BadRequestException('Cannot delete session containing registered products. Remove products first.');
        }
        return this.prisma.flashSaleSession.delete({
            where: { id },
        });
    }
};
exports.FlashSaleService = FlashSaleService;
exports.FlashSaleService = FlashSaleService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FlashSaleService);
//# sourceMappingURL=flash-sale.service.js.map