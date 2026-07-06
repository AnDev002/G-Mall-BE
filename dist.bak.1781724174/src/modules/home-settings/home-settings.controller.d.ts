import { HomeSettingsService } from './home-settings.service';
export declare class HomeSettingsController {
    private readonly homeSettingsService;
    constructor(homeSettingsService: HomeSettingsService);
    getPublicLayout(): Promise<any[]>;
    getAllForAdmin(): Promise<{
        id: string;
        title: string;
        type: string;
        order: number;
        isActive: boolean;
        config: import("@prisma/client").Prisma.JsonValue | null;
        categoryId: string | null;
        voucherId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    create(data: any): Promise<{
        id: string;
        title: string;
        type: string;
        order: number;
        isActive: boolean;
        config: import("@prisma/client").Prisma.JsonValue | null;
        categoryId: string | null;
        voucherId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    reorder(body: {
        ids: string[];
    }): Promise<{
        id: string;
        title: string;
        type: string;
        order: number;
        isActive: boolean;
        config: import("@prisma/client").Prisma.JsonValue | null;
        categoryId: string | null;
        voucherId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    update(id: string, data: any): Promise<{
        id: string;
        title: string;
        type: string;
        order: number;
        isActive: boolean;
        config: import("@prisma/client").Prisma.JsonValue | null;
        categoryId: string | null;
        voucherId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    delete(id: string): Promise<{
        id: string;
        title: string;
        type: string;
        order: number;
        isActive: boolean;
        config: import("@prisma/client").Prisma.JsonValue | null;
        categoryId: string | null;
        voucherId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
