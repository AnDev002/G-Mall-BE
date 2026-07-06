import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { RedisService } from '../../database/redis/redis.service';
export declare const CACHE_KEY_METADATA = "cache:key";
export declare const CACHE_TTL_METADATA = "cache:ttl";
export declare const CacheKey: (key: string) => import("@nestjs/common").CustomDecorator<string>;
export declare const CacheTTL: (seconds: number) => import("@nestjs/common").CustomDecorator<string>;
export declare class RedisCacheInterceptor implements NestInterceptor {
    private readonly redis;
    private readonly reflector;
    private readonly logger;
    constructor(redis: RedisService, reflector: Reflector);
    intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<any>>;
}
