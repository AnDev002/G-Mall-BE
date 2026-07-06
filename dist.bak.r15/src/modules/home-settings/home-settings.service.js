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
exports.HomeSettingsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const category_service_1 = require("../category/category.service");
let HomeSettingsService = class HomeSettingsService {
    prisma;
    categoryService;
    constructor(prisma, categoryService) {
        this.prisma = prisma;
        this.categoryService = categoryService;
    }
    async getProductsByCategory(categoryId, limit = 6) {
        if (!categoryId)
            return [];
        const descendantIds = await this.categoryService.getAllDescendantIds(categoryId);
        const categoryIds = [...descendantIds, categoryId];
        return this.prisma.product.findMany({
            where: {
                categoryId: { in: categoryIds },
                status: 'ACTIVE'
            },
            orderBy: { createdAt: 'desc' },
            include: {
                variants: true,
                category: true
            },
            take: limit
        });
    }
    async getDataForColumn(columnConfig, limit = 30) {
        if (!columnConfig)
            return [];
        if (columnConfig.sourceType === 'MANUAL' && Array.isArray(columnConfig.productIds) && columnConfig.productIds.length > 0) {
            return this.prisma.product.findMany({
                where: {
                    id: { in: columnConfig.productIds },
                    status: 'ACTIVE'
                },
                include: {
                    variants: true,
                    category: true
                },
                take: limit
            });
        }
        return this.getProductsByCategory(columnConfig.categoryId, limit);
    }
    async getHomeLayout() {
        const sections = await this.prisma.homeSection.findMany({
            where: { isActive: true },
            orderBy: { order: 'asc' },
            include: { category: true }
        });
        const enrichedSections = await Promise.all(sections.map(async (section) => {
            let products = [];
            const config = section.config || {};
            if (section.type === 'CATEGORY_TWO_ROW') {
                const fetchLimit = 30;
                const [leftProducts, rightProducts] = await Promise.all([
                    this.getDataForColumn(config.left, fetchLimit),
                    this.getDataForColumn(config.right, fetchLimit)
                ]);
                if (config.left)
                    config.left.products = leftProducts;
                if (config.right)
                    config.right.products = rightProducts;
                return { ...section, config };
            }
            const sourceType = config.sourceType || 'CATEGORY';
            if (sourceType === 'MANUAL' && config.productIds?.length > 0) {
                products = await this.prisma.product.findMany({
                    where: { id: { in: config.productIds }, status: 'ACTIVE' },
                    include: { variants: true, category: true },
                    take: 12
                });
            }
            else if (section.categoryId) {
                products = await this.getProductsByCategory(section.categoryId, 12);
            }
            return {
                ...section,
                products,
            };
        }));
        return enrichedSections;
    }
    async getAllSections() {
        return this.prisma.homeSection.findMany({ orderBy: { order: 'asc' } });
    }
    cleanInput(data) {
        return {
            title: data.title || 'Untitled Section',
            type: data.type,
            isActive: data.isActive !== undefined ? data.isActive : true,
            categoryId: (data.categoryId && data.categoryId.length > 0) ? data.categoryId : null,
            config: {
                ...(data.config || {}),
                productIds: data.productIds || [],
                sourceType: data.sourceType || 'CATEGORY'
            }
        };
    }
    async createSection(data) {
        const lastItem = await this.prisma.homeSection.findFirst({ orderBy: { order: 'desc' } });
        const newOrder = lastItem ? lastItem.order + 1 : 0;
        const cleanData = this.cleanInput(data);
        return this.prisma.homeSection.create({
            data: {
                ...cleanData,
                order: newOrder,
            },
        });
    }
    async updateSection(id, data) {
        const cleanData = this.cleanInput(data);
        return this.prisma.homeSection.update({
            where: { id },
            data: cleanData,
        });
    }
    async deleteSection(id) {
        return this.prisma.homeSection.delete({ where: { id } });
    }
    async reorderSections(ids) {
        return this.prisma.$transaction(ids.map((id, index) => this.prisma.homeSection.update({
            where: { id },
            data: { order: index },
        })));
    }
};
exports.HomeSettingsService = HomeSettingsService;
exports.HomeSettingsService = HomeSettingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, category_service_1.CategoryService])
], HomeSettingsService);
//# sourceMappingURL=home-settings.service.js.map