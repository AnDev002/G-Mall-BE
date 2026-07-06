import { Redis } from 'ioredis';
import { PrismaService } from 'src/database/prisma/prisma.service';
export declare class ProductCacheService {
    private readonly redis;
    private readonly prisma;
    private readonly logger;
    constructor(redis: Redis, prisma: PrismaService);
    getProductDetail(idOrSlug: string): Promise<any | null>;
    setProductDetail(id: string, slug: string | null, data: any): Promise<void>;
    getProductsByIds(ids: string[]): Promise<any[]>;
    invalidateProduct(id: string, slug?: string): Promise<void>;
}
