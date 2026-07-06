import { BlogCategoryService } from './blog-category.service';
export declare class PublicBlogCategoryController {
    private readonly service;
    constructor(service: BlogCategoryService);
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
}
