import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from './redis.service';
import { REDIS_CLIENT } from './redis.constants'; // <--- IMPORT TỪ FILE MỚI

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: async (configService: ConfigService) => {
        const host = configService.get<string>('REDIS_HOST');
        const port = Number(configService.get<string | number>('REDIS_PORT'));
        const password = configService.get<string>('REDIS_PASSWORD');
        const isLocal = host === 'localhost' || host === '127.0.0.1';

        const client = new Redis({
          host,
          port,
          password: password || undefined,
          tls: isLocal ? undefined : { rejectUnauthorized: false },
          maxRetriesPerRequest: 3,
        });
        client.on('error', (err) => console.error('[REDIS_CLIENT]', err.message));
        client.on('reconnecting', () => console.warn('[REDIS_CLIENT] reconnecting...'));
        return client;
      },
      inject: [ConfigService],
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}