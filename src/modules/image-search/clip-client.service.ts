import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

/**
 * Thin HTTP client wrapper around the Python CLIP service.
 *
 * We use raw axios (not @nestjs/axios) because we want a dedicated instance
 * with our own baseURL + timeouts — the rest of the app talks to many
 * different upstreams and shouldn't share defaults.
 */
@Injectable()
export class ClipClientService implements OnModuleInit {
  private readonly logger = new Logger(ClipClientService.name);
  private http!: AxiosInstance;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const baseURL = this.config.get<string>('CLIP_SERVICE_URL') ?? 'http://localhost:8000';
    this.http = axios.create({
      baseURL,
      timeout: 15_000, // 15s — model encode latency rarely above 200ms but image fetch can stall
      headers: { 'Content-Type': 'application/json' },
    });
    this.logger.log(`clip-service URL: ${baseURL}`);
  }

  /** Encode raw image bytes (jpg/png/webp). Returns L2-normalized 512-dim vector. */
  async embedImageBuffer(buffer: Buffer): Promise<number[]> {
    const { data } = await this.http.post<{ embedding: number[] }>('/embed', {
      image_b64: buffer.toString('base64'),
    });
    return data.embedding;
  }

  /** Encode an image already hosted somewhere (CDN URL). */
  async embedImageUrl(url: string): Promise<number[]> {
    const { data } = await this.http.post<{ embedding: number[] }>('/embed', {
      image_url: url,
    });
    return data.embedding;
  }

  /** Encode text — useful for hybrid search later (text-as-query against image vectors). */
  async embedText(text: string): Promise<number[]> {
    const { data } = await this.http.post<{ embedding: number[] }>('/embed', { text });
    return data.embedding;
  }

  async healthcheck(): Promise<boolean> {
    try {
      const { data } = await this.http.get<{ status: string; loaded: boolean }>('/health');
      return data.status === 'ok' && data.loaded;
    } catch {
      return false;
    }
  }
}
