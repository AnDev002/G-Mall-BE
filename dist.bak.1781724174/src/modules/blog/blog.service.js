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
exports.BlogService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const slug_util_1 = require("../../common/utils/slug.util");
const sanitize_util_1 = require("../../common/utils/sanitize.util");
let BlogService = class BlogService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async generateUniqueSlug(title, currentSlug, excludeId) {
        const base = currentSlug || (0, slug_util_1.generateSlug)(title);
        let candidate = base;
        let counter = 1;
        while (true) {
            const conflict = await this.prisma.blogPost.findUnique({ where: { slug: candidate } });
            if (!conflict || (excludeId && conflict.id === excludeId))
                return candidate;
            candidate = `${base}-${counter}`;
            counter++;
        }
    }
    async create(userId, createBlogDto) {
        const { relatedProductIds, slug, title, keywords, categoryId, status, ...restData } = createBlogDto;
        const finalSlug = await this.generateUniqueSlug(title, slug);
        return this.prisma.blogPost.create({
            data: {
                title,
                content: (0, sanitize_util_1.sanitizeHtml)(restData.content),
                excerpt: restData.excerpt !== undefined ? (0, sanitize_util_1.sanitizeHtml)(restData.excerpt) : undefined,
                thumbnail: (0, sanitize_util_1.sanitizeUrl)(restData.thumbnail),
                metaTitle: restData.metaTitle,
                metaDescription: restData.metaDescription,
                status: status || 'DRAFT',
                slug: finalSlug,
                keywords: Array.isArray(keywords) ? JSON.stringify(keywords) : keywords,
                author: { connect: { id: userId } },
                category: categoryId ? { connect: { id: categoryId } } : undefined,
                relatedProducts: relatedProductIds?.length
                    ? { connect: relatedProductIds.map((id) => ({ id })) }
                    : undefined,
            },
        });
    }
    async findAll(query) {
        const { page = 1, limit = 10, search, category, status } = query;
        const skip = (page - 1) * limit;
        const andConditions = [];
        if (search) {
            andConditions.push({ title: { contains: search } });
        }
        if (status) {
            andConditions.push({ status });
        }
        if (category) {
            const rootCategory = await this.prisma.blogCategory.findFirst({
                where: { OR: [{ id: category }, { slug: category }] },
                include: { children: true },
            });
            if (rootCategory) {
                const categoryIds = [
                    rootCategory.id,
                    ...(rootCategory.children?.map(c => c.id) || [])
                ];
                andConditions.push({
                    categoryId: { in: categoryIds }
                });
            }
            else {
                return {
                    data: [],
                    meta: { total: 0, page, limit, totalPages: 0 }
                };
            }
        }
        const whereCondition = {
            AND: andConditions,
        };
        const [total, data] = await Promise.all([
            this.prisma.blogPost.count({ where: whereCondition }),
            this.prisma.blogPost.findMany({
                where: whereCondition,
                skip,
                take: Number(limit),
                orderBy: [
                    { sortOrder: 'asc' },
                    { createdAt: 'desc' }
                ],
                include: {
                    author: { select: { id: true, name: true, avatar: true } },
                    category: { select: { id: true, name: true, slug: true } },
                },
            }),
        ]);
        return {
            data: data.map(blog => ({
                ...blog,
                keywords: blog.keywords ? JSON.parse(blog.keywords) : [],
            })),
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }
    async updateOrder(items) {
        return this.prisma.$transaction(items.map((item) => this.prisma.blogPost.update({
            where: { id: item.id },
            data: { sortOrder: item.sortOrder },
        })));
    }
    async findOne(idOrSlug, publicOnly = false) {
        const blog = await this.prisma.blogPost.findFirst({
            where: {
                AND: [
                    { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
                    ...(publicOnly ? [{ status: 'PUBLISHED' }] : []),
                ],
            },
            include: {
                author: { select: { id: true, name: true, avatar: true } },
                category: true,
                relatedProducts: {
                    select: { id: true, name: true, images: true, price: true, slug: true },
                },
            },
        });
        if (!blog)
            throw new common_1.NotFoundException('Blog post not found');
        return {
            ...blog,
            keywords: blog.keywords ? JSON.parse(blog.keywords) : [],
        };
    }
    async update(id, updateBlogDto) {
        const { relatedProductIds, title, slug, keywords, categoryId, status, ...restData } = updateBlogDto;
        const existingBlog = await this.prisma.blogPost.findUnique({ where: { id } });
        if (!existingBlog)
            throw new common_1.NotFoundException('Blog post not found');
        let finalSlug = existingBlog.slug;
        if (slug || (title && title !== existingBlog.title)) {
            const candidate = slug || (0, slug_util_1.generateSlug)(title || existingBlog.title);
            if (candidate !== existingBlog.slug) {
                finalSlug = await this.generateUniqueSlug(title || existingBlog.title, candidate, id);
            }
        }
        return this.prisma.blogPost.update({
            where: { id },
            data: {
                ...restData,
                content: restData.content !== undefined ? (0, sanitize_util_1.sanitizeHtml)(restData.content) : undefined,
                excerpt: restData.excerpt !== undefined ? (0, sanitize_util_1.sanitizeHtml)(restData.excerpt) : undefined,
                thumbnail: restData.thumbnail !== undefined ? (0, sanitize_util_1.sanitizeUrl)(restData.thumbnail) : undefined,
                title,
                slug: finalSlug,
                keywords: Array.isArray(keywords) ? JSON.stringify(keywords) : undefined,
                status: status,
                category: categoryId
                    ? { connect: { id: categoryId } }
                    : categoryId === null ? { disconnect: true } : undefined,
                relatedProducts: relatedProductIds
                    ? { set: relatedProductIds.map((pid) => ({ id: pid })) }
                    : undefined,
            },
        });
    }
    async remove(id) {
        await this.prisma.blogPost.delete({ where: { id } });
        return { message: 'Blog deleted' };
    }
};
exports.BlogService = BlogService;
exports.BlogService = BlogService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BlogService);
//# sourceMappingURL=blog.service.js.map