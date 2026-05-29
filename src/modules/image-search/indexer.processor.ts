import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import axios from 'axios';
import { createHash } from 'crypto';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { ClipClientService } from './clip-client.service';
import { QdrantClientService } from './qdrant-client.service';

export const PRODUCT_INDEX_QUEUE = 'product_index_queue';

export interface IndexProductJob {
  productId: string;
}

/**
 * Background worker that turns a Product's main image into a vector and
 * upserts it into Qdrant.
 *
 * Skipped vs failed:
 *   - SKIPPED: SP has no images → no vector to make
 *   - FAILED: ảnh fetch lỗi / CLIP service down → retry tự động qua BullMQ backoff
 *   - INDEXED: vector saved in Qdrant + ProductEmbedding row updated
 *
 * Idempotency: `imageHash` SHA-256 prevents re-encoding the same image
 * across runs. Cheap protection against accidental re-queue storms.
 */
@Processor(PRODUCT_INDEX_QUEUE, { concurrency: 3 })
export class IndexerProcessor extends WorkerHost {
  private readonly logger = new Logger(IndexerProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clip: ClipClientService,
    private readonly qdrant: QdrantClientService,
  ) {
    super();
  }

  async process(job: Job<IndexProductJob>) {
    const { productId } = job.data;
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, images: true, shopId: true, categoryId: true, status: true },
    });

    if (!product) {
      this.logger.warn(`product ${productId} not found, deleting from index`);
      await this.safeRemoveFromIndex(productId);
      return { status: 'NOT_FOUND' };
    }

    const firstImageUrl = pickFirstImageUrl(product.images);
    if (!firstImageUrl) {
      await this.markEmbedding(productId, 'SKIPPED', null, 'no image on product');
      return { status: 'SKIPPED' };
    }

    let buffer: Buffer;
    try {
      const res = await axios.get<ArrayBuffer>(firstImageUrl, {
        responseType: 'arraybuffer',
        timeout: 10_000,
      });
      buffer = Buffer.from(res.data);
    } catch (err: any) {
      await this.markEmbedding(productId, 'FAILED', null, `image fetch: ${err.message}`);
      throw err; // let BullMQ retry with backoff
    }

    const hash = createHash('sha256').update(buffer).digest('hex');
    const existing = await this.prisma.productEmbedding.findUnique({ where: { productId } });
    if (existing?.imageHash === hash && existing.status === 'INDEXED') {
      this.logger.debug(`product ${productId} unchanged, skip re-encode`);
      return { status: 'UNCHANGED' };
    }

    let vector: number[];
    try {
      vector = await this.clip.embedImageBuffer(buffer);
    } catch (err: any) {
      await this.markEmbedding(productId, 'FAILED', hash, `clip: ${err.message}`);
      throw err;
    }

    try {
      await this.qdrant.upsert([
        {
          id: productId,
          vector,
          payload: {
            shopId: product.shopId ?? null,
            categoryId: product.categoryId ?? null,
            status: product.status,
          },
        },
      ]);
    } catch (err: any) {
      await this.markEmbedding(productId, 'FAILED', hash, `qdrant: ${err.message}`);
      throw err;
    }

    await this.markEmbedding(productId, 'INDEXED', hash, null);
    return { status: 'INDEXED' };
  }

  private async safeRemoveFromIndex(productId: string) {
    try {
      await this.qdrant.deletePoint(productId);
    } catch (err: any) {
      this.logger.warn(`qdrant delete ${productId} failed: ${err.message}`);
    }
    await this.prisma.productEmbedding.deleteMany({ where: { productId } });
  }

  private async markEmbedding(
    productId: string,
    status: 'PENDING' | 'INDEXED' | 'FAILED' | 'SKIPPED',
    imageHash: string | null,
    errorMsg: string | null,
  ) {
    const indexedAt = status === 'INDEXED' ? new Date() : null;
    await this.prisma.productEmbedding.upsert({
      where: { productId },
      create: { productId, status, imageHash, errorMsg, indexedAt },
      update: { status, imageHash, errorMsg, indexedAt },
    });
  }
}

function pickFirstImageUrl(images: unknown): string | null {
  // Product.images is JSON — typically string[] but old rows may differ.
  if (Array.isArray(images)) {
    const first = images.find((u) => typeof u === 'string' && u.length > 0);
    return (first as string) ?? null;
  }
  return null;
}
