import { PrismaService } from '../../../database/prisma/prisma.service';
import { ProductReadService } from './product-read.service';
import { ProductCacheService } from './product-cache.service';
export interface TagRule {
    code: string;
    label: string;
    keywords: string[];
}
export declare class ProductAutoTagService {
    private readonly prisma;
    private readonly productRead;
    private readonly productCache;
    private readonly logger;
    constructor(prisma: PrismaService, productRead: ProductReadService, productCache: ProductCacheService);
    scanAndTagAllProducts(rules: {
        code: string;
        keywords: string[];
    }[]): Promise<{
        updatedCount: number;
    }>;
}
