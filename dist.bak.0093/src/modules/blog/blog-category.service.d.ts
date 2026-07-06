import { PrismaService } from '../../database/prisma/prisma.service';
export declare class BlogCategoryService {
    private prisma;
    constructor(prisma: PrismaService);
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
    reorder(items: {
        id: string;
        sortOrder: number;
    }[]): Promise<{
        count: number;
    }>;
    update(id: string, data: {
        name?: string;
        parentId?: string | null;
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
