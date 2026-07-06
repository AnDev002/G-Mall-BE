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
exports.ShopService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const nanoid_1 = require("nanoid");
const slug_util_1 = require("../../common/utils/slug.util");
const pagination_util_1 = require("../../common/utils/pagination.util");
const client_1 = require("@prisma/client");
let ShopService = class ShopService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async resolveShopId(idOrSlug) {
        const shop = await this.prisma.shop.findFirst({
            where: {
                OR: [
                    { id: idOrSlug },
                    { slug: idOrSlug }
                ]
            },
            select: { id: true }
        });
        return shop ? shop.id : null;
    }
    async createShop(userId, data) {
        const existingShop = await this.prisma.shop.findUnique({ where: { ownerId: userId } });
        if (existingShop)
            throw new common_1.BadRequestException('Bạn đã sở hữu một cửa hàng.');
        const slug = `${(0, slug_util_1.generateSlug)(data.name)}-${(0, nanoid_1.nanoid)(6)}`;
        return this.prisma.shop.create({
            data: {
                ownerId: userId,
                name: data.name,
                slug: slug,
                pickupAddress: data.pickupAddress,
                provinceId: data.provinceId,
                districtId: data.districtId,
                wardCode: data.wardCode,
                lat: data.lat || 0,
                lng: data.lng || 0,
                description: data.description,
                status: 'PENDING',
            }
        });
    }
    async getShopCustomCategories(shopIdOrSlug) {
        let shopId = shopIdOrSlug;
        const shop = await this.prisma.shop.findFirst({
            where: {
                OR: [
                    { id: shopIdOrSlug },
                    { slug: shopIdOrSlug }
                ]
            },
            select: { id: true }
        });
        if (!shop)
            return [];
        shopId = shop.id;
        return this.prisma.shopCategory.findMany({
            where: {
                shopId: shopId,
                isActive: true
            },
            include: {
                _count: { select: { products: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
    }
    async getShopCategories(shopId) {
        const distinctCategories = await this.prisma.product.findMany({
            where: {
                shopId: shopId,
                status: 'ACTIVE'
            },
            select: {
                category: {
                    select: {
                        id: true,
                        name: true,
                        image: true,
                        slug: true
                    }
                }
            },
            distinct: ['categoryId']
        });
        return distinctCategories
            .map(item => item.category)
            .filter(cat => cat !== null);
    }
    async getShopProducts(shopIdOrSlug, params) {
        const shopId = await this.resolveShopId(shopIdOrSlug);
        if (!shopId) {
            return {
                data: [],
                meta: {
                    total: 0,
                    page: 1,
                    limit: Number(params.limit) || 12,
                    last_page: 0
                }
            };
        }
        const { sort = 'newest', minPrice, maxPrice, categoryId, rating } = params;
        const { page, limit, skip } = (0, pagination_util_1.getPagination)(params.page, params.limit, { defaultLimit: 12 });
        const where = {
            shopId: shopId,
            status: 'ACTIVE',
        };
        if (params.shopCategoryId) {
            where.shopCategoryId = params.shopCategoryId;
        }
        if (categoryId) {
            where.categoryId = categoryId;
        }
        if (minPrice || maxPrice) {
            where.price = {};
            if (minPrice)
                where.price.gte = Number(minPrice);
            if (maxPrice)
                where.price.lte = Number(maxPrice);
        }
        if (rating) {
            where.rating = { gte: Number(rating) };
        }
        let orderBy = { createdAt: 'desc' };
        switch (sort) {
            case 'price_asc':
                orderBy = { price: 'asc' };
                break;
            case 'price_desc':
                orderBy = { price: 'desc' };
                break;
            case 'sales':
                orderBy = { salesCount: 'desc' };
                break;
            case 'rating':
                orderBy = { rating: 'desc' };
                break;
            default:
                orderBy = { createdAt: 'desc' };
        }
        const [products, total] = await Promise.all([
            this.prisma.product.findMany({
                where,
                take: Number(limit),
                skip,
                orderBy,
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    price: true,
                    originalPrice: true,
                    images: true,
                    rating: true,
                    salesCount: true,
                    stock: true,
                    createdAt: true
                }
            }),
            this.prisma.product.count({ where })
        ]);
        return {
            data: products,
            meta: {
                total,
                page: Number(page),
                limit: Number(limit),
                last_page: Math.ceil(total / Number(limit))
            }
        };
    }
    async getPublicProfile(idOrSlug) {
        const shop = await this.prisma.shop.findFirst({
            where: {
                OR: [
                    { id: idOrSlug },
                    { slug: idOrSlug }
                ]
            },
            select: {
                id: true,
                name: true,
                avatar: true,
                coverImage: true,
                description: true,
                rating: true,
                totalSales: true,
                status: true,
                createdAt: true,
                decoration: true,
                _count: {
                    select: { products: { where: { status: 'ACTIVE' } } }
                }
            }
        });
        if (!shop || shop.status !== client_1.ShopStatus.ACTIVE) {
            throw new common_1.NotFoundException('Cửa hàng không tồn tại hoặc đã bị khóa');
        }
        return {
            ...shop,
            totalProducts: shop._count.products
        };
    }
    async getShops(query) {
        const { page, limit, skip } = (0, pagination_util_1.getPagination)(query.page, query.limit);
        const search = query.search || '';
        const where = {
            status: 'ACTIVE',
        };
        if (search) {
            where.name = { contains: search };
        }
        const [shops, total] = await Promise.all([
            this.prisma.shop.findMany({
                where,
                skip,
                take: limit,
                select: {
                    id: true,
                    name: true,
                    avatar: true,
                    slug: true,
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.shop.count({ where }),
        ]);
        return {
            data: shops,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    async getShopVouchers(shopIdOrSlug) {
        const shopId = await this.resolveShopId(shopIdOrSlug);
        if (!shopId)
            return [];
        const now = new Date();
        return this.prisma.voucher.findMany({
            where: {
                shopId: shopId,
                isActive: true,
                startDate: { lte: now },
                endDate: { gte: now },
                usageCount: { lt: this.prisma.voucher.fields.usageLimit }
            },
            select: {
                id: true,
                code: true,
                description: true,
                type: true,
                amount: true,
                minOrderValue: true,
                endDate: true
            },
            orderBy: { endDate: 'asc' }
        });
    }
    async getShopByOwnerId(userId) {
        if (!userId) {
            console.error("LỖI: userId null/undefined");
            throw new common_1.BadRequestException("User ID không hợp lệ.");
        }
        const shop = await this.prisma.shop.findUnique({
            where: { ownerId: userId }
        });
        if (!shop)
            throw new common_1.BadRequestException('Tài khoản này chưa đăng ký Shop');
        return shop;
    }
    async updateShopProfile(userId, data) {
        const shop = await this.getShopByOwnerId(userId);
        const basicInfo = {};
        const sensitiveInfo = {};
        if (data.shopName)
            basicInfo.name = data.shopName;
        if (data.pickupAddress)
            basicInfo.pickupAddress = data.pickupAddress;
        if (data.description)
            basicInfo.description = data.description;
        if (data.avatar)
            basicInfo.avatar = data.avatar;
        if (data.cover)
            basicInfo.coverImage = data.cover;
        if (data.businessLicenseFront)
            sensitiveInfo.businessLicenseFront = data.businessLicenseFront;
        if (data.businessLicenseBack)
            sensitiveInfo.businessLicenseBack = data.businessLicenseBack;
        if (data.salesLicense)
            sensitiveInfo.salesLicense = data.salesLicense;
        if (data.trademarkCert)
            sensitiveInfo.trademarkCert = data.trademarkCert;
        if (data.distributorCert)
            sensitiveInfo.distributorCert = data.distributorCert;
        const updateData = { ...basicInfo };
        if (Object.keys(sensitiveInfo).length > 0) {
            const currentPending = shop.pendingDetails || {};
            updateData.pendingDetails = {
                ...currentPending,
                ...sensitiveInfo,
                updatedAt: new Date()
            };
        }
        const updatedShop = await this.prisma.shop.update({
            where: { id: shop.id },
            data: updateData,
        });
        return updatedShop;
    }
    async updateDecoration(userId, decoration) {
        const shop = await this.getShopByOwnerId(userId);
        return this.prisma.shop.update({
            where: { id: shop.id },
            data: { decoration }
        });
    }
    async getShopBySlug(slug) {
        const shop = await this.prisma.shop.findUnique({
            where: { slug },
            include: {
                products: { take: 10, where: { status: 'ACTIVE' } }
            }
        });
        if (!shop || shop.status !== 'ACTIVE')
            throw new common_1.NotFoundException('Shop không tồn tại hoặc đã bị khóa');
        return shop;
    }
};
exports.ShopService = ShopService;
exports.ShopService = ShopService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ShopService);
//# sourceMappingURL=shop.service.js.map