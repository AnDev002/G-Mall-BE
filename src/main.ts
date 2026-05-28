// Backend-GMall/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BadRequestException, INestApplicationContext, ValidationPipe, ValidationError } from '@nestjs/common';
import compression from 'compression';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import cookieParser from 'cookie-parser';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

// Tạo Class Adapter Redis tùy chỉnh
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  constructor(private app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const isLocal = process.env.REDIS_HOST === 'localhost' || process.env.REDIS_HOST === '127.0.0.1';
    const socketOptions = isLocal
      ? { 
          tls: false, 
          connectTimeout: 10000 
        }
      : { 
          tls: true, 
          rejectUnauthorized: false, 
          connectTimeout: 10000 
        };
    const pubClient = createClient({
      // URL kết nối cơ bản
      url: `redis://${process.env.REDIS_PASSWORD ? ':' + process.env.REDIS_PASSWORD + '@' : ''}${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
      socket: socketOptions as any,
    });
    
    const subClient = pubClient.duplicate();

    // Thêm log lỗi để dễ debug nếu kết nối thất bại
    pubClient.on('error', (err) => console.error('Redis Pub Error:', err));
    subClient.on('error', (err) => console.error('Redis Sub Error:', err));

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());

  // Trust proxy: khi chạy sau Nginx/Render/PM2-cluster với HTTP proxy, IP client
  // thật nằm ở header X-Forwarded-For. Bật để req.ip = IP client (không phải IP
  // proxy) — quan trọng cho rate limit (RateLimitGuard) không bị tất cả traffic
  // đổ vào 1 bucket IP proxy.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // 1. Cấu hình CORS
  // Whitelist domain qua env CORS_ORIGINS (comma-separated). Kết hợp với credentials:true
  // thì origin:true (reflect) là lỗ hổng CSRF — BẮT BUỘC chỉ định danh sách cụ thể.
  // Format env: CORS_ORIGINS=http://localhost:3000,https://gmall.onrender.com
  const corsOriginsEnv = process.env.CORS_ORIGINS?.trim();
  const corsOrigins = corsOriginsEnv
    ? corsOriginsEnv.split(',').map((s) => s.trim()).filter(Boolean)
    : ['http://localhost:3000'];

  app.enableCors({
    origin: (origin, callback) => {
      // Cho phép request không có origin (Postman, server-to-server, mobile app)
      if (!origin) return callback(null, true);
      if (corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization, x-device-id, user-agent, Cache-Control, Pragma, Expires',
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });
  console.log(`✅ CORS whitelist: ${corsOrigins.join(', ')}`);

  // 2. Tối ưu & Validate
  app.use(compression());

  // i18n cho thông báo class-validator. Trước đây trả message Anh mặc định
  // ("name should not be empty") → seller QA feedback "thông báo tiếng Anh".
  // Map các constraint key phổ biến sang câu tiếng Việt; fallback giữ raw message.
  const FIELD_NAMES_VN: Record<string, string> = {
    name: 'Tên',
    email: 'Email',
    password: 'Mật khẩu',
    phone: 'Số điện thoại',
    description: 'Mô tả',
    price: 'Giá',
    stock: 'Số lượng',
    categoryId: 'Ngành hàng',
    title: 'Tiêu đề',
    code: 'Mã',
    startDate: 'Ngày bắt đầu',
    endDate: 'Ngày kết thúc',
  };
  const fieldLabel = (raw: string) => FIELD_NAMES_VN[raw] || `Trường "${raw}"`;
  const translateConstraint = (key: string, raw: string, field: string): string => {
    const label = fieldLabel(field);
    const map: Record<string, string> = {
      isNotEmpty: `${label} không được để trống`,
      isString: `${label} phải là chuỗi ký tự`,
      isEmail: `${label} không đúng định dạng email`,
      isInt: `${label} phải là số nguyên`,
      isNumber: `${label} phải là số`,
      isBoolean: `${label} phải là true/false`,
      isArray: `${label} phải là danh sách`,
      isDateString: `${label} phải là ngày hợp lệ`,
      isUrl: `${label} phải là URL hợp lệ`,
      arrayNotEmpty: `${label} không được rỗng`,
      isDefined: `${label} là bắt buộc`,
    };
    if (map[key]) return map[key];
    const minLen = raw.match(/must be longer than or equal to (\d+) characters?/i);
    if (minLen) return `${label} phải có ít nhất ${minLen[1]} ký tự`;
    const maxLen = raw.match(/must be shorter than or equal to (\d+) characters?/i);
    if (maxLen) return `${label} không được dài quá ${maxLen[1]} ký tự`;
    const min = raw.match(/must not be less than (\d+)/i);
    if (min) return `${label} không được nhỏ hơn ${min[1]}`;
    const max = raw.match(/must not be greater than (\d+)/i);
    if (max) return `${label} không được lớn hơn ${max[1]}`;
    return raw;
  };
  const flattenErrors = (errs: ValidationError[], parentField = ''): string[] => {
    const out: string[] = [];
    for (const e of errs) {
      const field = parentField ? `${parentField}.${e.property}` : e.property;
      if (e.constraints) {
        for (const [k, v] of Object.entries(e.constraints)) {
          out.push(translateConstraint(k, v, e.property));
        }
      }
      if (e.children?.length) out.push(...flattenErrors(e.children, field));
    }
    return out;
  };

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors: ValidationError[]) => {
        // Trả message luôn dạng string (join nếu nhiều) — đồng nhất với các
        // BadRequestException khác trong codebase (BE throw string), không break
        // FE handlers chỉ check `typeof message === 'string'`. Vẫn expose `messages`
        // (array) ở extra field cho client nào cần render từng dòng.
        const messages = flattenErrors(errors);
        const joined = messages.length ? messages.join('; ') : 'Dữ liệu không hợp lệ';
        return new BadRequestException({
          statusCode: 400,
          message: joined,
          messages,
          error: 'Bad Request',
        });
      },
    }),
  );

  // 2b. Global Prisma exception filter — map Prisma errors → HTTP 4xx
  // (xem docs/wiki/decisions/0029-fix-13-bugs-from-test-suite.md). Trước đây
  // Prisma throw từ service không catch → leak 500 + stack. Filter này map
  // unique/FK/not-found → 409/400/404 đúng semantics.
  app.useGlobalFilters(new PrismaExceptionFilter());

  // 3. Cấu hình Redis Adapter cho Socket.io (Cluster Support)
  const redisIoAdapter = new RedisIoAdapter(app);
  try {
    await redisIoAdapter.connectToRedis();
    app.useWebSocketAdapter(redisIoAdapter);
    console.log('✅ Redis Adapter for WebSocket connected successfully.');
  } catch (error) {
    console.error('❌ Failed to connect Redis Adapter:', error);
  }

  // 4. Chạy server
  await app.listen(process.env.PORT ?? 3001);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();