// BE-1.2/database/redis/redis.service.ts
import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants'; 

@Injectable()
export class RedisService {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  getClient(): Redis {
    return this.client;
  }

  // --- [THÊM ĐOẠN NÀY] ---
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }
  // -----------------------

  async set(key: string, value: string, ttl?: number) {
    if (ttl) return this.client.set(key, value, 'EX', ttl);
    return this.client.set(key, value);
  }

  async del(key: string) {
    return this.client.del(key);
  }

  // Wiki 0039: invalidate cache theo prefix khi mutation. Dùng KEYS — chấp nhận
  // O(N) vì pattern hẹp ('charity:funds:*' cỡ <100 key) và mutation ít.
  // Production lớn nên đổi sang SCAN + cursor.
  async delByPattern(pattern: string): Promise<number> {
    const keys = await this.client.keys(pattern);
    if (!keys.length) return 0;
    return this.client.del(...keys);
  }

  async setNX(key: string, value: string, ttl: number): Promise<boolean> {
    // 'EX': Set thời gian hết hạn (giây)
    // 'NX': Chỉ set nếu key chưa tồn tại
    const result = await this.client.set(key, value, 'EX', ttl, 'NX');
    return result === 'OK';
  }
}