import { CategoryService } from '../category.service';
import { UpdateCategoryOrderDto } from '../dto/update-category-order.dto';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { UpdateCategoryBatchItemDto } from '../dto/update-category-batch.dto';
export declare class CategoryController {
    private readonly categoryService;
    constructor(categoryService: CategoryService);
    getCategories(parentId?: string): Promise<{
        id: string;
        name: string;
        slug: string;
        parentId: string | null;
        hasChildren: boolean;
    }[]>;
    search(q: string): Promise<{
        id: string;
        name: string;
        slug: string;
        path: string;
    }[]>;
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
                        filterKeys: import("@prisma/client").Prisma.JsonValue | null;
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
                    filterKeys: import("@prisma/client").Prisma.JsonValue | null;
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
                filterKeys: import("@prisma/client").Prisma.JsonValue | null;
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
            filterKeys: import("@prisma/client").Prisma.JsonValue | null;
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
        filterKeys: import("@prisma/client").Prisma.JsonValue | null;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    create(createCategoryDto: CreateCategoryDto): Promise<{
        id: string;
        name: string;
        slug: string;
        image: string | null;
        parentId: string | null;
        order: number;
        filterKeys: import("@prisma/client").Prisma.JsonValue | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    update(id: string, updateCategoryDto: UpdateCategoryDto): Promise<{
        id: string;
        name: string;
        slug: string;
        image: string | null;
        parentId: string | null;
        order: number;
        filterKeys: import("@prisma/client").Prisma.JsonValue | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    updateOrder(dto: UpdateCategoryOrderDto): Promise<{
        success: boolean;
        message: string;
        count: number;
    }>;
    remove(id: string): Promise<import("@prisma/client").Prisma.BatchPayload>;
    updateBatch(items: UpdateCategoryBatchItemDto[]): Promise<any[]>;
    getBreadcrumbs(id: string): Promise<{
        id: string;
        name: string;
        slug: string;
    }[]>;
    fixAllSlugs(): Promise<{
        message: string;
    }>;
}
