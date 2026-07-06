import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../../database/redis/redis.service';
export interface RateLimitOptions {
    points: number;
    windowSeconds: number;
    keyBy?: 'ip' | 'ip+path' | 'body.email+path';
}
export declare const RATE_LIMIT_KEY = "rate_limit_options";
export declare const RateLimit: (options: RateLimitOptions) => import("@nestjs/common").CustomDecorator<string>;
export declare class RateLimitGuard implements CanActivate {
    private readonly reflector;
    private readonly redis;
    constructor(reflector: Reflector, redis: RedisService);
    canActivate(ctx: ExecutionContext): Promise<boolean>;
    private buildKey;
    private getIp;
}
