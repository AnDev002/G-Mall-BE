"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var RedisCacheInterceptor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisCacheInterceptor = exports.CacheTTL = exports.CacheKey = exports.CACHE_TTL_METADATA = exports.CACHE_KEY_METADATA = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const redis_service_1 = require("../../database/redis/redis.service");
exports.CACHE_KEY_METADATA = 'cache:key';
exports.CACHE_TTL_METADATA = 'cache:ttl';
const CacheKey = (key) => (0, common_1.SetMetadata)(exports.CACHE_KEY_METADATA, key);
exports.CacheKey = CacheKey;
const CacheTTL = (seconds) => (0, common_1.SetMetadata)(exports.CACHE_TTL_METADATA, seconds);
exports.CacheTTL = CacheTTL;
let RedisCacheInterceptor = RedisCacheInterceptor_1 = class RedisCacheInterceptor {
    redis;
    reflector;
    logger = new common_1.Logger(RedisCacheInterceptor_1.name);
    constructor(redis, reflector) {
        this.redis = redis;
        this.reflector = reflector;
    }
    async intercept(ctx, next) {
        const req = ctx.switchToHttp().getRequest();
        if (req.method !== 'GET')
            return next.handle();
        if (req.headers.authorization || req.headers.cookie?.includes('accessToken')) {
            return next.handle();
        }
        const handler = ctx.getHandler();
        const customKey = this.reflector.get(exports.CACHE_KEY_METADATA, handler);
        const ttl = this.reflector.get(exports.CACHE_TTL_METADATA, handler) ?? 30;
        const baseKey = customKey || 'cache:auto';
        const key = `${baseKey}:${req.url}`;
        try {
            const cached = await this.redis.get(key);
            if (cached) {
                return (0, rxjs_1.of)(JSON.parse(cached));
            }
        }
        catch (err) {
            this.logger.warn(`Cache read failed for ${key}: ${err.message}`);
        }
        return next.handle().pipe((0, operators_1.tap)(async (response) => {
            try {
                await this.redis.set(key, JSON.stringify(response), ttl);
            }
            catch (err) {
                this.logger.warn(`Cache write failed for ${key}: ${err.message}`);
            }
        }));
    }
};
exports.RedisCacheInterceptor = RedisCacheInterceptor;
exports.RedisCacheInterceptor = RedisCacheInterceptor = RedisCacheInterceptor_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        core_1.Reflector])
], RedisCacheInterceptor);
//# sourceMappingURL=redis-cache.interceptor.js.map