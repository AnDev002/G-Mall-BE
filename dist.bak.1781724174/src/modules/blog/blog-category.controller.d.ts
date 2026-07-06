import { BlogCategoryService } from './blog-category.service';
export declare class BlogCategoryController {
    private readonly service;
    constructor(service: BlogCategoryService);
    create(data: {
        name: string;
        parentId?: string;
    }): Promise<{
        id: string;
        name: string;
        slug: string;
        parentId: string | null;
        sortOrder: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findAll(): Promise<({
        children: {
            id: string;
            name: string;
            slug: string;
            parentId: string | null;
            sortOrder: number;
            createdAt: Date;
            updatedAt: Date;
        }[];
    } & {
        id: string;
        name: string;
        slug: string;
        parentId: string | null;
        sortOrder: number;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    reorder(body: {
        items: {
            id: string;
            sortOrder: number;
        }[];
    }): Promise<{
        count: number;
    }>;
    update(id: string, data: {
        name?: string;
        parentId?: string;
    }): Promise<{
        id: string;
        name: string;
        slug: string;
        parentId: string | null;
        sortOrder: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    remove(id: string): Promise<{
        id: string;
        name: string;
        slug: string;
        parentId: string | null;
        sortOrder: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
