import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { BlogQueryDto } from './dto/blog-query.dto';
import { Prisma } from '@prisma/client';
export declare class BlogService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private generateUniqueSlug;
    create(userId: string, createBlogDto: CreateBlogDto): Promise<{
        id: string;
        title: string;
        slug: string;
        excerpt: string | null;
        content: string;
        thumbnail: string | null;
        status: string;
        categoryId: string | null;
        metaTitle: string | null;
        metaDescription: string | null;
        keywords: string | null;
        canonicalUrl: string | null;
        ogImage: string | null;
        noIndex: boolean;
        authorId: string;
        sortOrder: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findAll(query: BlogQueryDto): Promise<{
        data: {
            keywords: any;
            category: {
                id: string;
                name: string;
                slug: string;
            } | null;
            author: {
                id: string;
                name: string | null;
                avatar: string | null;
            };
            id: string;
            title: string;
            slug: string;
            excerpt: string | null;
            content: string;
            thumbnail: string | null;
            status: string;
            categoryId: string | null;
            metaTitle: string | null;
            metaDescription: string | null;
            canonicalUrl: string | null;
            ogImage: string | null;
            noIndex: boolean;
            authorId: string;
            sortOrder: number;
            createdAt: Date;
            updatedAt: Date;
        }[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    updateOrder(items: {
        id: string;
        sortOrder: number;
    }[]): Promise<{
        id: string;
        title: string;
        slug: string;
        excerpt: string | null;
        content: string;
        thumbnail: string | null;
        status: string;
        categoryId: string | null;
        metaTitle: string | null;
        metaDescription: string | null;
        keywords: string | null;
        canonicalUrl: string | null;
        ogImage: string | null;
        noIndex: boolean;
        authorId: string;
        sortOrder: number;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    findOne(idOrSlug: string, publicOnly?: boolean): Promise<{
        keywords: any;
        category: {
            id: string;
            name: string;
            slug: string;
            parentId: string | null;
            sortOrder: number;
            createdAt: Date;
            updatedAt: Date;
        } | null;
        author: {
            id: string;
            name: string | null;
            avatar: string | null;
        };
        relatedProducts: {
            id: string;
            name: string;
            slug: string;
            price: Prisma.Decimal;
            images: Prisma.JsonValue;
        }[];
        id: string;
        title: string;
        slug: string;
        excerpt: string | null;
        content: string;
        thumbnail: string | null;
        status: string;
        categoryId: string | null;
        metaTitle: string | null;
        metaDescription: string | null;
        canonicalUrl: string | null;
        ogImage: string | null;
        noIndex: boolean;
        authorId: string;
        sortOrder: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    update(id: string, updateBlogDto: UpdateBlogDto): Promise<{
        id: string;
        title: string;
        slug: string;
        excerpt: string | null;
        content: string;
        thumbnail: string | null;
        status: string;
        categoryId: string | null;
        metaTitle: string | null;
        metaDescription: string | null;
        keywords: string | null;
        canonicalUrl: string | null;
        ogImage: string | null;
        noIndex: boolean;
        authorId: string;
        sortOrder: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    remove(id: string): Promise<{
        message: string;
    }>;
}
