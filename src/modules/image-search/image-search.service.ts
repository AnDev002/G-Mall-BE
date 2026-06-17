import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import axios from 'axios';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { ClipClientService } from './clip-client.service';
import { QdrantClientService } from './qdrant-client.service';
import { IndexProductJob, PRODUCT_INDEX_QUEUE } from './indexer.processor';

export interface ImageSearchHit {
  productId: string;
  similarity: number;
  name: string;
  price: number;
  image: string | null;
  shopId: string | null;
  slug: string;
}

@Injectable()
export class ImageSearchService {
  private readonly logger = new Logger(ImageSearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clip: ClipClientService,
    private readonly qdrant: QdrantClientService,
    @InjectQueue(PRODUCT_INDEX_QUEUE) private readonly indexQueue: Queue<IndexProductJob>,
  ) {}

  /** Enqueue an index job. Called from ProductWriteService after create/update. */
  async enqueueIndex(productId: string): Promise<void> {
    await this.indexQueue.add(
      'index',
      { productId },
      {
        // Dedupe — same product re-saved many times collapses to one job.
        jobId: `index:${productId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );
  }

  /** Remove product from index — call from ProductWriteService on hard delete. */
  async enqueueDelete(productId: string): Promise<void> {
    await this.qdrant.deletePoint(productId).catch((err) =>
      this.logger.warn(`qdrant delete ${productId} ignored: ${err.message}`),
    );
    await this.prisma.productEmbedding.deleteMany({ where: { productId } }).catch(() => undefined);
  }

  /** Main query path: ảnh bytes → vector → Qdrant kNN → hydrate from DB. */
  async searchByImageBuffer(buffer: Buffer, limit = 20, minSimilarity = 0): Promise<ImageSearchHit[]> {
    // [round14 FIX M4] CLIP/Qdrant không deploy → map lỗi network thành 503 thay vì 500.
    const vector = await this.callDependency(() => this.clip.embedImageBuffer(buffer));
    return this.runVectorSearch(vector, limit, minSimilarity);
  }

  /** Text-to-image search: caption -> CLIP text encoder -> same vector space. */
  async searchByText(text: string, limit = 20, minSimilarity = 0): Promise<ImageSearchHit[]> {
    // [round14 FIX M4]
    const vector = await this.callDependency(() => this.clip.embedText(text));
    return this.runVectorSearch(vector, limit, minSimilarity);
  }

  private async runVectorSearch(
    vector: number[],
    limit: number,
    minSimilarity: number,
  ): Promise<ImageSearchHit[]> {
    // Only return public products. Qdrant filter avoids a second DB pass.
    // [round14 FIX M4] bọc call Qdrant để lỗi network → 503.
    const hits = await this.callDependency(() =>
      this.qdrant.search(vector, limit, {
        must: [{ key: 'status', match: { value: 'ACTIVE' } }],
      }),
    );
    if (!hits.length) return [];

    const ids = hits.map((h) => String(h.id));
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, slug: true, price: true, images: true, shopId: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    return hits
      .map<ImageSearchHit | null>((h) => {
        const p = byId.get(String(h.id));
        if (!p) return null;
        const similarity = clamp01(h.score);
        if (similarity < minSimilarity) return null;
        return {
          productId: p.id,
          similarity,
          name: p.name,
          price: Number(p.price),
          image: pickFirstImageUrl(p.images),
          shopId: p.shopId ?? null,
          slug: p.slug,
        };
      })
      .filter((h): h is ImageSearchHit => h !== null);
  }

  /** Admin/status endpoint helper. */
  async stats() {
    const [pending, indexed, failed, skipped, qdrantCount] = await Promise.all([
      this.prisma.productEmbedding.count({ where: { status: 'PENDING' } }),
      this.prisma.productEmbedding.count({ where: { status: 'INDEXED' } }),
      this.prisma.productEmbedding.count({ where: { status: 'FAILED' } }),
      this.prisma.productEmbedding.count({ where: { status: 'SKIPPED' } }),
      // [round14 FIX M4] qdrant.count() đã tự nuốt lỗi → 0; bọc thêm phòng khi đổi behavior.
      this.callDependency(() => this.qdrant.count()),
    ]);
    return { pending, indexed, failed, skipped, qdrantCount };
  }

  /**
   * [round14 FIX M4] Chạy 1 call tới CLIP/Qdrant; nếu lỗi là network/unreachable
   * (axios ECONNREFUSED/ETIMEDOUT/ENOTFOUND hoặc không có response) thì rethrow
   * ServiceUnavailableException (HTTP 503) theo contract. Lỗi lập trình thật vẫn nổi lên.
   */
  private async callDependency<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (isUpstreamUnavailable(err)) {
        this.logger.warn(
          `image-search dependency unavailable: ${err instanceof Error ? err.message : String(err)}`,
        );
        throw new ServiceUnavailableException('Image search temporarily unavailable');
      }
      throw err;
    }
  }
}

/** True khi lỗi đến từ việc CLIP/Qdrant không reachable (network), không phải bug logic. */
function isUpstreamUnavailable(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  // Không có response = không kết nối được tới upstream (DNS/refused/timeout/abort).
  if (!err.response) return true;
  const code = err.code;
  return code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'ENOTFOUND';
}

function pickFirstImageUrl(images: unknown): string | null {
  if (Array.isArray(images)) {
    const first = images.find((u) => typeof u === 'string' && u.length > 0);
    return (first as string) ?? null;
  }
  return null;
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
