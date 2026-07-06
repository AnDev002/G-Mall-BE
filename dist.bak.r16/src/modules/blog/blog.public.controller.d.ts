import { BlogService } from './blog.service';
import { BlogQueryDto } from './dto/blog-query.dto';
export declare class PublicBlogController {
    private readonly blogService;
    constructor(blogService: BlogService);
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
    findOne(idOrSlug: string): Promise<{
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
            price: import("@prisma/client/runtime/library").Decimal;
            images: import(".prisma/client").Prisma.JsonValue;
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
}
