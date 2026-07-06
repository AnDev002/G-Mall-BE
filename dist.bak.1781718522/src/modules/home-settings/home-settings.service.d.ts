import { PrismaService } from '../../database/prisma/prisma.service';
import { CategoryService } from '../category/category.service';
export declare class HomeSettingsService {
    private prisma;
    private categoryService;
    constructor(prisma: PrismaService, categoryService: CategoryService);
    private getProductsByCategory;
    private getDataForColumn;
    getHomeLayout(): Promise<any[]>;
    getAllSections(): Promise<{
        id: string;
        title: string;
        type: string;
        order: number;
        isActive: boolean;
        config: import(".prisma/client").Prisma.JsonValue | null;
        categoryId: string | null;
        voucherId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    private cleanInput;
    createSection(data: any): Promise<{
        id: string;
        title: string;
        type: string;
        order: number;
        isActive: boolean;
        config: import(".prisma/client").Prisma.JsonValue | null;
        categoryId: string | null;
        voucherId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    updateSection(id: string, data: any): Promise<{
        id: string;
        title: string;
        type: string;
        order: number;
        isActive: boolean;
        config: import(".prisma/client").Prisma.JsonValue | null;
        categoryId: string | null;
        voucherId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    deleteSection(id: string): Promise<{
        id: string;
        title: string;
        type: string;
        order: number;
        isActive: boolean;
        config: import(".prisma/client").Prisma.JsonValue | null;
        categoryId: string | null;
        voucherId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    reorderSections(ids: string[]): Promise<{
        id: string;
        title: string;
        type: string;
        order: number;
        isActive: boolean;
        config: import(".prisma/client").Prisma.JsonValue | null;
        categoryId: string | null;
        voucherId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
}
