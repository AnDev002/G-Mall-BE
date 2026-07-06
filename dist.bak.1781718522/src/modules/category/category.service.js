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
exports.CategoryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const slug_util_1 = require("../../common/utils/slug.util");
let CategoryService = class CategoryService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getCategories(parentId) {
        const categories = await this.prisma.category.findMany({
            where: {
                parentId: parentId || null,
            },
            select: {
                id: true,
                name: true,
                slug: true,
                parentId: true,
                _count: {
                    select: { children: true },
                },
            },
            orderBy: [{ order: 'asc' }, { name: 'asc' }],
        });
        return categories.map((cat) => ({
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            parentId: cat.parentId,
            hasChildren: cat._count.children > 0,
        }));
    }
    async searchCategories(keyword) {
        if (!keyword)
            return [];
        const categories = await this.prisma.category.findMany({
            where: {
                name: {
                    contains: keyword,
                },
            },
            include: {
                parent: {
                    include: {
                        parent: {
                            include: {
                                parent: true,
                            },
                        },
                    },
                },
            },
            take: 20,
        });
        const buildPath = (cat) => {
            if (!cat.parent)
                return cat.name;
            return `${buildPath(cat.parent)} > ${cat.name}`;
        };
        return categories.map((cat) => ({
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            path: buildPath(cat),
        }));
    }
    async getCategoryTreeBySlug(slug) {
        return this.prisma.category.findUnique({
            where: { slug },
            include: {
                parent: {
                    include: {
                        parent: {
                            include: { parent: true }
                        }
                    }
                }
            }
        });
    }
    async updateOrder(dto) {
        const { parentId, orderedIds } = dto;
        const targetParentId = parentId || null;
        if (targetParentId && orderedIds.includes(targetParentId)) {
            throw new common_1.BadRequestException('Danh mục cha không được nằm trong danh sách cần sắp xếp (gây vòng lặp)');
        }
        const idsToCheck = targetParentId ? [...orderedIds, targetParentId] : orderedIds;
        const existing = await this.prisma.category.findMany({
            where: { id: { in: idsToCheck } },
            select: { id: true },
        });
        const existingIds = new Set(existing.map((c) => c.id));
        const missing = idsToCheck.filter((id) => !existingIds.has(id));
        if (missing.length > 0) {
            throw new common_1.BadRequestException(`Danh mục không tồn tại: ${missing.join(', ')}`);
        }
        if (targetParentId) {
            const orderedSet = new Set(orderedIds);
            const seen = new Set();
            let cur = await this.prisma.category.findUnique({
                where: { id: targetParentId },
                select: { id: true, parentId: true },
            });
            while (cur && cur.parentId) {
                if (orderedSet.has(cur.parentId)) {
                    throw new common_1.BadRequestException('Không thể gán danh mục con/cháu làm cha (tạo vòng lặp)');
                }
                if (seen.has(cur.parentId))
                    break;
                seen.add(cur.parentId);
                cur = await this.prisma.category.findUnique({
                    where: { id: cur.parentId },
                    select: { id: true, parentId: true },
                });
            }
        }
        try {
            const updateOperations = orderedIds.map((id, index) => {
                return this.prisma.category.update({
                    where: { id },
                    data: {
                        order: index,
                        parentId: targetParentId,
                    },
                });
            });
            await this.prisma.$transaction(updateOperations);
            return {
                success: true,
                message: 'Cập nhật thứ tự danh mục thành công',
                count: orderedIds.length
            };
        }
        catch (error) {
            throw new common_1.InternalServerErrorException('Không thể cập nhật thứ tự danh mục');
        }
    }
    async getCategoryTree() {
        return this.prisma.category.findMany({
            where: { parentId: null },
            orderBy: { order: 'asc' },
            include: {
                children: {
                    orderBy: { order: 'asc' },
                    include: {
                        children: {
                            orderBy: { order: 'asc' },
                            include: {
                                children: {
                                    orderBy: { order: 'asc' },
                                    include: {
                                        children: {
                                            orderBy: { order: 'asc' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    }
    async getAllDescendantIds(rootId) {
        const allCategories = await this.prisma.category.findMany({
            select: { id: true, parentId: true }
        });
        const resultIds = [rootId];
        const queue = [rootId];
        while (queue.length > 0) {
            const currentId = queue.shift();
            const children = allCategories.filter(c => c.parentId === currentId);
            for (const child of children) {
                resultIds.push(child.id);
                queue.push(child.id);
            }
        }
        return resultIds;
    }
    async create(data) {
        const slug = data.slug || this.generateSlug(data.name);
        const exist = await this.prisma.category.findUnique({ where: { slug } });
        if (exist) {
            throw new common_1.BadRequestException(`Slug '${slug}' đã tồn tại. Vui lòng chọn tên khác.`);
        }
        return this.prisma.category.create({
            data: {
                name: data.name,
                slug: slug,
                parentId: data.parentId && data.parentId.length > 0 ? data.parentId : null,
                ...(data.filterKeys !== undefined ? { filterKeys: data.filterKeys } : {}),
            }
        });
    }
    async update(id, data) {
        const category = await this.prisma.category.findUnique({ where: { id } });
        if (!category)
            throw new common_1.NotFoundException('Danh mục không tồn tại');
        if (data.parentId && data.parentId === id) {
            throw new common_1.BadRequestException('Không thể chọn chính danh mục này làm cha');
        }
        if (data.parentId && data.parentId !== 'ROOT') {
            let cur = await this.prisma.category.findUnique({ where: { id: data.parentId }, select: { id: true, parentId: true } });
            if (!cur)
                throw new common_1.BadRequestException('Danh mục cha không tồn tại');
            const seen = new Set();
            while (cur && cur.parentId) {
                if (cur.parentId === id)
                    throw new common_1.BadRequestException('Không thể chọn danh mục con/cháu làm cha (tạo vòng lặp)');
                if (seen.has(cur.parentId))
                    break;
                seen.add(cur.parentId);
                cur = await this.prisma.category.findUnique({ where: { id: cur.parentId }, select: { id: true, parentId: true } });
            }
        }
        return this.prisma.category.update({
            where: { id },
            data: {
                name: data.name,
                slug: data.slug,
                parentId: data.parentId === 'ROOT' ? null : data.parentId,
                ...(data.filterKeys !== undefined ? { filterKeys: data.filterKeys } : {}),
            }
        });
    }
    async remove(id) {
        const existing = await this.prisma.category.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException('Danh mục không tồn tại');
        const idsToDelete = await this.getAllDescendantIds(id);
        const countProduct = await this.prisma.product.count({
            where: {
                categoryId: { in: idsToDelete }
            }
        });
        if (countProduct > 0) {
            throw new common_1.BadRequestException(`Đang có ${countProduct} sản phẩm thuộc danh mục này hoặc các danh mục con. Không thể xóa.`);
        }
        return this.prisma.category.deleteMany({
            where: {
                id: { in: idsToDelete }
            }
        });
    }
    async updateBatch(items) {
        const results = [];
        for (const item of items) {
            if (item.id) {
                try {
                    const updated = await this.prisma.category.update({
                        where: { id: item.id },
                        data: {
                            name: item.name,
                            slug: item.slug,
                            parentId: item.parentId || null
                        }
                    });
                    results.push(updated);
                }
                catch (e) {
                    console.error(`Failed to update ${item.id}`, e);
                }
            }
        }
        return results;
    }
    generateSlug(text) {
        return text.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
    }
    async getBreadcrumbs(categoryId) {
        const breadcrumbs = [];
        let currentId = categoryId;
        let iterations = 0;
        while (currentId && iterations < 10) {
            const cat = await this.prisma.category.findUnique({
                where: { id: currentId },
                select: { id: true, name: true, slug: true, parentId: true },
            });
            if (!cat)
                break;
            breadcrumbs.unshift({ id: cat.id, name: cat.name, slug: cat.slug });
            currentId = cat.parentId;
            iterations++;
        }
        return breadcrumbs;
    }
    async getDescendantIds(categoryId) {
        const result = new Set([categoryId]);
        let frontier = [categoryId];
        let depth = 0;
        while (frontier.length > 0 && depth < 10) {
            const children = await this.prisma.category.findMany({
                where: { parentId: { in: frontier } },
                select: { id: true },
            });
            const childIds = children.map(c => c.id).filter(id => !result.has(id));
            if (childIds.length === 0)
                break;
            childIds.forEach(id => result.add(id));
            frontier = childIds;
            depth++;
        }
        return Array.from(result);
    }
    async fixAllSlugs() {
        const categories = await this.prisma.category.findMany();
        let count = 0;
        for (const cat of categories) {
            const newSlug = (0, slug_util_1.generateSlug)(cat.name);
            if (newSlug !== cat.slug) {
                try {
                    await this.prisma.category.update({
                        where: { id: cat.id },
                        data: { slug: newSlug }
                    });
                    count++;
                }
                catch (e) {
                    console.error(`Lỗi update slug cho danh mục ${cat.name}:`, e);
                }
            }
        }
        return { message: `Đã sửa lỗi slug thành công cho ${count} danh mục.` };
    }
};
exports.CategoryService = CategoryService;
exports.CategoryService = CategoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CategoryService);
//# sourceMappingURL=category.service.js.map