// src/tracking/tracking.processor.ts
import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT } from 'src/database/redis/redis.constants';
import { Redis } from 'ioredis';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { TrackingService } from './tracking.service';
import { EventType } from './dto/track-event.dto';

@Injectable()
export class TrackingProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrackingProcessor.name);
  private readonly STREAM_KEY = 'tracking_stream';
  private readonly GROUP_NAME = 'analytics_group';
  private readonly CONSUMER_NAME = `worker-${Math.random().toString(36).substring(7)}`;

  private readonly BATCH_SIZE = 500;
  private readonly FLUSH_INTERVAL = 5000; // 5 giây

  // Buffer lưu cả Data và Redis Message ID để ACK sau
  private logBuffer: { data: any, msgId: string }[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isRunning = true;

  // Fix B-NEW-PERF-2 (wiki 0029): DEDICATED ioredis client cho blocking
  // XREADGROUP BLOCK. Trước đây share REDIS_CLIENT singleton -> XREADGROUP
  // BLOCK 5000ms queue mọi command khác trên connection -> rate-limit guard
  // INCR/EXPIRE phải đợi 5s+5s = 10s. Đây là ioredis anti-pattern documented:
  // commands on a blocking connection are serialized.
  private blockingClient: Redis;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly trackingService: TrackingService,
    private readonly configService: ConfigService,
  ) {
    const host = configService.get<string>('REDIS_HOST');
    const port = Number(configService.get<string | number>('REDIS_PORT'));
    const password = configService.get<string>('REDIS_PASSWORD');
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    this.blockingClient = new Redis({
      host,
      port,
      password: password || undefined,
      tls: isLocal ? undefined : { rejectUnauthorized: false },
    });
  }

  async onModuleInit() {
    await this.initConsumerGroup();
    this.runWorker();
    this.flushTimer = setInterval(() => this.flushLogsToDB(), this.FLUSH_INTERVAL);
  }

  async onModuleDestroy() {
    this.isRunning = false;
    if (this.flushTimer) clearInterval(this.flushTimer);
    await this.flushLogsToDB();
    await this.blockingClient.quit().catch(() => {});
  }

  async initConsumerGroup() {
    try {
      // Tạo group, start từ đầu ($) hoặc số 0 (0) tùy nhu cầu
      await this.redis.xgroup('CREATE', this.STREAM_KEY, this.GROUP_NAME, '$', 'MKSTREAM');
      this.logger.log(`✅ Consumer Group ${this.GROUP_NAME} created.`);
    } catch (e) {
      if (!e.message.includes('BUSYGROUP')) {
        this.logger.error(`Init Group Error: ${e.message}`);
      }
    }
  }

  async runWorker() {
    this.logger.log(`🚀 Worker ${this.CONSUMER_NAME} Started.`);
    
    while (this.isRunning) {
      try {
        // Dùng blockingClient riêng (KHÔNG phải this.redis) — nếu dùng singleton,
        // BLOCK 5000ms sẽ queue mọi rate-limit/cart/cache op khác trên connection.
        const streams = await this.blockingClient.xreadgroup(
          'GROUP', this.GROUP_NAME, this.CONSUMER_NAME,
          'COUNT', 100,
          'BLOCK', 5000,
          'STREAMS', this.STREAM_KEY, '>'
        ) as any;

        if (streams && streams.length > 0) {
          const events = streams[0][1];

          for (const [msgId, fields] of events) {
            const dataFieldIdx = fields.indexOf('data');
            if (dataFieldIdx === -1) {
                // Message lỗi, ACK luôn để bỏ qua
                await this.redis.xack(this.STREAM_KEY, this.GROUP_NAME, msgId);
                continue;
            }
            
            try {
                const payload = JSON.parse(fields[dataFieldIdx + 1]);

                // 1. XỬ LÝ HOT DATA (Redis Score) - Realtime
                // Nếu lỗi bước này, vẫn cho qua để ghi log vào DB (quan trọng hơn)
                try {
                    if (payload.type === EventType.IDENTIFY) {
                        // Wiki 0084: merge target = payload.userId (controller set server-side từ auth),
                        // KHÔNG dùng payload.targetId (client gửi → có thể poison gợi ý của user khác).
                        if (payload.metadata?.guestId && payload.userId) {
                            await this.trackingService.mergeGuestData(payload.metadata.guestId, payload.userId);
                        }
                    } else {
                        await this.trackingService.updateAffinityScore(payload);
                    }
                } catch (redisErr) {
                    this.logger.error(`Redis Score Error: ${redisErr.message}`);
                }

                // 2. Đẩy vào Buffer (Chờ ghi MySQL)
                this.logBuffer.push({
                    msgId: msgId, // Giữ ID để ACK sau
                    data: {
                        id: payload.id, 
                        userId: payload.userId || null,
                        guestId: payload.guestId || 'unknown',
                        eventType: payload.type,
                        targetId: payload.targetId !== 'none' ? payload.targetId : null,
                        metadata: payload.metadata || {},
                        createdAt: new Date(payload.serverTimestamp || Date.now())
                    }
                });

            } catch (innerErr) {
                this.logger.error(`Msg Process Error ${msgId}: ${innerErr.message}`);
                // Message lỗi format JSON -> ACK luôn để không bị kẹt
                await this.redis.xack(this.STREAM_KEY, this.GROUP_NAME, msgId);
            }
          }

          // Kiểm tra buffer đầy
          if (this.logBuffer.length >= this.BATCH_SIZE) {
             await this.flushLogsToDB();
          }
        }
      } catch (err) {
        // Lỗi kết nối Redis, chờ xíu rồi thử lại
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  // --- HÀM FLUSH QUAN TRỌNG ---
  private async flushLogsToDB() {
    if (this.logBuffer.length === 0) return;

    // Snapshot buffer hiện tại
    const currentBatch = [...this.logBuffer];
    this.logBuffer = []; 

    try {
      this.logger.log(`💾 Flushing ${currentBatch.length} logs to MySQL...`);
      
      const records = currentBatch.map(b => b.data);
      const msgIds = currentBatch.map(b => b.msgId);

      // 1. Bulk Insert vào MySQL
      await this.prisma.analyticsLog.createMany({ 
          data: records,
          skipDuplicates: true 
      });

      // 2. ACK message trên Redis SAU KHI ghi DB thành công
      // Đây là mấu chốt để không mất dữ liệu
      if (msgIds.length > 0) {
          await this.redis.xack(this.STREAM_KEY, this.GROUP_NAME, ...msgIds);
          // (Tùy chọn) Xóa message đã xử lý khỏi Stream để tiết kiệm RAM
          // await this.redis.xdel(this.STREAM_KEY, ...msgIds); 
      }

    } catch (e) {
      this.logger.error(`Failed to flush logs to DB: ${e.message}`);
      // NẾU GHI DB LỖI: Đẩy lại vào đầu buffer để lần sau thử lại
      // (Hoặc ghi ra file dead-letter-queue nếu lỗi quá nhiều lần)
      this.logBuffer = [...currentBatch, ...this.logBuffer];
    }
  }
}