import { Queue } from 'bullmq';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { ClipClientService } from './clip-client.service';
import { QdrantClientService } from './qdrant-client.service';
import { IndexProductJob } from './indexer.processor';
export interface ImageSearchHit {
    productId: string;
    similarity: number;
    name: string;
    price: number;
    image: string | null;
    shopId: string | null;
    slug: string;
}
export declare class ImageSearchService {
    private readonly prisma;
    private readonly clip;
    private readonly qdrant;
    private readonly indexQueue;
    private readonly logger;
    constructor(prisma: PrismaService, clip: ClipClientService, qdrant: QdrantClientService, indexQueue: Queue<IndexProductJob>);
    enqueueIndex(productId: string): Promise<void>;
    enqueueDelete(productId: string): Promise<void>;
    searchByImageBuffer(buffer: Buffer, limit?: number, minSimilarity?: number): Promise<ImageSearchHit[]>;
    searchByText(text: string, limit?: number, minSimilarity?: number): Promise<ImageSearchHit[]>;
    private runVectorSearch;
    stats(): Promise<{
        pending: number;
        indexed: number;
        failed: number;
        skipped: number;
        qdrantCount: number;
    }>;
    private callDependency;
}
