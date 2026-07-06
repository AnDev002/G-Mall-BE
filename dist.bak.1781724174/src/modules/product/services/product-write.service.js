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
var ProductWriteService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductWriteService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const product_cache_service_1 = require("./product-cache.service");
const client_1 = require("@prisma/client");
const product_read_service_1 = require("./product-read.service");
const image_search_service_1 = require("../../image-search/image-search.service");
let ProductWriteService = ProductWriteService_1 = class ProductWriteService {
    prisma;
    productCache;
    productReadService;
    imageSearch;
    logger = new common_1.Logger(ProductWriteService_1.name);
    constructor(prisma, productCache, productReadService, imageSearch) {
        this.prisma = prisma;
        this.productCache = productCache;
        this.productReadService = productReadService;
        this.imageSearch = imageSearch;
    }
    safeEnqueueIndex(productId) {
        this.imageSearch.enqueueIndex(productId).catch((err) => this.logger.warn(`image-search enqueue ${productId} failed: ${err.message}`));
    }
    async create(userId, dto) {
        const shop = await this.prisma.shop.findUnique({
            where: { ownerId: userId }
        });
        if (!shop) {
            throw new common_1.ForbiddenException('Bạn chưa đăng ký Cửa hàng (Shop). Vui lòng đăng ký trước khi tạo sản phẩm.');
        }
        if (shop.status === 'BANNED' || shop.status === 'PENDING') {
            throw new common_1.ForbiddenException(`Shop của bạn đang ở trạng thái: ${shop.status}. Không thể đăng bán.`);
        }
        const { crossSellIds, tiers, variations, images, price, videos, sizeChart, brand, origin, weight, length, width, height, attributes, brandId, categoryId, systemTags, shortDesc, ...rest } = dto;
        const shortDescJson = shortDesc ? { ...shortDesc } : undefined;
        if (tiers && tiers.length > 0 && (!variations || variations.length === 0)) {
            throw new common_1.BadRequestException('Phải thiết lập biến thể SKU khi có nhóm phân loại');
        }
        let finalAttributes = attributes;
        try {
            const attrObj = typeof attributes === 'string' ? JSON.parse(attributes) : (attributes || {});
            Object.assign(attrObj, {
                videos, sizeChart, brand, origin, weight,
                dimensions: { length, width, height },
                systemTags
            });
            finalAttributes = JSON.stringify(attrObj);
        }
        catch (e) {
            finalAttributes = JSON.stringify({ ...attributes, videos, sizeChart });
        }
        const totalStock = variations?.length
            ? variations.reduce((sum, v) => sum + Number(v.stock), 0)
            : Number(dto.stock || 0);
        const imageList = Array.isArray(images) ? images : [];
        const result = await this.prisma.$transaction(async (tx) => {
            const product = await tx.product.create({
                data: {
                    ...rest,
                    category: { connect: { id: categoryId } },
                    shop: {
                        connect: { id: shop.id }
                    },
                    brandRel: brandId ? { connect: { id: brandId } } : undefined,
                    price: new client_1.Prisma.Decimal(price || 0),
                    stock: totalStock,
                    slug: this.generateSlug(dto.name),
                    images: imageList,
                    attributes: finalAttributes,
                    ...(shortDescJson ? { shortDesc: shortDescJson } : {}),
                    status: (dto.status === 'DRAFT' ? 'DRAFT' : 'PENDING'),
                },
            });
            if (crossSellIds && crossSellIds.length > 0) {
                const uniqueIds = [...new Set(crossSellIds)];
                await tx.productCrossSell.createMany({
                    data: uniqueIds.map(relId => ({
                        productId: product.id,
                        relatedProductId: relId
                    }))
                });
            }
            if (tiers && tiers.length > 0) {
                for (let i = 0; i < tiers.length; i++) {
                    const tierImages = tiers[i].images || [];
                    if (tiers[i].options && tiers[i].options.length > 0) {
                        await tx.productOption.create({
                            data: {
                                productId: product.id,
                                name: tiers[i].name,
                                position: i,
                                values: {
                                    create: tiers[i].options.map((val, idx) => ({
                                        value: val,
                                        image: tierImages[idx] || null,
                                        position: idx
                                    }))
                                }
                            }
                        });
                    }
                }
                if (variations && variations.length > 0) {
                    await tx.productVariant.createMany({
                        data: variations.map(v => ({
                            productId: product.id,
                            price: new client_1.Prisma.Decimal(v.price),
                            stock: Number(v.stock),
                            sku: v.sku,
                            image: v.imageUrl || null,
                            tierIndex: Array.isArray(v.tierIndex) ? v.tierIndex.join(',') : '',
                        }))
                    });
                }
            }
            else {
                await tx.productVariant.create({
                    data: {
                        productId: product.id,
                        price: new client_1.Prisma.Decimal(price || 0),
                        stock: Number(dto.stock || 0),
                        sku: rest.sku || '',
                        tierIndex: '',
                    }
                });
            }
            const finalProduct = await tx.product.findUnique({
                where: { id: product.id },
                include: {
                    options: { include: { values: true } },
                    variants: true
                }
            });
            return finalProduct;
        });
        if (result?.id)
            this.safeEnqueueIndex(result.id);
        return result;
    }
    async updateProductTags(id, systemTags) {
        const product = await this.prisma.product.findUnique({ where: { id } });
        if (!product) {
            throw new common_1.NotFoundException('Product not found');
        }
        const updatedProduct = await this.prisma.product.update({
            where: { id },
            data: { systemTags },
            include: {
                shop: { select: { id: true, name: true, avatar: true } },
                category: true
            }
        });
        await this.productReadService.syncProductToRedis(updatedProduct);
        return updatedProduct;
    }
    async approveProduct(productId, status, reason) {
        const updatedProduct = await this.prisma.product.update({
            where: { id: productId },
            data: {
                status: status,
                rejectReason: status === 'REJECTED' ? reason : null
            },
            include: {
                shop: { select: { id: true, name: true, avatar: true } },
                variants: true,
            }
        });
        await this.productCache.invalidateProduct(productId);
        if (status === 'ACTIVE') {
            await this.productReadService.syncProductToRedis(updatedProduct);
        }
        else if (status === 'REJECTED') {
            await this.productReadService.syncProductToRedis(updatedProduct);
        }
        this.safeEnqueueIndex(productId);
        return updatedProduct;
    }
    async bulkApproveProducts(ids, status, reason) {
        if (!ids || ids.length === 0)
            return { count: 0 };
        await this.prisma.product.updateMany({
            where: { id: { in: ids } },
            data: {
                status: status,
                rejectReason: status === 'REJECTED' ? reason : null
            }
        });
        const products = await this.prisma.product.findMany({
            where: { id: { in: ids } },
            include: {
                shop: { select: { id: true, name: true, avatar: true } }
            }
        });
        await Promise.all(products.map(async (product) => {
            await this.productCache.invalidateProduct(product.id);
            await this.productReadService.syncProductToRedis(product);
            this.safeEnqueueIndex(product.id);
        }));
        return { count: ids.length };
    }
    async delete(id) { return this.bulkDelete([id]); }
    async bulkDelete(ids) {
        if (!ids || ids.length === 0)
            return { count: 0 };
        const productsToDelete = await this.prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, slug: true } });
        await this.prisma.$transaction(async (tx) => {
            await this.safeDelete(tx, 'flashSaleProduct', { productId: { in: ids } });
            await this.safeDelete(tx, 'productReview', { productId: { in: ids } });
            await this.safeDelete(tx, 'cartItem', { productId: { in: ids } });
            await tx.product.deleteMany({ where: { id: { in: ids } } });
        }, { maxWait: 10000, timeout: 20000 });
        for (const p of productsToDelete) {
            this.imageSearch.enqueueDelete(p.id).catch(() => undefined);
        }
        this.clearCacheBackground(productsToDelete);
        return { count: ids.length, message: `Đã xoá ${ids.length} sản phẩm` };
    }
    async clearCacheBackground(products) {
        Promise.all(products.map(async (p) => {
            try {
                await this.productReadService.removeProductFromRedis(p.id, p.name);
                await this.productCache.invalidateProduct(p.id, p.slug);
            }
            catch (e) { }
        })).then(() => this.logger.log(`Cleaned cache for ${products.length} items`));
    }
    async deleteAll() {
        const allProducts = await this.prisma.product.findMany({ select: { id: true, name: true, slug: true } });
        if (allProducts.length === 0)
            return { count: 0, message: 'Hệ thống trống.' };
        this.logger.warn(`Đang xoá toàn bộ ${allProducts.length} sản phẩm...`);
        await this.prisma.$transaction(async (tx) => {
            await this.safeDelete(tx, 'flashSaleProduct', {});
            await this.safeDelete(tx, 'productReview', {});
            await this.safeDelete(tx, 'cartItem', {});
            await tx.product.deleteMany({});
        }, { timeout: 60000 });
        this.clearCacheBackground(allProducts);
        return { count: allProducts.length, message: 'Đã xoá sạch toàn bộ hệ thống!' };
    }
    async safeDelete(tx, modelName, where) {
        try {
            if (tx[modelName]) {
                await tx[modelName].deleteMany({ where });
            }
        }
        catch (e) {
        }
    }
    async update(id, userId, dto) {
        const shop = await this.prisma.shop.findUnique({ where: { ownerId: userId } });
        if (!shop)
            throw new common_1.ForbiddenException('Bạn không có quyền quản lý sản phẩm này');
        const exists = await this.prisma.product.findFirst({
            where: { id, shopId: shop.id }
        });
        if (!exists)
            throw new common_1.NotFoundException('Sản phẩm không tồn tại hoặc không thuộc Shop của bạn');
        const { images, price, brandId, tiers, variations, crossSellIds, systemTags, categoryId, videos, sizeChart, brand, origin, weight, length: lenDim, width, height, attributes, shortDesc, ...rest } = dto;
        const updateData = { ...rest };
        if (shortDesc !== undefined)
            updateData.shortDesc = shortDesc ? { ...shortDesc } : null;
        if (price !== undefined)
            updateData.price = new client_1.Prisma.Decimal(price);
        if (brandId !== undefined) {
            updateData.brandRel = { connect: { id: brandId } };
        }
        if (brand !== undefined)
            updateData.brand = brand;
        if (images !== undefined)
            updateData.images = Array.isArray(images) ? images : [];
        if (categoryId !== undefined)
            updateData.category = { connect: { id: categoryId } };
        if (attributes !== undefined || videos !== undefined || sizeChart !== undefined ||
            weight !== undefined || lenDim !== undefined || width !== undefined || height !== undefined ||
            origin !== undefined || systemTags !== undefined) {
            try {
                const attrObj = typeof attributes === 'string' ? JSON.parse(attributes) : (attributes || {});
                Object.assign(attrObj, {
                    ...(videos !== undefined ? { videos } : {}),
                    ...(sizeChart !== undefined ? { sizeChart } : {}),
                    ...(brand !== undefined ? { brand } : {}),
                    ...(origin !== undefined ? { origin } : {}),
                    ...(weight !== undefined ? { weight } : {}),
                    ...(lenDim !== undefined || width !== undefined || height !== undefined
                        ? { dimensions: { length: lenDim, width, height } }
                        : {}),
                    ...(systemTags !== undefined ? { systemTags } : {}),
                });
                updateData.attributes = JSON.stringify(attrObj);
            }
            catch {
            }
        }
        const updated = await this.prisma.product.update({
            where: { id },
            data: updateData,
        });
        if (crossSellIds !== undefined) {
            await this.prisma.productCrossSell.deleteMany({ where: { productId: id } });
            const uniqueIds = [...new Set(crossSellIds)].filter((rid) => rid && rid !== id);
            if (uniqueIds.length > 0) {
                await this.prisma.productCrossSell.createMany({
                    data: uniqueIds.map((relId) => ({ productId: id, relatedProductId: relId })),
                });
            }
        }
        await this.productCache.invalidateProduct(id);
        if (images !== undefined)
            this.safeEnqueueIndex(id);
        return updated;
    }
    async findOneForEdit(userId, productId) {
        const shop = await this.prisma.shop.findUnique({ where: { ownerId: userId } });
        if (!shop)
            throw new common_1.ForbiddenException('Bạn không có quyền quản lý sản phẩm này');
        const product = await this.prisma.product.findFirst({
            where: { id: productId, shopId: shop.id },
            include: {
                options: { include: { values: true }, orderBy: { position: 'asc' } },
                variants: true,
                crossSells: { select: { relatedProductId: true } },
            },
        });
        if (!product) {
            throw new common_1.NotFoundException('Sản phẩm không tồn tại hoặc không thuộc Shop của bạn');
        }
        let attrs = {};
        try {
            attrs = typeof product.attributes === 'string'
                ? JSON.parse(product.attributes)
                : (product.attributes || {});
        }
        catch {
            attrs = {};
        }
        const dims = attrs.dimensions || {};
        return {
            ...product,
            price: Number(product.price),
            originalPrice: product.originalPrice != null ? Number(product.originalPrice) : null,
            brand: attrs.brand ?? '',
            origin: attrs.origin ?? '',
            videos: Array.isArray(attrs.videos) ? attrs.videos : [],
            sizeChart: attrs.sizeChart ?? null,
            length: Number(dims.length ?? 0),
            width: Number(dims.width ?? 0),
            height: Number(dims.height ?? 0),
            crossSellProducts: product.crossSells.map((cs) => ({ id: cs.relatedProductId })),
        };
    }
    async searchMyProducts(userId, keyword, limit = 10) {
        const shop = await this.prisma.shop.findUnique({ where: { ownerId: userId } });
        if (!shop)
            return [];
        return this.prisma.product.findMany({
            where: {
                shopId: shop.id,
                name: {
                    contains: keyword ? keyword.trim() : ''
                },
                status: 'ACTIVE',
            },
            take: limit,
            select: {
                id: true,
                name: true,
                price: true,
                images: true,
                stock: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }
    async updateDiscount(sellerId, productId, dto) {
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
            include: { variants: true }
        });
        if (!product)
            throw new common_1.NotFoundException('Sản phẩm không tồn tại');
        const shop = await this.prisma.shop.findUnique({ where: { ownerId: sellerId } });
        if (!shop || product.shopId !== shop.id) {
            throw new common_1.ForbiddenException('Bạn không có quyền chỉnh sửa sản phẩm này');
        }
        const variantUpdates = [];
        if (dto.isDiscountActive && dto.variants && dto.variants.length > 0) {
            for (const vDto of dto.variants) {
                const currentVariant = product.variants.find(v => v.id === vDto.id);
                if (!currentVariant)
                    continue;
                const discountPercent = Number(vDto.discountValue);
                if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
                    throw new common_1.BadRequestException('Phần trăm giảm giá của biến thể phải trong khoảng 0–100');
                }
                const vOriginalPrice = Number(currentVariant.originalPrice ?? currentVariant.price);
                const vNewPrice = Math.round(vOriginalPrice * (1 - discountPercent / 100));
                variantUpdates.push({
                    id: vDto.id,
                    price: vNewPrice,
                    originalPrice: vOriginalPrice,
                    discountValue: discountPercent,
                });
            }
        }
        const touchDiscount = dto.isDiscountActive !== undefined;
        let originalPrice = Number(product.originalPrice ?? product.price);
        let finalPrice = originalPrice;
        let parentDiscountValue = Number(product.discountValue ?? 0);
        let parentDiscountPercent = 0;
        if (dto.isDiscountActive) {
            const dv = Number(dto.discountValue);
            if (!Number.isFinite(dv) || dv < 0 || dv > 100) {
                throw new common_1.BadRequestException('Phần trăm giảm giá phải trong khoảng 0–100');
            }
            finalPrice = Math.round(originalPrice * (1 - dv / 100));
            parentDiscountValue = dv;
            parentDiscountPercent = dv;
        }
        else if (touchDiscount) {
            finalPrice = originalPrice;
            parentDiscountValue = 0;
        }
        const payloadVariantIds = new Set(variantUpdates.map((vu) => vu.id));
        const updatedProduct = await this.prisma.$transaction(async (tx) => {
            if (dto.isDiscountActive) {
                for (const vu of variantUpdates) {
                    await tx.productVariant.update({
                        where: { id: vu.id },
                        data: {
                            price: vu.price,
                            originalPrice: vu.originalPrice,
                            discountValue: vu.discountValue,
                        },
                    });
                }
                for (const v of product.variants) {
                    if (payloadVariantIds.has(v.id))
                        continue;
                    const vOriginalPrice = Number(v.originalPrice ?? v.price);
                    const vNewPrice = Math.round(vOriginalPrice * (1 - parentDiscountPercent / 100));
                    await tx.productVariant.update({
                        where: { id: v.id },
                        data: {
                            price: vNewPrice,
                            originalPrice: vOriginalPrice,
                            discountValue: parentDiscountPercent,
                        },
                    });
                }
            }
            else if (touchDiscount && product.variants.length > 0) {
                for (const v of product.variants) {
                    await tx.productVariant.update({
                        where: { id: v.id },
                        data: {
                            discountValue: 0,
                            price: v.originalPrice ?? v.price,
                        },
                    });
                }
            }
            const parentData = touchDiscount
                ? {
                    originalPrice,
                    price: finalPrice,
                    discountValue: parentDiscountValue,
                    discountStartDate: dto.discountStartDate ? new Date(dto.discountStartDate) : null,
                    discountEndDate: dto.discountEndDate ? new Date(dto.discountEndDate) : null,
                    isDiscountActive: dto.isDiscountActive,
                    discountType: 'PERCENT',
                }
                : {};
            return tx.product.update({
                where: { id: productId },
                data: parentData,
                include: { variants: true, shop: true },
            });
        });
        await this.productCache.invalidateProduct(updatedProduct.id, updatedProduct.slug);
        await this.productReadService.syncProductToRedis(updatedProduct);
        return updatedProduct;
    }
    async deleteBySeller(userId, productId) {
        const shop = await this.prisma.shop.findUnique({ where: { ownerId: userId } });
        if (!shop)
            throw new common_1.ForbiddenException('Lỗi quyền');
        const product = await this.prisma.product.findFirst({ where: { id: productId, shopId: shop.id } });
        if (!product)
            throw new common_1.NotFoundException('Sản phẩm không tồn tại');
        return this.bulkDelete([productId]);
    }
    async findAllBySeller(userId, status, opts) {
        const shop = await this.prisma.shop.findUnique({ where: { ownerId: userId } });
        if (!shop)
            throw new common_1.NotFoundException("Shop không tồn tại");
        const page = Math.max(1, Number(opts?.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(opts?.limit) || 10));
        const search = opts?.search?.trim();
        const sortBy = ['createdAt', 'price', 'updatedAt'].includes(opts?.sortBy || '') ? opts.sortBy : 'createdAt';
        const sortOrder = opts?.sortOrder === 'asc' ? 'asc' : 'desc';
        const baseWhere = { shopId: shop.id };
        if (search) {
            baseWhere.name = { contains: search };
        }
        const statusWhere = { ...baseWhere };
        if (status && status !== 'ALL') {
            statusWhere.status = status;
        }
        const [data, total, statusGroup] = await this.prisma.$transaction([
            this.prisma.product.findMany({
                where: statusWhere,
                include: { _count: { select: { variants: true } } },
                orderBy: { [sortBy]: sortOrder },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.product.count({ where: statusWhere }),
            this.prisma.product.groupBy({
                by: ['status'],
                where: baseWhere,
                _count: { _all: true },
                orderBy: { status: 'asc' },
            }),
        ]);
        const counts = Object.fromEntries(statusGroup.map((g) => [g.status, g._count?._all ?? 0]));
        return { data, meta: { total, page, limit, counts } };
    }
    async findAllForAdmin() {
        return this.prisma.product.findMany({
            include: {
                shop: true,
            },
        });
    }
    generateSlug(name) {
        return name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/ /g, '-')
            .replace(/[^\w-]+/g, '') +
            '-' +
            Date.now();
    }
};
exports.ProductWriteService = ProductWriteService;
exports.ProductWriteService = ProductWriteService = ProductWriteService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        product_cache_service_1.ProductCacheService,
        product_read_service_1.ProductReadService,
        image_search_service_1.ImageSearchService])
], ProductWriteService);
//# sourceMappingURL=product-write.service.js.map