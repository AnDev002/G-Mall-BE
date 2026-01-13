// File: BE-4.3/modules/blog/blog.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { BlogQueryDto } from './dto/blog-query.dto';
import { generateSlug } from '../../common/utils/slug.util';
import { Prisma } from '@prisma/client';

@Injectable()
export class BlogService {
  constructor(private readonly prisma: PrismaService) {}

  private async generateUniqueSlug(title: string, currentSlug?: string): Promise<string> {
    let slug = currentSlug || generateSlug(title);
    if (currentSlug && slug === currentSlug) return slug;
    
    let uniqueSlug = slug;
    let counter = 1;
    while (await this.prisma.blogPost.findUnique({ where: { slug: uniqueSlug } })) {
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }
    return uniqueSlug;
  }

  // --- CREATE ---
  async create(userId: string, createBlogDto: CreateBlogDto) {
    // [FIX] Tách categoryId ra khỏi DTO vì trong Prisma nó là relation input
    // DTO có thể gửi lên 'category' là string ID
    const { relatedProductIds, slug, title, keywords, categoryId, status, ...restData } = createBlogDto as any; 

    const finalSlug = await this.generateUniqueSlug(title, slug);

    return this.prisma.blogPost.create({
      data: {
        title,
        content: restData.content,
        thumbnail: restData.thumbnail,
        metaTitle: restData.metaTitle,
        metaDescription: restData.metaDescription,
        status: status || 'DRAFT',
        slug: finalSlug,
        
        // [FIX] Keywords: Array -> JSON String
        keywords: Array.isArray(keywords) ? JSON.stringify(keywords) : keywords,
        
        author: { connect: { id: userId } },
        category: categoryId ? { connect: { id: categoryId } } : undefined,

        // [FIX] Related Products Relation
        relatedProducts: relatedProductIds?.length
          ? { connect: relatedProductIds.map((id) => ({ id })) }
          : undefined,
      },
    });
  }

  // --- FIND ALL ---
  async findAll(query: BlogQueryDto) {
    const { page = 1, limit = 10, search, category, status } = query;
    const skip = (page - 1) * limit;

    const whereCondition: Prisma.BlogPostWhereInput = {
      AND: [
        search ? { title: { contains: search } } : {},
        // [FIX] Category Filter Logic cho Relation
        // Nếu 'category' gửi lên là ID thì filter theo ID, nếu không thì bỏ qua
        category ? { category: { slug: category } } : {},
        status ? { status } : {},
      ],
    };

    const [total, data] = await Promise.all([
      this.prisma.blogPost.count({ where: whereCondition }),
      this.prisma.blogPost.findMany({
        where: whereCondition,
        skip,
        take: limit,
        orderBy: [
            { sortOrder: 'asc' }, 
            { createdAt: 'desc' }
        ],
        include: {
          author: { select: { id: true, name: true, avatar: true } },
          category: { select: { id: true, name: true, slug: true } }, // Include category info
        },
      }),
    ]);

    return {
      data: data.map(blog => ({
        ...blog,
        // Parse keywords JSON string -> Array
        keywords: blog.keywords ? JSON.parse(blog.keywords) : [],
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async updateOrder(items: { id: string; sortOrder: number }[]) {
    // Dùng transaction để đảm bảo toàn vẹn dữ liệu
    return this.prisma.$transaction(
      items.map((item) =>
        this.prisma.blogPost.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );
  }

  // --- FIND ONE ---
  async findOne(idOrSlug: string) {
    const blog = await this.prisma.blogPost.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        category: true, // Include full category
        relatedProducts: {
          select: { id: true, name: true, images: true, price: true, slug: true },
        },
      },
    });

    if (!blog) throw new NotFoundException('Blog post not found');

    return {
      ...blog,
      keywords: blog.keywords ? JSON.parse(blog.keywords) : [],
    };
  }

  // --- UPDATE ---
  async update(id: string, updateBlogDto: UpdateBlogDto) {
    const { relatedProductIds, title, slug, keywords, categoryId, status, ...restData } = updateBlogDto as any;

    const existingBlog = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!existingBlog) throw new NotFoundException('Blog post not found');

    // Handle Slug
    let finalSlug = existingBlog.slug;
    if (slug || (title && title !== existingBlog.title)) {
        const candidate = slug || generateSlug(title || existingBlog.title);
        if (candidate !== existingBlog.slug) {
             finalSlug = await this.generateUniqueSlug(title || existingBlog.title, candidate);
        }
    }

    return this.prisma.blogPost.update({
      where: { id },
      data: {
        ...restData,
        title,
        slug: finalSlug,
        keywords: Array.isArray(keywords) ? JSON.stringify(keywords) : undefined,
        status: status,
        // [FIX] Update Category Relation
        category: categoryId 
          ? { connect: { id: categoryId } } 
          : categoryId === null ? { disconnect: true } : undefined,

        // [FIX] Update Products Relation (set thay thế toàn bộ list cũ)
        relatedProducts: relatedProductIds 
          ? { set: relatedProductIds.map((pid) => ({ id: pid })) } 
          : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.prisma.blogPost.delete({ where: { id } });
    return { message: 'Blog deleted' };
  }
  
}