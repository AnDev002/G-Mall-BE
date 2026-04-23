import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RedisService } from '../../database/redis/redis.service';

/**
 * Rate limit dựa trên Redis INCR + TTL.
 *
 * Khác `@nestjs/throttler`: không cần thêm dependency (Redis đã có sẵn trong
 * stack). Chấp nhận tradeoff: ít tính năng hơn (không có multi-tier, không
 * có skip-if rules phức tạp). Đủ dùng cho protect auth endpoints khỏi brute
 * force / spam.
 *
 * Dùng như sau ở controller:
 *   @UseGuards(RateLimitGuard)
 *   @RateLimit({ points: 5, windowSeconds: 60, keyBy: 'ip+path' })
 *   @Post('login')
 */

export interface RateLimitOptions {
  /** Số request tối đa trong window. */
  points: number;
  /** Độ dài window tính bằng giây. */
  windowSeconds: number;
  /**
   * Chiến lược tạo key:
   * - 'ip' — rate limit theo IP, shared qua mọi route.
   * - 'ip+path' — theo IP + method:path; cùng IP gọi 2 route khác nhau thì
   *   mỗi route có bucket riêng. Mặc định.
   * - 'body.email+path' — dùng cho forgot-password / login: limit theo email
   *   người gọi (tránh attacker spam forgot-password để flood mail server
   *   của 1 user cụ thể).
   */
  keyBy?: 'ip' | 'ip+path' | 'body.email+path';
}

export const RATE_LIMIT_KEY = 'rate_limit_options';
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!options) return true; // Route không đánh @RateLimit → skip

    const req = ctx.switchToHttp().getRequest<Request>();
    const key = this.buildKey(req, options);

    // INCR atomic; TTL chỉ set lần đầu (khi count == 1) để window trôi đúng
    // từ lần request đầu tiên chứ không reset mỗi lần hit.
    const client = this.redis.getClient();
    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, options.windowSeconds);
    }

    if (count > options.points) {
      const ttl = await client.ttl(key);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Quá nhiều yêu cầu. Thử lại sau ${Math.max(ttl, 1)} giây.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private buildKey(req: Request, options: RateLimitOptions): string {
    const strategy = options.keyBy ?? 'ip+path';
    const ip = this.getIp(req);
    const path = `${req.method}:${req.route?.path ?? req.path}`;

    switch (strategy) {
      case 'ip':
        return `rl:ip:${ip}`;
      case 'body.email+path': {
        const email = String((req.body as any)?.email ?? 'anon').toLowerCase();
        return `rl:email:${email}:${path}`;
      }
      case 'ip+path':
      default:
        return `rl:ip:${ip}:${path}`;
    }
  }

  private getIp(req: Request): string {
    // Lấy IP sau proxy (Render/Nginx). app.set('trust proxy') cần được bật
    // ở main.ts để req.ip trả IP client thật thay vì IP proxy.
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }
}
