import { PrismaService } from '../../database/prisma/prisma.service';
import { UpdateCategoryOrderDto } from './dto/update-category-order.dto';
export declare class CategoryService {
    private prisma;
    constructor(prisma: PrismaService);
    getCategories(parentId?: string): Promise<{
        id: string;
        name: string;
        slug: string;
        parentId: string | null;
        hasChildren: boolean;
    }[]>;
    searchCategories(keyword: string): Promise<{
        id: string;
        name: string;
        slug: string;
        path: string;
    }[]>;
    getCategoryTreeBySlug(slug: string): Promise<({
        parent: ({
            parent: ({
                parent: {
                    id: string;
                    name: string;
                    slug: string;
                    image: string | null;
                    parentId: string | null;
                    order: number;
                    filterKeys: import(".prisma/client").Prisma.JsonValue | null;
                    createdAt: Date;
                    updatedAt: Date;
                } | null;
            } & {
                id: string;
                name: string;
                slug: string;
                image: string | null;
                parentId: string | null;
                order: number;
                filterKeys: import(".prisma/client").Prisma.JsonValue | null;
                createdAt: Date;
                updatedAt: Date;
            }) | null;
        } & {
            id: string;
            name: string;
            slug: string;
            image: string | null;
            parentId: string | null;
            order: number;
            filterKeys: import(".prisma/client").Prisma.JsonValue | null;
            createdAt: Date;
            updatedAt: Date;
        }) | null;
    } & {
        id: string;
        name: string;
        slug: string;
        image: string | null;
        parentId: string | null;
        order: number;
        filterKeys: import(".prisma/client").Prisma.JsonValue | null;
        createdAt: Date;
        updatedAt: Date;
    }) | null>;
    updateOrder(dto: UpdateCategoryOrderDto): Promise<{
        success: boolean;
        message: string;
        count: number;
    }>;
    getCategoryTree(): Promise<({
        children: ({
            children: ({
                children: ({
                    children: {
                        id: string;
                        name: string;
                        slug: string;
                        image: string | null;
                        parentId: string | null;
                        order: number;
                        filterKeys: import(".prisma/client").Prisma.JsonValue | null;
                        createdAt: Date;
                        updatedAt: Date;
                    }[];
                } & {
                    id: string;
                    name: string;
                    slug: string;
                    image: string | null;
                    parentId: string | null;
                    order: number;
                    filterKeys: import(".prisma/client").Prisma.JsonValue | null;
                    createdAt: Date;
                    updatedAt: Date;
                })[];
            } & {
                id: string;
                name: string;
                slug: string;
                image: string | null;
                parentId: string | null;
                order: number;
                filterKeys: import(".prisma/client").Prisma.JsonValue | null;
                createdAt: Date;
                updatedAt: Date;
            })[];
        } & {
            id: string;
            name: string;
            slug: string;
            image: string | null;
            parentId: string | null;
            order: number;
            filterKeys: import(".prisma/client").Prisma.JsonValue | null;
            createdAt: Date;
            updatedAt: Date;
        })[];
    } & {
        id: string;
        name: string;
        slug: string;
        image: string | null;
        parentId: string | null;
        order: number;
        filterKeys: import(".prisma/client").Prisma.JsonValue | null;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    getAllDescendantIds(rootId: string): Promise<string[]>;
    create(data: {
        name: string;
        slug?: string;
        parentId?: string;
        filterKeys?: any;
    }): Promise<{
        id: string;
        name: string;
        slug: string;
        image: string | null;
        parentId: string | null;
        order: number;
        filterKeys: import(".prisma/client").Prisma.JsonValue | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    update(id: string, data: {
        name?: string;
        slug?: string;
        parentId?: string;
        filterKeys?: any;
    }): Promise<{
        id: string;
        name: string;
        slug: string;
        image: string | null;
        parentId: string | null;
        order: number;
        filterKeys: import(".prisma/client").Prisma.JsonValue | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    remove(id: string): Promise<import(".prisma/client").Prisma.BatchPayload>;
    updateBatch(items: any[]): Promise<any[]>;
    private generateSlug;
    getBreadcrumbs(categoryId: string): Promise<{
        id: string;
        name: string;
        slug: string;
    }[]>;
    getDescendantIds(categoryId: string): Promise<string[]>;
    fixAllSlugs(): Promise<{
        message: string;
    }>;
}
