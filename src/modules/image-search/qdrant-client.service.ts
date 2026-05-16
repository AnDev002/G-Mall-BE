import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface QdrantPoint {
  id: string;
  vector: number[];
  payload?: Record<string, unknown>;
}

export interface QdrantSearchHit {
  id: string;
  score: number;
  payload?: Record<string, unknown>;
}

/**
 * Talks to Qdrant via REST API. We use raw HTTP instead of @qdrant/js-client-rest
 * to avoid adding an npm dep — only a handful of endpoints needed.
 *
 * Collection schema:
 *   - name: products (configurable via QDRANT_COLLECTION env)
 *   - vector size: 512, distance: Cosine (matches CLIP ViT-B/32 output)
 *   - point id: productId (UUID), payload: { shopId, categoryId, status }
 */
@Injectable()
export class QdrantClientService implements OnModuleInit {
  private readonly logger = new Logger(QdrantClientService.name);
  private http!: AxiosInstance;
  private collection!: string;
  private readonly vectorSize = 512;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const baseURL = this.config.get<string>('QDRANT_URL') ?? 'http://localhost:6333';
    this.collection = this.config.get<string>('QDRANT_COLLECTION') ?? 'products';
    const apiKey = this.config.get<string>('QDRANT_API_KEY');
    this.http = axios.create({
      baseURL,
      timeout: 10_000,
      headers: apiKey ? { 'api-key': apiKey } : {},
    });
    this.logger.log(`qdrant URL: ${baseURL}, collection: ${this.collection}`);
    await this.ensureCollection();
  }

  /** Idempotent — creates the collection if missing. Safe to call at boot. */
  private async ensureCollection(): Promise<void> {
    try {
      await this.http.get(`/collections/${this.collection}`);
      return; // already exists
    } catch (err: any) {
      if (err.response?.status !== 404) {
        this.logger.warn(`qdrant unreachable or unexpected error: ${err.message}`);
        return; // don't block app boot — search endpoint will error gracefully
      }
    }
    await this.http.put(`/collections/${this.collection}`, {
      vectors: { size: this.vectorSize, distance: 'Cosine' },
    });
    this.logger.log(`created collection ${this.collection}`);
  }

  async upsert(points: QdrantPoint[]): Promise<void> {
    if (!points.length) return;
    await this.http.put(`/collections/${this.collection}/points?wait=true`, {
      points: points.map((p) => ({ id: p.id, vector: p.vector, payload: p.payload ?? {} })),
    });
  }

  async deletePoint(id: string): Promise<void> {
    await this.http.post(`/collections/${this.collection}/points/delete?wait=true`, {
      points: [id],
    });
  }

  async search(vector: number[], limit = 20, filter?: Record<string, unknown>): Promise<QdrantSearchHit[]> {
    const body: Record<string, unknown> = {
      vector,
      limit,
      with_payload: true,
    };
    if (filter) body.filter = filter;
    const { data } = await this.http.post<{ result: QdrantSearchHit[] }>(
      `/collections/${this.collection}/points/search`,
      body,
    );
    return data.result ?? [];
  }

  async count(): Promise<number> {
    try {
      const { data } = await this.http.post<{ result: { count: number } }>(
        `/collections/${this.collection}/points/count`,
        { exact: false },
      );
      return data.result?.count ?? 0;
    } catch {
      return 0;
    }
  }
}
