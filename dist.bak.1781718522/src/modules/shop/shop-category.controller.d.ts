import { PrismaService } from '../../database/prisma/prisma.service';
export declare class ShopCategoryController {
    private prisma;
    constructor(prisma: PrismaService);
    private getShopId;
    create(req: any, name: string): Promise<{
        id: string;
        name: string;
        isActive: boolean;
        shopId: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findAll(req: any): Promise<({
        _count: {
            products: number;
        };
    } & {
        id: string;
        name: string;
        isActive: boolean;
        shopId: string;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    update(req: any, id: string, body: {
        name?: string;
        isActive?: boolean;
    }): Promise<{
        id: string;
        name: string;
        isActive: boolean;
        shopId: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    remove(req: any, id: string): Promise<{
        id: string;
        name: string;
        isActive: boolean;
        shopId: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    addProducts(req: any, id: string, productIds: string[]): Promise<import(".prisma/client").Prisma.BatchPayload>;
    removeProducts(req: any, id: string, productIds: string[]): Promise<import(".prisma/client").Prisma.BatchPayload>;
}
