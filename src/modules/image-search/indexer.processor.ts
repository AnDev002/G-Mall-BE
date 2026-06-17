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

    // [round14 FIX M7] chặn SSRF: chỉ fetch URL http/https tới host public.
    // Seller kiểm soát URL này nên phải reject loopback/private/reserved trước khi axios.get.
    if (!isAllowedImageUrl(firstImageUrl)) {
      await this.markEmbedding(productId, 'SKIPPED', null, 'image url rejected');
      return { status: 'SKIPPED' };
    }

    let buffer: Buffer;
    try {
      const res = await axios.get<ArrayBuffer>(firstImageUrl, {
        responseType: 'arraybuffer',
        timeout: 10_000,
        maxRedirects: 0, // [round14 FIX M7] chặn redirect lách qua kiểm tra host
      });
      buffer = Buffer.from(res.data);
    } catch (err: any) {
      // [round14 FIX M7] không log raw err.message (có thể lộ nội bộ); lưu generic.
      await this.markEmbedding(productId, 'FAILED', null, 'image fetch failed');
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

// [round14 FIX M7] SSRF guard: chỉ cho phép http/https tới host public.
// Reject loopback/private/link-local/reserved (IPv4 + IPv6) để worker không bị
// lừa gọi vào dịch vụ nội bộ (metadata endpoint, DB admin, v.v.).
function isAllowedImageUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

  // Bỏ dấu ngoặc IPv6 literal (vd: [::1]) + bỏ dấu chấm cuối FQDN (localhost. → localhost)
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!host) return false;

  // Tên host nội bộ
  if (host === 'localhost' || host.endsWith('.localhost')) return false;

  // [round14 review-FIX MEDIUM] CHẶN hostname đơn-nhãn (không dấu chấm, không phải IP) = tên dịch vụ nội
  // bộ docker (qdrant/redis/mysql/clip...) mà allowlist host-string không bắt. Host công khai luôn có TLD
  // (≥1 dấu chấm). IPv6 chứa ':', IPv4 khớp regex → loại trừ để không chặn nhầm IP literal hợp lệ.
  const _isV4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  const _isV6 = host.includes(':');
  if (!_isV4 && !_isV6 && !host.includes('.')) return false;

  // IPv6 loopback / unique-local (fc00::/7 → bắt đầu fc/fd) / link-local (fe80::)
  if (host === '::1' || host === '::') return false;
  if (/^f[cd][0-9a-f]{2}:/i.test(host)) return false;
  if (/^fe[89ab][0-9a-f]:/i.test(host)) return false;
  if (host.startsWith('::ffff:')) return false; // IPv4-mapped IPv6

  // IPv4 dạng a.b.c.d
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const o = m.slice(1).map(Number);
    if (o.some((n) => n > 255)) return false;
    const [a, b] = o;
    if (a === 127) return false; // loopback 127.0.0.0/8
    if (a === 10) return false; // private 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return false; // private 172.16.0.0/12
    if (a === 192 && b === 168) return false; // private 192.168.0.0/16
    if (a === 169 && b === 254) return false; // link-local 169.254.0.0/16
    if (a === 0) return false; // 0.0.0.0/8
  }

  return true;
}
