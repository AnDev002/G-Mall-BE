"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminUsersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const pagination_util_1 = require("../../common/utils/pagination.util");
const tracking_service_1 = require("../tracking/tracking.service");
const track_event_dto_1 = require("../tracking/dto/track-event.dto");
const mailer_1 = require("@nestjs-modules/mailer");
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const OWNER_BAN_REASON_PREFIX = 'Tài khoản chủ sở hữu bị khóa: ';
function generateSlug(name) {
    return name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ /g, '-')
        .replace(/[^\w-]+/g, '') + '-' + Date.now().toString().slice(-4);
}
let AdminUsersService = class AdminUsersService {
    prisma;
    trackingService;
    mailerService;
    constructor(prisma, trackingService, mailerService) {
        this.prisma = prisma;
        this.trackingService = trackingService;
        this.mailerService = mailerService;
    }
    async getSellers(params) {
        const { search } = params;
        const { page, limit, skip } = (0, pagination_util_1.getPagination)(params.page, params.limit);
        const where = {};
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { owner: { email: { contains: search } } },
                { owner: { name: { contains: search } } },
            ];
        }
        const [shops, total] = await Promise.all([
            this.prisma.shop.findMany({
                where,
                skip,
                take: Number(limit),
                orderBy: { createdAt: 'desc' },
                include: {
                    owner: {
                        select: {
                            id: true,
                            email: true,
                            name: true,
                            phone: true,
                            avatar: true,
                            walletBalance: true
                        }
                    },
                    _count: { select: { products: true } }
                },
            }),
            this.prisma.shop.count({ where }),
        ]);
        const data = await Promise.all(shops.map(async (shop) => {
            const revenueStats = await this.prisma.orderItem.findMany({
                where: {
                    product: { shopId: shop.id },
                    order: { status: 'DELIVERED' }
                },
                select: { price: true, quantity: true }
            });
            const totalRevenue = revenueStats.reduce((sum, item) => {
                return sum + (Number(item.price) * item.quantity);
            }, 0);
            const totalOrders = await this.prisma.order.count({
                where: {
                    status: 'DELIVERED',
                    items: { some: { product: { shopId: shop.id } } }
                }
            });
            return {
                id: shop.id,
                shopName: shop.name,
                avatar: shop.avatar || shop.owner.avatar,
                createdAt: shop.createdAt,
                status: shop.status,
                isBanned: shop.status === 'BANNED',
                ownerId: shop.owner.id,
                name: shop.owner.name,
                email: shop.owner.email,
                phone: shop.owner.phone,
                walletBalance: shop.owner.walletBalance,
                totalRevenue,
                totalOrders,
                totalProducts: shop._count.products,
                rating: shop.rating || 0
            };
        }));
        return {
            data,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }
    async getSellerDetail(shopId) {
        const shop = await this.prisma.shop.findUnique({
            where: { id: shopId },
            include: {
                owner: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        phone: true,
                        avatar: true,
                        createdAt: true,
                        walletBalance: true,
                        isBanned: true,
                        isVerified: true,
                    },
                },
                _count: { select: { products: true } },
                products: {
                    take: 5,
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        price: true,
                        images: true,
                        status: true,
                        createdAt: true,
                    },
                },
            },
        });
        if (!shop)
            throw new common_1.NotFoundException('Cửa hàng không tồn tại');
        const revenueAgg = await this.prisma.orderItem.findMany({
            where: { product: { shopId }, order: { status: 'DELIVERED' } },
            select: { price: true, quantity: true },
        });
        const totalRevenue = revenueAgg.reduce((sum, it) => sum + Number(it.price) * (it.quantity || 1), 0);
        const totalOrders = await this.prisma.order.count({
            where: { status: 'DELIVERED', items: { some: { product: { shopId } } } },
        });
        return {
            id: shop.id,
            name: shop.name,
            slug: shop.slug,
            status: shop.status,
            avatar: shop.avatar,
            coverImage: shop.coverImage,
            description: shop.description,
            pickupAddress: shop.pickupAddress,
            rating: shop.rating || 0,
            createdAt: shop.createdAt,
            owner: shop.owner,
            productCount: shop._count.products,
            recentProducts: shop.products,
            totalRevenue,
            totalOrders,
            isBanned: shop.status === 'BANNED' || !!shop.owner.isBanned,
        };
    }
    async toggleBanShop(adminId, shopId, isBanned, reason) {
        const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
        if (!shop)
            throw new common_1.NotFoundException('Cửa hàng không tồn tại');
        await this.prisma.shop.update({
            where: { id: shopId },
            data: {
                status: isBanned ? client_1.ShopStatus.BANNED : client_1.ShopStatus.ACTIVE,
                banReason: isBanned ? reason : null
            }
        });
        await this.trackingService.trackEvent(adminId, 'admin-action', {
            type: isBanned ? track_event_dto_1.EventType.BAN_SHOP : track_event_dto_1.EventType.UNBAN_SHOP,
            targetId: shopId,
            metadata: { reason, shopName: shop.name }
        });
        return {
            success: true,
            message: isBanned ? `Đã khóa shop ${shop.name}` : `Đã mở khóa shop ${shop.name}`
        };
    }
    async getPendingShops(page = 1, limit = 10) {
        console.log(`🔍 [DEBUG] getPendingShops called with page=${page}, limit=${limit}`);
        const _pg = (0, pagination_util_1.getPagination)(page, limit);
        page = _pg.page;
        limit = _pg.limit;
        const skip = _pg.skip;
        const pendingCount = await this.prisma.shop.count({ where: { status: 'PENDING' } });
        console.log(`📊 [DEBUG] Total PENDING shops found in DB: ${pendingCount}`);
        const [shops, total] = await Promise.all([
            this.prisma.shop.findMany({
                where: { status: 'PENDING' },
                include: {
                    owner: { select: { email: true, name: true, phone: true } }
                },
                orderBy: { createdAt: 'asc' },
                skip,
                take: limit,
            }),
            this.prisma.shop.count({ where: { status: 'PENDING' } }),
        ]);
        console.log(`✅ [DEBUG] Returning ${shops.length} shops to Controller`);
        return {
            data: shops,
            meta: { total, page, lastPage: Math.ceil(total / limit) }
        };
    }
    async approveShopUpdate(adminId, shopId) {
        const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
        if (!shop || !shop.pendingDetails)
            throw new common_1.BadRequestException("Không có thông tin chờ duyệt");
        const pending = shop.pendingDetails;
        const updateData = {
            pendingDetails: client_1.Prisma.DbNull,
        };
        if (pending.businessLicenseFront)
            updateData.businessLicenseFront = pending.businessLicenseFront;
        if (pending.businessLicenseBack)
            updateData.businessLicenseBack = pending.businessLicenseBack;
        if (pending.salesLicense)
            updateData.salesLicense = pending.salesLicense;
        if (pending.trademarkCert)
            updateData.trademarkCert = pending.trademarkCert;
        if (pending.distributorCert)
            updateData.distributorCert = pending.distributorCert;
        await this.prisma.shop.update({
            where: { id: shopId },
            data: updateData
        });
        return { message: "Đã duyệt cập nhật thông tin shop" };
    }
    async approveShop(adminId, shopId) {
        const shop = await this.prisma.shop.findUnique({
            where: { id: shopId },
            include: { owner: true }
        });
        if (!shop)
            throw new common_1.NotFoundException('Shop không tồn tại');
        if (shop.status === 'ACTIVE')
            throw new common_1.BadRequestException('Shop này đã được duyệt rồi');
        if (shop.status !== client_1.ShopStatus.PENDING)
            throw new common_1.BadRequestException('Chỉ có thể duyệt shop đang chờ duyệt (PENDING)');
        await this.prisma.shop.update({
            where: { id: shopId },
            data: { status: client_1.ShopStatus.ACTIVE },
        });
        if (shop.owner.role === client_1.Role.BUYER || shop.owner.role === client_1.Role.PENDING_SELLER) {
            await this.prisma.user.update({
                where: { id: shop.ownerId },
                data: { role: client_1.Role.SELLER, isVerified: true }
            });
        }
        if (shop.owner.email) {
            try {
                await this.mailerService.sendMail({
                    to: shop.owner.email,
                    subject: 'Chúc mừng! Cửa hàng của bạn đã được duyệt trên GMall',
                    html: `
                  <h3>Xin chào ${shop.owner.name},</h3>
                  <p>Cửa hàng <b>${shop.name}</b> của bạn đã được phê duyệt.</p>
                  <p>Bạn có thể bắt đầu đăng bán sản phẩm ngay bây giờ.</p>
              `,
                });
            }
            catch (error) {
                console.error("Lỗi gửi mail approve shop:", error.message);
            }
        }
        await this.trackingService.trackEvent(adminId, 'admin-action', {
            type: track_event_dto_1.EventType.APPROVE_SELLER,
            targetId: shopId,
            metadata: { adminId, action: 'Approve Shop', timestamp: new Date() }
        });
        return { message: 'Đã phê duyệt Shop thành công' };
    }
    async getShopUpdateRequests(page = 1, limit = 10) {
        const _pg = (0, pagination_util_1.getPagination)(page, limit);
        page = _pg.page;
        limit = _pg.limit;
        const skip = _pg.skip;
        const whereCondition = {
            pendingDetails: {
                not: client_1.Prisma.DbNull
            }
        };
        const [shops, total] = await Promise.all([
            this.prisma.shop.findMany({
                where: whereCondition,
                select: {
                    id: true,
                    name: true,
                    owner: {
                        select: {
                            email: true,
                            name: true,
                            phone: true,
                        }
                    },
                    avatar: true,
                    pendingDetails: true,
                    updatedAt: true,
                },
                skip,
                take: limit,
                orderBy: { updatedAt: 'desc' }
            }),
            this.prisma.shop.count({ where: whereCondition }),
        ]);
        return {
            data: shops,
            total,
            page,
            lastPage: Math.ceil(total / limit),
        };
    }
    async rejectShop(adminId, shopId, reason) {
        const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
        if (!shop)
            throw new common_1.NotFoundException('Shop không tồn tại');
        await this.prisma.shop.update({
            where: { id: shopId },
            data: {
                status: client_1.ShopStatus.REJECTED,
                banReason: reason
            }
        });
        await this.trackingService.trackEvent(adminId, 'admin-action', {
            type: track_event_dto_1.EventType.REJECT_SELLER,
            targetId: shopId,
            metadata: { reason }
        });
        return { message: 'Đã từ chối yêu cầu mở Shop' };
    }
    async getAllUsers(params) {
        const { search, role, minPoints, maxPoints, industryId } = params;
        const { page, limit, skip } = (0, pagination_util_1.getPagination)(params.page, params.limit);
        const where = {};
        if (role && role !== 'ALL') {
            where.role = role;
        }
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { email: { contains: search } },
                { username: { contains: search } },
                { phone: { contains: search } },
            ];
        }
        if (minPoints !== undefined || maxPoints !== undefined) {
            where.pointWallet = {
                balance: {
                    gte: minPoints ? Number(minPoints) : undefined,
                    lte: maxPoints ? Number(maxPoints) : undefined,
                },
            };
        }
        if (industryId) {
            const categoryStats = await this.prisma.product.groupBy({
                by: ['shopId', 'categoryId'],
                where: {
                    status: 'ACTIVE',
                    shopId: { not: null }
                },
                _count: {
                    _all: true
                }
            });
            const shopDominantMap = new Map();
            const shopMaxCountMap = new Map();
            for (const stat of categoryStats) {
                const sId = stat.shopId;
                const cId = stat.categoryId;
                const count = stat._count._all;
                if (!sId || !cId)
                    continue;
                const currentMax = shopMaxCountMap.get(sId) || 0;
                if (count > currentMax) {
                    shopMaxCountMap.set(sId, count);
                    shopDominantMap.set(sId, cId);
                }
            }
            const targetShopIds = [];
            shopDominantMap.forEach((dominantCatId, shopId) => {
                if (dominantCatId === industryId) {
                    targetShopIds.push(shopId);
                }
            });
            if (targetShopIds.length === 0) {
                return {
                    data: [],
                    meta: { total: 0, page: Number(page), limit: Number(limit), totalPages: 0 },
                };
            }
            const matchingShops = await this.prisma.shop.findMany({
                where: { id: { in: targetShopIds } },
                select: { ownerId: true }
            });
            const ownerIds = matchingShops.map(s => s.ownerId);
            where.id = { in: ownerIds };
            where.role = 'SELLER';
        }
        const [users, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                skip,
                take: Number(limit),
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    email: true,
                    username: true,
                    name: true,
                    phone: true,
                    role: true,
                    avatar: true,
                    isVerified: true,
                    isBanned: true,
                    banReason: true,
                    createdAt: true,
                    pointWallet: {
                        select: { balance: true }
                    },
                    shop: {
                        select: {
                            id: true,
                            name: true,
                            status: true,
                            categoryId: true,
                            category: {
                                select: { name: true }
                            }
                        }
                    }
                },
            }),
            this.prisma.user.count({ where }),
        ]);
        const enrichedUsers = await Promise.all(users.map(async (u) => {
            let dominantCategoryName = null;
            if (u.role === 'SELLER' && u.shop) {
                const topCat = await this.prisma.product.groupBy({
                    by: ['categoryId'],
                    where: { shopId: u.shop.id, status: 'ACTIVE' },
                    _count: { categoryId: true },
                    orderBy: { _count: { categoryId: 'desc' } },
                    take: 1
                });
                if (topCat.length > 0 && topCat[0].categoryId) {
                    const catInfo = await this.prisma.category.findUnique({
                        where: { id: topCat[0].categoryId },
                        select: { name: true }
                    });
                    dominantCategoryName = catInfo?.name || null;
                }
                else if (u.shop.category) {
                    dominantCategoryName = u.shop.category.name;
                }
            }
            return {
                ...u,
                pointBalance: u.pointWallet?.balance || 0,
                dominantIndustry: dominantCategoryName
            };
        }));
        return {
            data: enrichedUsers,
            meta: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    async createUser(adminId, dto) {
        if (!dto.email && !dto.username) {
            throw new common_1.BadRequestException('Phải cung cấp ít nhất Email hoặc Username');
        }
        if (dto.role === 'SELLER' && !dto.shopName) {
            throw new common_1.BadRequestException('Vui lòng nhập Tên Cửa Hàng cho tài khoản Người bán');
        }
        const existingUser = await this.prisma.user.findFirst({
            where: {
                OR: [
                    dto.email ? { email: dto.email } : {},
                    dto.username ? { username: dto.username } : {}
                ]
            }
        });
        if (existingUser) {
            throw new common_1.ConflictException('Email hoặc Username đã tồn tại trong hệ thống');
        }
        const hashedPassword = await bcrypt.hash(dto.password, 10);
        let shopSlug = '';
        if (dto.role === 'SELLER' && dto.shopName) {
            shopSlug = generateSlug(dto.shopName);
            const existingShop = await this.prisma.shop.findUnique({
                where: { slug: shopSlug }
            });
            if (existingShop) {
                shopSlug = generateSlug(dto.shopName) + '-' + Math.floor(Math.random() * 100);
            }
        }
        const result = await this.prisma.$transaction(async (prisma) => {
            const newUser = await prisma.user.create({
                data: {
                    name: dto.name,
                    email: dto.email || null,
                    username: dto.username || (dto.email ? dto.email.split('@')[0] + Math.floor(Math.random() * 1000) : `user${Date.now()}`),
                    password: hashedPassword,
                    role: dto.role || client_1.Role.BUYER,
                    isVerified: true,
                    phone: dto.phone || null,
                    shopName: dto.role === 'SELLER' ? dto.shopName : null,
                    cart: { create: {} },
                    pointWallet: { create: { balance: 0 } }
                }
            });
            if (dto.role === 'SELLER' && dto.shopName) {
                await prisma.shop.create({
                    data: {
                        name: dto.shopName,
                        slug: shopSlug,
                        description: `Cửa hàng chính thức của ${dto.name}`,
                        ownerId: newUser.id,
                        status: client_1.ShopStatus.ACTIVE,
                        rating: 0,
                        totalSales: 0,
                        pickupAddress: "Đang cập nhật",
                        lat: 0,
                        lng: 0
                    }
                });
            }
            return newUser;
        });
        await this.trackingService.trackEvent(adminId, 'admin-action', {
            type: track_event_dto_1.EventType.CREATE_USER,
            targetId: result.id,
            metadata: {
                role: dto.role,
                email: result.email,
                shopName: dto.shopName
            }
        });
        const { password, ...userSafe } = result;
        return userSafe;
    }
    async toggleBanUser(adminId, userId, isBanned, reason) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new common_1.NotFoundException('Người dùng không tồn tại');
        if (user.role === 'ADMIN' && isBanned) {
            throw new common_1.BadRequestException('Không thể khóa tài khoản Admin');
        }
        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: {
                isBanned: isBanned,
                banReason: isBanned ? reason : null
            }
        });
        if (isBanned && user.role === 'SELLER') {
            await this.prisma.shop.updateMany({
                where: { ownerId: userId, status: client_1.ShopStatus.ACTIVE },
                data: { status: client_1.ShopStatus.BANNED, banReason: OWNER_BAN_REASON_PREFIX + (reason || 'tài khoản chủ sở hữu bị khóa') }
            });
        }
        if (!isBanned && user.role === 'SELLER') {
            await this.prisma.shop.updateMany({
                where: {
                    ownerId: userId,
                    status: client_1.ShopStatus.BANNED,
                    banReason: { startsWith: OWNER_BAN_REASON_PREFIX },
                },
                data: { status: client_1.ShopStatus.ACTIVE, banReason: null }
            });
        }
        await this.trackingService.trackEvent(adminId, 'admin-action', {
            type: isBanned ? track_event_dto_1.EventType.BAN_USER : track_event_dto_1.EventType.UNBAN_USER,
            targetId: userId,
            metadata: { reason, email: user.email }
        });
        return {
            success: true,
            message: isBanned
                ? `Đã khóa tài khoản ${user.name}`
                : `Đã mở khóa tài khoản ${user.name}`,
            user: { id: updatedUser.id, isBanned: updatedUser.isBanned }
        };
    }
    async deleteUser(adminId, userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                shop: true,
                pointWallet: true,
                dailyCheckIn: true,
                cart: true
            }
        });
        if (!user)
            throw new common_1.NotFoundException('Người dùng không tồn tại');
        if (user.role === 'ADMIN')
            throw new common_1.BadRequestException('Không thể xóa Admin');
        await this.prisma.$transaction(async (tx) => {
            if (user.shop) {
                const shopId = user.shop.id;
                const shopProductIds = (await tx.product.findMany({ where: { shopId }, select: { id: true } })).map(p => p.id);
                if (shopProductIds.length) {
                    await tx.flashSaleProduct.deleteMany({ where: { productId: { in: shopProductIds } } });
                    await tx.productVariant.deleteMany({ where: { productId: { in: shopProductIds } } });
                    await tx.productReview.deleteMany({ where: { productId: { in: shopProductIds } } });
                }
                await tx.product.deleteMany({ where: { shopId: shopId } });
                await tx.shopCategory.deleteMany({ where: { shopId: shopId } });
                await tx.voucher.deleteMany({ where: { shopId: shopId } });
                await tx.shopReview.deleteMany({ where: { shopId: shopId } });
                await tx.shop.delete({ where: { id: shopId } });
            }
            await tx.donation.updateMany({ where: { userId: userId }, data: { userId: null } });
            await tx.payoutRequest.deleteMany({ where: { userId: userId } });
            await tx.walletTransaction.deleteMany({ where: { userId: userId } });
            await tx.pointTransaction.deleteMany({ where: { userId: userId } });
            await tx.pointHistory.deleteMany({ where: { userId: userId } });
            if (user.pointWallet)
                await tx.pointWallet.delete({ where: { userId: userId } });
            if (user.dailyCheckIn)
                await tx.dailyCheckIn.delete({ where: { userId: userId } });
            await tx.address.deleteMany({ where: { userId: userId } });
            await tx.userVoucher.deleteMany({ where: { userId: userId } });
            await tx.productReview.deleteMany({ where: { userId: userId } });
            await tx.shopReview.deleteMany({ where: { userId: userId } });
            await tx.complaint.deleteMany({ where: { userId: userId } });
            await tx.orderItem.deleteMany({ where: { order: { userId: userId } } });
            await tx.order.deleteMany({ where: { userId: userId } });
            await tx.cartItem.deleteMany({ where: { cartId: user.cart?.id } });
            if (user.cart)
                await tx.cart.delete({ where: { userId: userId } });
            await tx.message.deleteMany({ where: { senderId: userId } });
            await tx.friendship.deleteMany({
                where: { OR: [{ senderId: userId }, { receiverId: userId }] }
            });
            await tx.blogPost.deleteMany({ where: { authorId: userId } });
            await tx.analyticsLog.deleteMany({ where: { userId: userId } });
            await tx.user.delete({ where: { id: userId } });
        });
        await this.trackingService.trackEvent(adminId, 'admin-action', {
            type: track_event_dto_1.EventType.DELETE_USER,
            targetId: userId,
            metadata: { email: user.email, action: 'Hard Delete' }
        });
        return { success: true, message: `Hệ thống đã dọn dẹp sạch sẽ dữ liệu của ${user.email}` };
    }
};
exports.AdminUsersService = AdminUsersService;
exports.AdminUsersService = AdminUsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        tracking_service_1.TrackingService,
        mailer_1.MailerService])
], AdminUsersService);
//# sourceMappingURL=admin-users.service.js.map