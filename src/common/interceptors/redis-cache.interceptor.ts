import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { RedisService } from '../../database/redis/redis.service';

/**
 * Redis-backed response cache cho GET endpoints.
 *
 * Why custom (vs @nestjs/cache-manager):
 * - cache-manager v6 + @nestjs/cache-manager v3 đổi API + cần keyv adapter
 *   → ESM/CJS compat headache với BE đang dùng CommonJS.
 * - Project đã có RedisService singleton (wiki 0029) — tận dụng.
 *
 * Usage:
 *   @UseInterceptors(RedisCacheInterceptor)
 *   @CacheKey('charity:funds')   // optional, default = req.url
 *   @CacheTTL(30)                 // seconds; default 30
 *   @Get('funds')
 *   async listFunds() { ... }
 *
 * Skips cache khi: non-GET method, có Authorization header (per-user data),
 * service throw error (chỉ cache success).
 */

export const CACHE_KEY_METADATA = 'cache:key';
export const CACHE_TTL_METADATA = 'cache:ttl';
export const CacheKey = (key: string) => SetMetadata(CACHE_KEY_METADATA, key);
export const CacheTTL = (seconds: number) => SetMetadata(CACHE_TTL_METADATA, seconds);

@Injectable()
export class RedisCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RedisCacheInterceptor.name);

  constructor(
    private readonly redis: RedisService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = ctx.switchToHttp().getRequest<Request>();

    // Chỉ cache GET (POST/PATCH/DELETE đổi state, không nên cache)
    if (req.method !== 'GET') return next.handle();

    // Skip cache nếu request có auth — response có thể khác per-user
    if (req.headers.authorization || req.headers.cookie?.includes('accessToken')) {
      return next.handle();
    }

    const handler = ctx.getHandler();
    const customKey = this.reflector.get<string>(CACHE_KEY_METADATA, handler);
    const ttl = this.reflector.get<number>(CACHE_TTL_METADATA, handler) ?? 30;

    // Cache key: custom prefix + full URL (gồm query params)
    // Ví dụ: cache:charity:funds:?includeClosed=true
    const baseKey = customKey || 'cache:auto';
    const key = `${baseKey}:${req.url}`;

    try {
      const cached = await this.redis.get(key);
      if (cached) {
        // Cache HIT — trả ngay, bypass handler
        return of(JSON.parse(cached));
      }
    } catch (err) {
      // Redis error → log + miss cache, để handler xử lý bình thường
      this.logger.warn(`Cache read failed for ${key}: ${(err as Error).message}`);
    }

    // Cache MISS — chạy handler, cache result on success
    return next.handle().pipe(
      tap(async (response) => {
        try {
          await this.redis.set(key, JSON.stringify(response), ttl);
        } catch (err) {
          this.logger.warn(`Cache write failed for ${key}: ${(err as Error).message}`);
        }
      }),
    );
  }
}
