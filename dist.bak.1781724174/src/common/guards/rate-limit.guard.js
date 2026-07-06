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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitGuard = exports.RateLimit = exports.RATE_LIMIT_KEY = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const redis_service_1 = require("../../database/redis/redis.service");
exports.RATE_LIMIT_KEY = 'rate_limit_options';
const RateLimit = (options) => (0, common_1.SetMetadata)(exports.RATE_LIMIT_KEY, options);
exports.RateLimit = RateLimit;
let RateLimitGuard = class RateLimitGuard {
    reflector;
    redis;
    constructor(reflector, redis) {
        this.reflector = reflector;
        this.redis = redis;
    }
    async canActivate(ctx) {
        const options = this.reflector.getAllAndOverride(exports.RATE_LIMIT_KEY, [ctx.getHandler(), ctx.getClass()]);
        if (!options)
            return true;
        const _strat = options.keyBy ?? 'ip+path';
        const _env = process.env.NODE_ENV || '';
        if ((_strat === 'ip' || _strat === 'ip+path') && (_env === 'test' || _env === 'development')) {
            return true;
        }
        const req = ctx.switchToHttp().getRequest();
        const key = this.buildKey(req, options);
        if (key === null)
            return true;
        const client = this.redis.getClient();
        const count = await client.incr(key);
        if (count === 1) {
            await client.expire(key, options.windowSeconds);
        }
        if (count > options.points) {
            const ttl = await client.ttl(key);
            throw new common_1.HttpException({
                statusCode: common_1.HttpStatus.TOO_MANY_REQUESTS,
                message: `Quá nhiều yêu cầu. Thử lại sau ${Math.max(ttl, 1)} giây.`,
            }, common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        return true;
    }
    buildKey(req, options) {
        const strategy = options.keyBy ?? 'ip+path';
        const ip = this.getIp(req);
        const path = `${req.method}:${req.route?.path ?? req.path}`;
        switch (strategy) {
            case 'ip':
                return `rl:ip:${ip}`;
            case 'body.email+path': {
                const rawEmail = req.body?.email;
                if (typeof rawEmail !== 'string' || rawEmail.trim() === '') {
                    return null;
                }
                const email = rawEmail.toLowerCase();
                return `rl:email:${email}:${path}`;
            }
            case 'ip+path':
            default:
                return `rl:ip:${ip}:${path}`;
        }
    }
    getIp(req) {
        return (req.headers['x-forwarded-for']?.split(',')[0].trim() ||
            req.ip ||
            req.socket.remoteAddress ||
            'unknown');
    }
};
exports.RateLimitGuard = RateLimitGuard;
exports.RateLimitGuard = RateLimitGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        redis_service_1.RedisService])
], RateLimitGuard);
//# sourceMappingURL=rate-limit.guard.js.map