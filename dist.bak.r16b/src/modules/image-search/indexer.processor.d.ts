import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { ClipClientService } from './clip-client.service';
import { QdrantClientService } from './qdrant-client.service';
export declare const PRODUCT_INDEX_QUEUE = "product_index_queue";
export interface IndexProductJob {
    productId: string;
}
export declare class IndexerProcessor extends WorkerHost {
    private readonly prisma;
    private readonly clip;
    private readonly qdrant;
    private readonly logger;
    constructor(prisma: PrismaService, clip: ClipClientService, qdrant: QdrantClientService);
    process(job: Job<IndexProductJob>): Promise<{
        status: string;
    }>;
    private safeRemoveFromIndex;
    private markEmbedding;
}
