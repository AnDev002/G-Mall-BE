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
var OrderService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const pagination_util_1 = require("../../common/utils/pagination.util");
const cart_service_1 = require("../../modules/cart/cart.service");
const promotion_service_1 = require("../../modules/promotion/promotion.service");
const tracking_service_1 = require("../../modules/tracking/tracking.service");
const track_event_dto_1 = require("../../modules/tracking/dto/track-event.dto");
const point_service_1 = require("../../modules/point/point.service");
const client_1 = require("@prisma/client");
const ghn_service_1 = require("../../modules/ghn/ghn.service");
const payment_service_1 = require("../payment/payment.service");
const charity_service_1 = require("../charity/charity.service");
const system_setting_service_1 = require("../../common/services/system-setting.service");
const notification_service_1 = require("../notification/notification.service");
const GIFT_WRAP_PRICES = [30000, 50000];
const CARD_PRICES = [0, 5000, 15000];
let OrderService = OrderService_1 = class OrderService {
    prisma;
    cartService;
    promotionService;
    trackingService;
    pointService;
    ghnService;
    paymentService;
    charityService;
    systemSetting;
    notificationService;
    logger = new common_1.Logger(OrderService_1.name);
    constructor(prisma, cartService, promotionService, trackingService, pointService, ghnService, paymentService, charityService, systemSetting, notificationService) {
        this.prisma = prisma;
        this.cartService = cartService;
        this.promotionService = promotionService;
        this.trackingService = trackingService;
        this.pointService = pointService;
        this.ghnService = ghnService;
        this.paymentService = paymentService;
        this.charityService = charityService;
        this.systemSetting = systemSetting;
        this.notificationService = notificationService;
    }
    async resolveItemsAndGroup(userId, dto) {
        let itemsToCheckout = [];
        if (dto.items && dto.items.length > 0) {
            itemsToCheckout = dto.items;
        }
        else if (!dto.isBuyNow) {
            const cart = await this.cartService.getCart(userId);
            if (cart?.items) {
                itemsToCheckout = cart.items.map(i => {
                    const itemAny = i;
                    return {
                        productId: i.productId,
                        quantity: i.quantity,
                        variantId: itemAny.productVariantId || itemAny.variantId
                    };
                });
            }
        }
        if (!itemsToCheckout.length)
            throw new common_1.BadRequestException('Giỏ hàng trống hoặc chưa chọn sản phẩm');
        const productIds = itemsToCheckout.map(i => i.productId);
        const products = await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: {
                id: true, name: true, price: true, originalPrice: true,
                stock: true, weight: true, images: true, variants: true,
                status: true,
                categoryId: true,
                shopId: true, shop: { select: { id: true, name: true, districtId: true, wardCode: true } }
            }
        });
        const shopGroups = {};
        for (const item of itemsToCheckout) {
            const product = products.find(p => p.id === item.productId);
            if (!product)
                throw new common_1.NotFoundException(`Sản phẩm ID ${item.productId} không tồn tại`);
            if (product.status !== 'ACTIVE')
                throw new common_1.BadRequestException(`Sản phẩm ${product.name} hiện không khả dụng`);
            if (product.stock < item.quantity)
                throw new common_1.BadRequestException(`Sản phẩm ${product.name} không đủ hàng`);
            if (!product.shopId)
                throw new common_1.BadRequestException(`Dữ liệu sản phẩm ${product.name} lỗi (thiếu ShopId)`);
            let selectedVariant = null;
            let finalPrice = Number(product.price);
            let flashSaleProductId = null;
            if (item.variantId) {
                selectedVariant = product.variants.find(v => v.id === item.variantId);
                if (!selectedVariant)
                    throw new common_1.BadRequestException(`Phân loại của sản phẩm ${product.name} không hợp lệ.`);
                finalPrice = Number(selectedVariant.price);
                const nowTs = new Date();
                const fsp = await this.prisma.flashSaleProduct.findFirst({
                    where: {
                        variantId: item.variantId,
                        status: 'APPROVED',
                        session: { status: 'ENABLED', startTime: { lte: nowTs }, endTime: { gt: nowTs } },
                    },
                    select: { id: true, salePrice: true, stock: true, sold: true },
                });
                if (fsp && fsp.sold + item.quantity <= fsp.stock) {
                    finalPrice = Number(fsp.salePrice);
                    flashSaleProductId = fsp.id;
                }
            }
            const productImages = product.images;
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
                categoryId: product.categoryId,
                flashSaleProductId,
            });
            shopGroups[product.shopId].subtotal += lineTotal;
            shopGroups[product.shopId].weight += (product.weight || 200) * item.quantity;
        }
        return shopGroups;
    }
    async previewOrder(userId, dto) {
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
                    if (fee)
                        shippingFee = fee;
                }
                catch (e) {
                    this.logger.warn(`Lỗi tính ship shop ${group.shopName}: ${e.message}`);
                }
            }
            group.shippingFee = shippingFee;
        }
        const { shopDiscounts, systemDiscount, freeshipDiscount, appliedVouchers } = await this.promotionService.calculateMultiShopVouchers(dto.voucherIds || [], shopGroups);
        let totalSubtotal = 0;
        let totalShipping = 0;
        let totalShopDiscount = 0;
        const breakdown = Object.values(shopGroups).map((group) => {
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
        const freeship = Math.min(Math.max(0, freeshipDiscount || 0), totalShipping);
        const payableBeforeCoins = Math.max(0, totalSubtotal + totalShipping + giftFee - totalShopDiscount - systemDiscount - freeship);
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
                    freeship,
                    coin: coinDiscount
                },
                total: grandTotal
            },
            appliedVouchers
        };
    }
    async createOrder(userId, dto, clientIp = null) {
        const preview = await this.previewOrder(userId, dto);
        const receiver = dto.receiverInfo || {};
        let noteMap = {};
        if (typeof dto.note === 'object') {
            noteMap = dto.note;
        }
        else if (typeof dto.note === 'string') {
            noteMap['ALL'] = dto.note;
        }
        const result = await this.prisma.$transaction(async (tx) => {
            const createdOrders = [];
            const totalOrderValue = preview.summary.subtotal;
            const paymentGroupId = (0, node_crypto_1.randomUUID)();
            if (preview.summary.discounts.coin > 0) {
                const amount = preview.summary.discounts.coin;
                const w = await tx.pointWallet.updateMany({
                    where: { userId, balance: { gte: amount } },
                    data: { balance: { decrement: amount } },
                });
                if (w.count === 0)
                    throw new common_1.BadRequestException('Số dư xu không đủ hoặc vừa thay đổi, vui lòng thử lại.');
                await tx.pointHistory.create({
                    data: { userId, amount: -amount, type: client_1.PointType.SPEND_ORDER, source: 'ORDER', description: 'Thanh toán đơn hàng' }
                });
            }
            for (const voucher of preview.appliedVouchers) {
                const perUserLimit = Number(voucher.userUsageLimit ?? 1) || 1;
                const globalLimit = Number(voucher.usageLimit ?? 0);
                const _vNow = new Date();
                const _vWhere = { id: voucher.id, isActive: true, startDate: { lte: _vNow }, endDate: { gte: _vNow } };
                if (globalLimit > 0)
                    _vWhere.usageCount = { lt: globalLimit };
                const inc = await tx.voucher.updateMany({ where: _vWhere, data: { usageCount: { increment: 1 } } });
                if (inc.count === 0)
                    throw new common_1.BadRequestException(`Voucher ${voucher.code || ''} không còn hiệu lực hoặc đã hết lượt.`);
                const claimUsed = await tx.userVoucher.updateMany({
                    where: { userId, voucherId: voucher.id, isUsed: false },
                    data: { isUsed: true, usedAt: new Date() },
                });
                if (claimUsed.count === 0) {
                    const usedByUser = await tx.userVoucher.count({ where: { userId, voucherId: voucher.id, isUsed: true } });
                    if (usedByUser >= perUserLimit) {
                        throw new common_1.BadRequestException(`Bạn đã dùng hết lượt voucher ${voucher.code || ''}.`);
                    }
                    try {
                        await tx.userVoucher.create({ data: { userId, voucherId: voucher.id, isUsed: true, usedAt: new Date() } });
                    }
                    catch (e) {
                        if (e?.code !== 'P2002')
                            throw e;
                    }
                }
            }
            const _groups = preview.breakdown;
            const _totalSystem = preview.summary.discounts.systemVoucher || 0;
            const _totalCoin = preview.summary.discounts.coin || 0;
            const _totalFreeship = preview.summary.discounts.freeship || 0;
            const _giftFee = preview.summary.giftFee || 0;
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
                const shopVoucher = preview.appliedVouchers.find((v) => v.shopId === group.shopId && !v.isFreeship);
                const systemVoucher = preview.appliedVouchers.find((v) => v.isSystem === true);
                const voucherIdToSave = shopVoucher ? shopVoucher.id : null;
                for (const item of group.items) {
                    if (item.variantId) {
                        const vu = await tx.productVariant.updateMany({
                            where: { id: item.variantId, stock: { gte: item.quantity } },
                            data: { stock: { decrement: item.quantity } },
                        });
                        if (vu.count === 0)
                            throw new common_1.BadRequestException(`Sản phẩm ${item.name} (phân loại đã chọn) vừa hết hàng.`);
                    }
                    const update = await tx.product.updateMany({
                        where: { id: item.productId, stock: { gte: item.quantity } },
                        data: { stock: { decrement: item.quantity } }
                    });
                    if (update.count === 0)
                        throw new common_1.BadRequestException(`Sản phẩm ${item.name} vừa hết hàng.`);
                    if (item.flashSaleProductId) {
                        const fspNow = await tx.flashSaleProduct.findUnique({ where: { id: item.flashSaleProductId }, select: { stock: true } });
                        const incFlash = await tx.flashSaleProduct.updateMany({
                            where: { id: item.flashSaleProductId, sold: { lte: (fspNow?.stock ?? 0) - item.quantity } },
                            data: { sold: { increment: item.quantity } },
                        });
                        if (incFlash.count === 0)
                            throw new common_1.BadRequestException(`Sản phẩm ${item.name} vừa hết suất Flash Sale.`);
                    }
                }
                const note = noteMap[group.shopId] || noteMap['ALL'] || '';
                const newOrder = await tx.order.create({
                    data: {
                        userId,
                        shopId: group.shopId,
                        totalAmount: new client_1.Prisma.Decimal(finalAmount),
                        shippingFee: new client_1.Prisma.Decimal(group.shippingFee),
                        coinUsed: allocatedCoinDisc,
                        paymentGroupId,
                        voucherId: voucherIdToSave,
                        appliedVoucherIds: preview.appliedVouchers.filter((v) => v.isSystem || v.isFreeship).map((v) => v.id),
                        recipientName: receiver.name || dto.senderInfo?.name,
                        recipientPhone: receiver.phone || dto.senderInfo?.phone,
                        recipientAddress: receiver.fullAddress || receiver.address,
                        message: note,
                        isGift: dto.isGift || false,
                        paymentMethod: dto.paymentMethod,
                        paymentStatus: 'PENDING',
                        clientIp,
                        items: {
                            create: group.items.map((i) => ({
                                productId: i.productId,
                                variantId: i.variantId || null,
                                flashSaleProductId: i.flashSaleProductId || null,
                                quantity: i.quantity,
                                price: i.price,
                            }))
                        }
                    }
                });
                createdOrders.push(newOrder);
            }
            return createdOrders;
        }, {
            maxWait: 5000,
            timeout: 40000
        });
        try {
            if (!dto.isBuyNow) {
                if (dto.items && dto.items.length > 0) {
                    await Promise.all(dto.items.map(item => this.cartService.removeItem(userId, item.productId)));
                }
                else {
                    await this.cartService.clearCart(userId);
                }
            }
        }
        catch (e) {
            this.logger.warn(`Lỗi xóa giỏ hàng sau khi đặt đơn: ${e.message}`);
        }
        let paymentUrl = null;
        if (dto.paymentMethod === 'pay2s') {
            try {
                const masterOrderId = result[0].id;
                const totalPay = preview.summary.total;
                const desc = `Thanh toan ${result.length} don hang`;
                paymentUrl = await this.paymentService.createPay2SPayment(masterOrderId, Number(totalPay), desc);
            }
            catch (error) {
                this.logger.error(`Pay2S Error:`, error);
                throw new common_1.BadRequestException(error?.message ||
                    'Không tạo được link thanh toán Pay2S, vui lòng thử lại hoặc chọn phương thức khác');
            }
        }
        if (dto.paymentMethod === 'momo') {
            const masterOrderId = result[0].id;
            const totalPay = preview.summary.total;
            const desc = `Thanh toan ${result.length} don hang Gmall`;
            paymentUrl = await this.paymentService.createMomoPayment(masterOrderId, Number(totalPay), desc);
        }
        if (dto.paymentMethod === 'cod') {
            for (const order of result) {
                const groupInfo = preview.breakdown.find((g) => g.shopId === order.shopId);
                if (!groupInfo)
                    continue;
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
                        items: groupInfo.items.map((i) => ({
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
                }
                catch (err) {
                    this.logger.warn(`GHN Error Order ${order.id}: ${err.message}`);
                }
            }
        }
        this.trackingService.trackEvent(userId, 'server', {
            type: track_event_dto_1.EventType.PURCHASE,
            targetId: result[0].id,
            metadata: { revenue: preview.summary.total, orderCount: result.length }
        });
        return {
            orders: result,
            paymentUrl,
            totalAmount: preview.summary.total
        };
    }
    async findAll(params) {
        const { status, search } = params;
        const { page, limit, skip } = (0, pagination_util_1.getPagination)(params.page, params.limit);
        const where = {};
        if (status && status !== 'ALL') {
            where.status = status;
        }
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
    async getUserOrders(userId, status) {
        const whereCondition = { userId };
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
    async getSellerOrders(userId, status) {
        const shop = await this.prisma.shop.findUnique({ where: { ownerId: userId } });
        if (!shop)
            return [];
        const shouldFilterStatus = status && status.toLowerCase() !== 'all';
        return this.prisma.order.findMany({
            where: {
                shopId: shop.id,
                ...(shouldFilterStatus ? { status: status } : {})
            },
            include: {
                user: { select: { name: true, phone: true } },
                items: { include: { product: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
    }
    async cancelOrder(userId, orderId) {
        const order = await this.prisma.order.findFirst({
            where: { id: orderId, userId },
            include: { items: true }
        });
        if (!order)
            throw new common_1.NotFoundException('Không tìm thấy đơn hàng');
        if (order.status !== 'PENDING')
            throw new common_1.BadRequestException('Không thể hủy đơn hàng này.');
        if (order.paymentStatus === 'PAID') {
            throw new common_1.BadRequestException('Đơn đã thanh toán, vui lòng liên hệ hỗ trợ để được hoàn tiền thay vì hủy.');
        }
        const updatedOrder = await this.prisma.$transaction(async (tx) => {
            const claim = await tx.order.updateMany({
                where: { id: orderId, status: 'PENDING', paymentStatus: { not: 'PAID' } },
                data: { status: 'CANCELLED' },
            });
            if (claim.count === 0)
                throw new common_1.BadRequestException('Đơn hàng đã được xử lý.');
            for (const item of order.items) {
                if (item.productId) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stock: { increment: item.quantity } }
                    });
                }
                if (item.variantId) {
                    await tx.productVariant.updateMany({
                        where: { id: item.variantId },
                        data: { stock: { increment: item.quantity } },
                    });
                }
                if (item.flashSaleProductId) {
                    await tx.flashSaleProduct.updateMany({
                        where: { id: item.flashSaleProductId, sold: { gte: item.quantity } },
                        data: { sold: { decrement: item.quantity } },
                    });
                }
            }
            if (order.coinUsed && order.coinUsed > 0) {
                await tx.pointWallet.update({ where: { userId }, data: { balance: { increment: order.coinUsed } } });
                await tx.pointHistory.create({
                    data: { userId, amount: order.coinUsed, type: client_1.PointType.REFUND, source: 'ORDER', description: `Hoàn xu hủy đơn #${orderId.slice(0, 8)}` },
                });
            }
            if (order.voucherId) {
                const siblingUsing = order.paymentGroupId
                    ? await tx.order.count({ where: { paymentGroupId: order.paymentGroupId, voucherId: order.voucherId, id: { not: orderId }, status: { not: 'CANCELLED' } } })
                    : 0;
                if (siblingUsing === 0) {
                    await tx.voucher.updateMany({ where: { id: order.voucherId, usageCount: { gt: 0 } }, data: { usageCount: { decrement: 1 } } });
                    await tx.userVoucher.updateMany({ where: { userId, voucherId: order.voucherId }, data: { isUsed: false, usedAt: null } });
                }
            }
            const _sharedIds = Array.isArray(order.appliedVoucherIds) ? order.appliedVoucherIds : [];
            if (_sharedIds.length) {
                const otherActive = order.paymentGroupId
                    ? await tx.order.count({ where: { paymentGroupId: order.paymentGroupId, id: { not: orderId }, status: { not: 'CANCELLED' } } })
                    : 0;
                if (otherActive === 0) {
                    for (const vId of _sharedIds) {
                        await tx.voucher.updateMany({ where: { id: vId, usageCount: { gt: 0 } }, data: { usageCount: { decrement: 1 } } });
                        await tx.userVoucher.updateMany({ where: { userId, voucherId: vId }, data: { isUsed: false, usedAt: null } });
                    }
                }
            }
            await this.notificationService.create({
                userId,
                type: 'ORDER',
                title: 'Đơn hàng đã hủy',
                content: `Đơn hàng #${orderId.slice(0, 8)} đã được hủy theo yêu cầu của bạn. Tồn kho đã được hoàn lại.`,
                link: `/user/purchase`,
            }, tx).catch(() => { });
            return await tx.order.findUnique({ where: { id: orderId } });
        });
        return updatedOrder;
    }
    async confirmOrderReceived(userId, orderId) {
        const order = await this.prisma.order.findFirst({
            where: { id: orderId, userId },
            include: { items: true }
        });
        if (!order)
            throw new common_1.NotFoundException('Đơn hàng không tồn tại');
        if (order.status === 'DELIVERED' || order.status === 'CANCELLED') {
            throw new common_1.BadRequestException('Đơn hàng này đã được xử lý trước đó.');
        }
        if (!['SHIPPING', 'CONFIRMED'].includes(order.status)) {
            throw new common_1.BadRequestException('Trạng thái đơn hàng không hợp lệ để xác nhận.');
        }
        if (order.paymentStatus !== 'PAID' && String(order.paymentMethod).toLowerCase() !== 'cod') {
            throw new common_1.BadRequestException('Đơn thanh toán online chưa được thanh toán, không thể xác nhận đã nhận.');
        }
        return this.prisma.$transaction(async (tx) => {
            const claim = await tx.order.updateMany({
                where: { id: orderId, status: { in: ['SHIPPING', 'CONFIRMED'] } },
                data: { status: 'DELIVERED', updatedAt: new Date() },
            });
            if (claim.count === 0)
                throw new common_1.BadRequestException('Đơn hàng đã được xử lý.');
            const updatedOrder = await tx.order.findUnique({ where: { id: orderId } });
            if (!updatedOrder)
                throw new common_1.NotFoundException('Đơn hàng không tồn tại');
            const isPaidForReward = order.paymentStatus === 'PAID' || String(order.paymentMethod).toLowerCase() === 'cod';
            const conversionRate = await this.pointService.getConversionRate();
            const rawPoints = Number(order.totalAmount) / conversionRate;
            const pointsToEarn = isPaidForReward ? Math.floor(rawPoints) : 0;
            let newBalance = 0;
            if (pointsToEarn > 0) {
                newBalance = await this.pointService.addPoints(userId, pointsToEarn, client_1.PointType.EARN_ORDER, `REWARD_${orderId}`, `Hoàn xu đơn hàng #${orderId.slice(0, 8)}`, tx);
            }
            else {
                const wallet = await tx.pointWallet.findUnique({ where: { userId } });
                newBalance = wallet?.balance || 0;
            }
            if (isPaidForReward) {
                try {
                    await this.charityService.processOrderDelivered(tx, {
                        orderId: updatedOrder.id,
                        orderTotal: Number(order.totalAmount),
                    });
                }
                catch (e) {
                    this.logger.warn(`[Charity hook fail] order=${updatedOrder.id} err=${e?.message}`);
                }
                try {
                    await this.processReferralReward(tx, userId, Number(order.totalAmount));
                }
                catch (e) {
                    this.logger.warn(`[Referral hook fail] order=${updatedOrder.id} err=${e?.message}`);
                }
            }
            await this.creditSellerOnDelivered(tx, order);
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
            }
            catch (e) {
                this.logger.warn(`[Notif delivered fail] order=${updatedOrder.id} err=${e?.message}`);
            }
            return {
                success: true,
                orderId: updatedOrder.id,
                earnedPoints: pointsToEarn,
                newBalance: newBalance
            };
        }, {
            timeout: 15000,
            maxWait: 5000
        });
    }
    async processReferralReward(tx, userId, orderTotal) {
        const minOrder = await this.systemSetting.getNumber('REFERRAL_MIN_ORDER', 300000);
        const rewardAmount = await this.systemSetting.getNumber('REFERRAL_REWARD_AMOUNT', 20000);
        if (orderTotal < minOrder)
            return;
        const user = await tx.user.findUnique({
            where: { id: userId },
            select: { id: true, referredById: true, referralRewardPaid: true },
        });
        if (!user || !user.referredById || user.referralRewardPaid)
            return;
        const refereeIps = await tx.order.findMany({
            where: { userId, clientIp: { not: null } },
            select: { clientIp: true },
            distinct: ['clientIp'],
            take: 10,
        });
        const refereeIpSet = new Set(refereeIps.map(o => o.clientIp).filter(Boolean));
        if (refereeIpSet.size > 0) {
            const overlap = await tx.order.findFirst({
                where: { userId: user.referredById, clientIp: { in: Array.from(refereeIpSet) } },
                select: { id: true, clientIp: true },
            });
            if (overlap) {
                this.logger.warn(`[Referral SKIP anti-farm] referrer=${user.referredById} referee=${userId} cùng IP=${overlap.clientIp}`);
                await tx.user.update({ where: { id: userId }, data: { referralRewardPaid: true } });
                return;
            }
        }
        await this.pointService.addPoints(user.referredById, rewardAmount, client_1.PointType.EARN_AFFILIATE, `REFERRAL_${userId}`, `Thưởng giới thiệu user ${userId.slice(0, 8)}`, tx);
        await tx.user.update({
            where: { id: userId },
            data: { referralRewardPaid: true },
        });
        this.logger.log(`[Referral] +${rewardAmount}đ cho ${user.referredById} từ user ${userId} (đơn ${orderTotal}đ)`);
    }
    async creditSellerOnDelivered(tx, order) {
        try {
            if (!order?.shopId)
                return;
            const isPaid = order.paymentStatus === 'PAID' || String(order.paymentMethod).toLowerCase() === 'cod';
            if (!isPaid)
                return;
            const feeRate = await this.systemSetting.getNumber('ORDER_PLATFORM_FEE_RATE', 0.05);
            const net = Math.floor(Number(order.totalAmount) * (1 - feeRate));
            if (net <= 0)
                return;
            const already = await tx.walletTransaction.findFirst({ where: { referenceId: order.id, type: 'ORDER_INCOME' } });
            if (already)
                return;
            const shop = await tx.shop.findUnique({ where: { id: order.shopId }, select: { ownerId: true } });
            if (!shop?.ownerId)
                return;
            await tx.user.update({ where: { id: shop.ownerId }, data: { walletBalance: { increment: net } } });
            await tx.walletTransaction.create({
                data: { userId: shop.ownerId, amount: net, type: 'ORDER_INCOME', status: 'COMPLETED', referenceId: order.id, description: `Doanh thu đơn #${order.id.slice(0, 8)}` },
            });
        }
        catch (e) {
            this.logger.error(`[SellerCredit fail → rollback] order=${order?.id} err=${e?.message}`);
            throw e;
        }
    }
    async updateOrderStatus(orderId, sellerId, status) {
        const shop = await this.prisma.shop.findUnique({ where: { ownerId: sellerId } });
        if (!shop)
            throw new common_1.NotFoundException('Shop không tồn tại');
        const order = await this.prisma.order.findFirst({
            where: { id: orderId, shopId: shop.id }
        });
        if (!order)
            throw new common_1.NotFoundException('Đơn hàng không tồn tại hoặc không thuộc quyền quản lý');
        status = String(status).toUpperCase();
        this.logger.log(`[OrderUpdate] Start update Order #${orderId}. Input Status: "${status}". Order Total: ${order.totalAmount}`);
        if (order.status === 'DELIVERED' || order.status === 'CANCELLED') {
            throw new common_1.BadRequestException('Đơn đã ở trạng thái cuối, không thể đổi trạng thái.');
        }
        const _validStatuses = ['PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'CANCELLED'];
        if (!_validStatuses.includes(String(status).toUpperCase())) {
            throw new common_1.BadRequestException('Trạng thái đơn hàng không hợp lệ.');
        }
        if (status === 'CANCELLED' && order.paymentStatus === 'PAID') {
            throw new common_1.BadRequestException('Đơn đã thanh toán, không thể hủy trực tiếp — cần luồng hoàn tiền/khiếu nại.');
        }
        if (status === 'CANCELLED') {
            return this.prisma.$transaction(async (tx) => {
                const claim = await tx.order.updateMany({
                    where: { id: orderId, status: { notIn: ['DELIVERED', 'CANCELLED'] }, paymentStatus: { not: 'PAID' } },
                    data: { status: 'CANCELLED' },
                });
                if (claim.count === 0)
                    throw new common_1.BadRequestException('Đơn đã được xử lý, không thể hủy.');
                const full = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
                if (full) {
                    for (const item of full.items) {
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
                    if (full.coinUsed && full.coinUsed > 0) {
                        await tx.pointWallet.update({ where: { userId: full.userId }, data: { balance: { increment: full.coinUsed } } });
                        await tx.pointHistory.create({ data: { userId: full.userId, amount: full.coinUsed, type: client_1.PointType.REFUND, source: 'ORDER', description: `Hoàn xu shop hủy đơn #${orderId.slice(0, 8)}` } });
                    }
                    if (full.voucherId) {
                        const siblingUsing = full.paymentGroupId
                            ? await tx.order.count({ where: { paymentGroupId: full.paymentGroupId, voucherId: full.voucherId, id: { not: orderId }, status: { not: 'CANCELLED' } } })
                            : 0;
                        if (siblingUsing === 0) {
                            await tx.voucher.updateMany({ where: { id: full.voucherId, usageCount: { gt: 0 } }, data: { usageCount: { decrement: 1 } } });
                            await tx.userVoucher.updateMany({ where: { userId: full.userId, voucherId: full.voucherId }, data: { isUsed: false, usedAt: null } });
                        }
                    }
                    const _shared = Array.isArray(full.appliedVoucherIds) ? full.appliedVoucherIds : [];
                    if (_shared.length) {
                        const otherActive = full.paymentGroupId
                            ? await tx.order.count({ where: { paymentGroupId: full.paymentGroupId, id: { not: orderId }, status: { not: 'CANCELLED' } } })
                            : 0;
                        if (otherActive === 0) {
                            for (const vId of _shared) {
                                await tx.voucher.updateMany({ where: { id: vId, usageCount: { gt: 0 } }, data: { usageCount: { decrement: 1 } } });
                                await tx.userVoucher.updateMany({ where: { userId: full.userId, voucherId: vId }, data: { isUsed: false, usedAt: null } });
                            }
                        }
                    }
                }
                await this.notificationService.create({ userId: order.userId, type: 'ORDER', title: 'Đơn hàng đã hủy', content: `Đơn hàng #${orderId.slice(0, 8)} đã bị shop hủy. Tồn kho/xu/voucher đã được hoàn lại.`, link: `/user/purchase` }, tx).catch(() => { });
                return await tx.order.findUnique({ where: { id: orderId } });
            });
        }
        if (String(status).toUpperCase() === 'DELIVERED') {
            const isPaidOrCod = order.paymentStatus === 'PAID' || String(order.paymentMethod).toLowerCase() === 'cod';
            if (!isPaidOrCod) {
                throw new common_1.BadRequestException('Đơn thanh toán online chưa được thanh toán, không thể đánh dấu đã giao.');
            }
        }
        return this.prisma.$transaction(async (tx) => {
            if (String(status).toUpperCase() === 'DELIVERED') {
                const claim = await tx.order.updateMany({
                    where: { id: orderId, status: { not: 'DELIVERED' } },
                    data: { status },
                });
                if (claim.count === 0) {
                    return await tx.order.findUnique({ where: { id: orderId } });
                }
            }
            else {
                await tx.order.update({ where: { id: orderId }, data: { status } });
            }
            const updatedOrder = await tx.order.findUnique({ where: { id: orderId } });
            this.logger.log(`[OrderUpdate] DB Update Status Success: ${updatedOrder?.status}`);
            const isPaidForReward = order.paymentStatus === 'PAID' || String(order.paymentMethod).toLowerCase() === 'cod';
            if (String(status).toUpperCase() === 'DELIVERED' && !isPaidForReward) {
                this.logger.warn(`[Reward] SKIP — order ${orderId} chưa thanh toán (paymentStatus=${order.paymentStatus}, method=${order.paymentMethod}).`);
            }
            else if (String(status).toUpperCase() === 'DELIVERED') {
                const conversionRate = await this.pointService.getConversionRate();
                const rawPoints = Number(order.totalAmount) / conversionRate;
                const pointsToEarn = Math.floor(rawPoints);
                this.logger.log(`[OrderUpdate] Calculation: Total=${order.totalAmount} / 10000 = ${rawPoints} -> Floor = ${pointsToEarn} points.`);
                if (pointsToEarn > 0) {
                    try {
                        const newBalance = await this.pointService.addPoints(order.userId, pointsToEarn, client_1.PointType.EARN_ORDER, `REWARD_${order.id}`, `Hoàn xu đơn hàng #${order.id.slice(0, 8)}`, tx);
                        this.logger.log(`[Reward] SUCCESS! User ${order.userId} received ${pointsToEarn} points. New Balance: ${newBalance}`);
                    }
                    catch (err) {
                        this.logger.error(`[Reward] FAILED to add points: ${err.message}`, err.stack);
                    }
                }
                else {
                    this.logger.warn(`[Reward] SKIPPED. Reason: Calculated points is 0 (Order value too low).`);
                }
            }
            else {
                this.logger.log(`[OrderUpdate] Logic skipped because status "${status}" is not DELIVERED.`);
            }
            if (String(status).toUpperCase() === 'DELIVERED') {
                await this.creditSellerOnDelivered(tx, order);
            }
            try {
                const statusMsg = {
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
            }
            catch (e) {
                this.logger.warn(`[Notif status fail] order=${order.id} err=${e?.message}`);
            }
            return updatedOrder;
        }, {
            timeout: 20000
        });
    }
    async getSellerOrderDetail(orderId, sellerId) {
        const shop = await this.prisma.shop.findUnique({ where: { ownerId: sellerId } });
        if (!shop)
            throw new common_1.NotFoundException('Shop không tồn tại');
        const order = await this.prisma.order.findFirst({
            where: { id: orderId, shopId: shop.id },
            include: {
                user: { select: { name: true, phone: true, email: true } },
                items: { include: { product: true } }
            }
        });
        if (!order)
            throw new common_1.NotFoundException('Không tìm thấy đơn hàng');
        return order;
    }
    async findOne(id, userId) {
        if (!id || id === 'undefined')
            throw new common_1.NotFoundException('ID không hợp lệ');
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
        if (!order)
            throw new common_1.NotFoundException('Không tìm thấy đơn hàng');
        return order;
    }
    async findOneAsAdmin(id) {
        if (!id || id === 'undefined')
            throw new common_1.NotFoundException('ID không hợp lệ');
        const order = await this.prisma.order.findFirst({
            where: { OR: [{ id }, { shippingOrderCode: id }] },
            include: {
                items: { include: { product: { select: { id: true, name: true, slug: true, images: true, price: true } } } },
                voucher: true,
                shop: { select: { id: true, name: true, slug: true } },
                user: { select: { id: true, name: true, email: true, phone: true, avatar: true } },
            },
        });
        if (!order)
            throw new common_1.NotFoundException('Không tìm thấy đơn hàng');
        return order;
    }
};
exports.OrderService = OrderService;
exports.OrderService = OrderService = OrderService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cart_service_1.CartService,
        promotion_service_1.PromotionService,
        tracking_service_1.TrackingService,
        point_service_1.PointService,
        ghn_service_1.GhnService,
        payment_service_1.PaymentService,
        charity_service_1.CharityService,
        system_setting_service_1.SystemSettingService,
        notification_service_1.NotificationService])
], OrderService);
//# sourceMappingURL=order.service.js.map