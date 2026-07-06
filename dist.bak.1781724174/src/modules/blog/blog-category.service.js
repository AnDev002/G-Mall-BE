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
exports.BlogCategoryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const slug_util_1 = require("../../common/utils/slug.util");
let BlogCategoryService = class BlogCategoryService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(data) {
        return this.prisma.blogCategory.create({
            data: {
                name: data.name,
                slug: (0, slug_util_1.generateSlug)(data.name),
                parentId: data.parentId || null,
            },
        });
    }
    async findAll() {
        return this.prisma.blogCategory.findMany({
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            include: {
                children: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
            },
        });
    }
    async reorder(items) {
        if (!Array.isArray(items) || items.length === 0)
            return { count: 0 };
        await this.prisma.$transaction(items.map((it) => this.prisma.blogCategory.update({
            where: { id: it.id },
            data: { sortOrder: it.sortOrder },
        })));
        return { count: items.length };
    }
    async update(id, data) {
        if (data.parentId && data.parentId === id) {
            throw new common_1.BadRequestException('Không thể chọn chính danh mục này làm cha');
        }
        if (data.parentId) {
            let cur = await this.prisma.blogCategory.findUnique({
                where: { id: data.parentId },
                select: { id: true, parentId: true },
            });
            const seen = new Set();
            while (cur && cur.parentId) {
                if (cur.parentId === id) {
                    throw new common_1.BadRequestException('Không thể chọn danh mục con/cháu làm cha (tạo vòng lặp)');
                }
                if (seen.has(cur.parentId))
                    break;
                seen.add(cur.parentId);
                cur = await this.prisma.blogCategory.findUnique({
                    where: { id: cur.parentId },
                    select: { id: true, parentId: true },
                });
            }
        }
        const updateData = {};
        if (data.name !== undefined)
            updateData.name = data.name;
        if (data.parentId !== undefined)
            updateData.parentId = data.parentId || null;
        return this.prisma.blogCategory.update({ where: { id }, data: updateData });
    }
    async remove(id) {
        return this.prisma.blogCategory.delete({ where: { id } });
    }
};
exports.BlogCategoryService = BlogCategoryService;
exports.BlogCategoryService = BlogCategoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BlogCategoryService);
//# sourceMappingURL=blog-category.service.js.map