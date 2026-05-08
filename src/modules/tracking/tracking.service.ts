import { Inject, Injectable, Logger } from '@nestjs/common';
import { REDIS_CLIENT } from 'src/database/redis/redis.constants';
import { Redis } from 'ioredis';
import { TrackEventDto, EventType } from './dto/track-event.dto';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);
  private readonly STREAM_KEY = 'tracking_stream';
  private readonly TRENDING_KW_CACHE_KEY = 'cache:trending-keywords';
  private readonly TRENDING_KW_TTL_SEC = 300; // 5 phút

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) {}

  // 1. Đẩy event vào Stream
  async trackEvent(userId: string | null, guestId: string, dto: TrackEventDto) {
    const payload = JSON.stringify({
      userId,
      guestId,
      ...dto,
      serverTimestamp: Date.now(),
    });

    try {
      // MAXLEN ~ 1 triệu: Giữ stream đủ dài để worker xử lý kịp, tự động cắt cũ
      await this.redis.xadd(this.STREAM_KEY, 'MAXLEN', '~', 1000000, '*', 'data', payload);
    } catch (e) {
      this.logger.error(`Failed to push to stream: ${e.message}`);
    }
  }

  // 2. Merge Data: Guest -> User
  async mergeGuestData(guestId: string, realUserId: string) {
    const guestKey = `user:affinity:guest:${guestId}`;
    const userKey = `user:affinity:${realUserId}`;

    const exists = await this.redis.exists(guestKey);
    if (exists) {
      this.logger.log(`🔄 Merging data: Guest[${guestId}] -> User[${realUserId}]`);
      // ZUNIONSTORE: Gộp điểm từ Guest vào User, lấy MAX score hoặc SUM tùy strategy
      await this.redis.zunionstore(userKey, 2, userKey, guestKey, 'WEIGHTS', 1, 1, 'AGGREGATE', 'MAX');
      await this.redis.del(guestKey); 
      await this.redis.expire(userKey, 60 * 60 * 24 * 60); // 60 ngày
    }
  }

  // 3. Scoring System (Hệ thống chấm điểm hành vi)
  async updateAffinityScore(payload: any) {
      if (!payload.targetId || payload.targetId === 'none') return;

      const SCORES: Record<string, number> = {
          [EventType.VIEW_PRODUCT]: 1,
          [EventType.CLICK_PRODUCT]: 2,
          [EventType.ADD_TO_CART]: 5,
          [EventType.BEGIN_CHECKOUT]: 10,
          [EventType.PURCHASE]: 50,
      };

      const score = SCORES[payload.type] || 0;
      if (score === 0) return;

      const identifier = payload.userId 
        ? `user:affinity:${payload.userId}` 
        : `user:affinity:guest:${payload.guestId}`;
      
      // Nếu là Mua hàng -> Cộng điểm cho tất cả sản phẩm trong đơn
      if (payload.type === EventType.PURCHASE && payload.metadata?.items) {
          const items = payload.metadata.items; 
          if (Array.isArray(items)) {
             const pipeline = this.redis.pipeline();
             items.forEach((item: any) => {
                 if (item.productId) {
                    pipeline.zincrby(identifier, score, item.productId);
                 }
             });
             pipeline.expire(identifier, 60 * 60 * 24 * 60);
             await pipeline.exec();
          }
      } else {
          // Cộng điểm cho 1 item
          await this.redis.zincrby(identifier, score, payload.targetId);
          await this.redis.expire(identifier, 60 * 60 * 24 * 60);
      }
  }

  // 4. Recommendation Engine
  async getRecommendations(userId: string | null, guestId: string): Promise<string[]> {
    const key = userId ? `user:affinity:${userId}` : `user:affinity:guest:${guestId}`;
    
    // Lấy top 20 sản phẩm quan tâm nhất
    let productIds = await this.redis.zrevrange(key, 0, 19);
    
    // Fallback: Global Trending
    if (productIds.length < 10) {
        const trendingIds = await this.redis.zrevrange('global:trending', 0, 19);
        productIds = Array.from(new Set([...productIds, ...trendingIds]));
    }

    return productIds.slice(0, 20);
  }

  // #20 + #38: trending keywords từ AnalyticsLog.
  //
  // Strategy:
  //   1. Đọc Redis cache (5 phút) — tránh aggregate JSON mỗi request.
  //   2. Cache miss → query AnalyticsLog: eventType='SEARCH', 30 ngày gần nhất.
  //      Group theo metadata.keyword (lower-cased), order by count DESC.
  //   3. Nếu DB trả 0 row (cold start), fallback static list.
  //   4. Lưu Redis cache.
  //
  // Tradeoff: aggregate JSON path không có index → toàn bộ scan AnalyticsLog
  // 30 ngày, có thể chậm khi data lớn. Nhẹ vì cache 5 phút + LIMIT giới hạn.
  // Khi scale có thể chuyển sang stored summary table cập nhật mỗi giờ.
  async getTrendingKeywords(limit: number): Promise<{ keyword: string; count: number }[]> {
    const cached = await this.redis.get(this.TRENDING_KW_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as { keyword: string; count: number }[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.slice(0, limit);
      } catch {
        /* ignore parse error */
      }
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let result: { keyword: string; count: number }[] = [];
    try {
      // MySQL JSON_EXTRACT — chỉ áp dụng cho engine MySQL/MariaDB.
      const rows = await this.prisma.$queryRawUnsafe<
        { keyword: string; count: bigint }[]
      >(
        `SELECT
            LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.keyword')))) AS keyword,
            COUNT(*) AS count
         FROM AnalyticsLog
         WHERE eventType = 'SEARCH'
           AND createdAt >= ?
           AND JSON_EXTRACT(metadata, '$.keyword') IS NOT NULL
           AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.keyword')) <> ''
         GROUP BY keyword
         ORDER BY count DESC
         LIMIT ?`,
        since,
        limit,
      );
      result = rows
        .filter((r) => r.keyword && r.keyword.length > 1 && r.keyword.length < 50)
        .map((r) => ({ keyword: r.keyword, count: Number(r.count) }));
    } catch (e) {
      this.logger.warn(`Trending keywords aggregation failed: ${(e as Error).message}`);
    }

    if (result.length === 0) {
      // Cold-start fallback — đồng bộ với UI design (xem constants.ts FE).
      result = [
        { keyword: 'son môi mac', count: 0 },
        { keyword: 'iphone 15 pro max', count: 0 },
        { keyword: 'quà tặng 20/10', count: 0 },
        { keyword: 'giày adidas samba', count: 0 },
        { keyword: 'túi xách local brand', count: 0 },
      ].slice(0, limit);
    }

    await this.redis
      .set(this.TRENDING_KW_CACHE_KEY, JSON.stringify(result), 'EX', this.TRENDING_KW_TTL_SEC)
      .catch(() => {});

    return result;
  }
}