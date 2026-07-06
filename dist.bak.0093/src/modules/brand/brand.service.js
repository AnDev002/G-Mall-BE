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
exports.BrandService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const pagination_util_1 = require("../../common/utils/pagination.util");
let BrandService = class BrandService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAllAdmin(query) {
        const { search } = query;
        const { page, limit, skip } = (0, pagination_util_1.getPagination)(query.page, query.limit);
        const where = search
            ? { name: { contains: search } }
            : {};
        const [brands, total] = await Promise.all([
            this.prisma.brand.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    _count: {
                        select: { products: true },
                    },
                },
            }),
            this.prisma.brand.count({ where }),
        ]);
        const data = brands.map((b) => ({
            id: b.id,
            name: b.name,
            slug: b.slug,
            logoUrl: b.logoUrl,
            status: b.status,
            description: b.description,
            productCount: b._count.products,
        }));
        return {
            data,
            meta: {
                total,
                page,
                last_page: Math.ceil(total / limit),
            },
        };
    }
    async findAllActive() {
        return this.prisma.brand.findMany({
            where: { status: 'active' },
            select: {
                id: true,
                name: true,
                logoUrl: true,
            },
            orderBy: { name: 'asc' },
        });
    }
    async findActiveByCategoryIds(categoryIds, limit = 12) {
        if (!categoryIds || categoryIds.length === 0)
            return [];
        const products = await this.prisma.product.findMany({
            where: { categoryId: { in: categoryIds }, status: 'ACTIVE', brandId: { not: null } },
            select: { brandId: true },
        });
        const counts = new Map();
        for (const p of products) {
            if (p.brandId == null)
                continue;
            counts.set(p.brandId, (counts.get(p.brandId) || 0) + 1);
        }
        if (counts.size === 0)
            return [];
        const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, limit);
        const brandIds = sorted.map(([id]) => id);
        const brands = await this.prisma.brand.findMany({
            where: { id: { in: brandIds }, status: 'active' },
            select: { id: true, name: true, slug: true, logoUrl: true },
        });
        const map = new Map(brands.map(b => [b.id, b]));
        return sorted.map(([id, count]) => {
            const brand = map.get(id);
            return brand ? { ...brand, productCount: count } : null;
        }).filter(Boolean);
    }
    async create(dto) {
        const exists = await this.prisma.brand.findUnique({
            where: { slug: dto.slug },
        });
        if (exists) {
            throw new common_1.ConflictException('Brand slug already exists');
        }
        return this.prisma.brand.create({
            data: {
                ...dto,
                status: dto.status || 'active',
            },
        });
    }
    async update(id, dto) {
        await this.findById(id);
        if (dto.slug) {
            const exists = await this.prisma.brand.findUnique({ where: { slug: dto.slug } });
            if (exists && exists.id !== id)
                throw new common_1.ConflictException('Slug taken');
        }
        return this.prisma.brand.update({
            where: { id },
            data: dto,
        });
    }
    async delete(id) {
        const brand = await this.findById(id);
        const productCount = await this.prisma.product.count({
            where: { brandId: id }
        });
        if (productCount > 0) {
            throw new common_1.ConflictException(`Cannot delete brand. It has ${productCount} products.`);
        }
        return this.prisma.brand.delete({ where: { id } });
    }
    async toggleStatus(id) {
        const brand = await this.findById(id);
        const newStatus = brand.status === 'active' ? 'inactive' : 'active';
        return this.prisma.brand.update({
            where: { id },
            data: { status: newStatus }
        });
    }
    async findById(id) {
        const brand = await this.prisma.brand.findUnique({ where: { id } });
        if (!brand)
            throw new common_1.NotFoundException('Brand not found');
        return brand;
    }
};
exports.BrandService = BrandService;
exports.BrandService = BrandService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BrandService);
//# sourceMappingURL=brand.service.js.map