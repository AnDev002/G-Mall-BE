import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  validateSync,
} from 'class-validator';

enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Schema cho biến môi trường. Được `ConfigModule.forRoot({ validate })` gọi
 * đúng 1 lần lúc app bootstrap. Nếu một env bắt buộc thiếu hoặc sai kiểu,
 * NestJS in lỗi chi tiết và thoát — an toàn hơn là chạy lên rồi crash runtime
 * ở một chỗ xa nguồn gốc.
 *
 * Ghi chú: chỉ liệt kê env mà nếu thiếu thì app KHÔNG chạy đúng. Env tùy
 * chọn (OPENAI_API_KEY, R2_*, GHN_TOKEN, PAY2S_API_KEY...) được validate
 * lazy ở module tương ứng khi thật sự gọi — tránh chặn dev local khi
 * feature đó chưa bật.
 */
export class EnvVars {
  @IsOptional()
  @IsEnum(NodeEnv)
  NODE_ENV?: NodeEnv;

  @IsOptional()
  @IsNumber()
  PORT?: number;

  // --- Bắt buộc ---
  @IsString()
  @IsNotEmpty({ message: 'DATABASE_URL là bắt buộc (ví dụ: mysql://user:pass@host:3306/db)' })
  DATABASE_URL: string;

  @IsString()
  @MinLength(16, { message: 'JWT_SECRET phải dài >= 16 ký tự; tạo nhanh bằng: openssl rand -hex 32' })
  JWT_SECRET: string;

  @IsString()
  @IsNotEmpty()
  REDIS_HOST: string;

  @IsNumber()
  REDIS_PORT: number;

  // --- Tùy chọn nhưng hay quên ---
  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string;

  @IsOptional()
  @IsString()
  JWT_EXPIRATION_TIME?: string;

  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;

  // URL base của Frontend — dùng để build link email (ví dụ link reset password).
  // Không bắt buộc ở boot (dev có fallback localhost), nhưng prod phải set đúng
  // để email trả link trỏ về domain đúng.
  @IsOptional()
  @IsString()
  FE_URL?: string;

  @IsOptional()
  @IsString()
  MAIL_HOST?: string;

  @IsOptional()
  @IsString()
  MAIL_USER?: string;

  @IsOptional()
  @IsString()
  MAIL_PASS?: string;

  // OAuth — tùy chọn. Thiếu thì endpoint /auth/google và /auth/facebook trả 503.
  @IsOptional()
  @IsString()
  GOOGLE_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  GOOGLE_CLIENT_SECRET?: string;

  @IsOptional()
  @IsString()
  GOOGLE_CALLBACK_URL?: string;

  @IsOptional()
  @IsString()
  FACEBOOK_APP_ID?: string;

  @IsOptional()
  @IsString()
  FACEBOOK_APP_SECRET?: string;

  @IsOptional()
  @IsString()
  FACEBOOK_CALLBACK_URL?: string;

  // wiki 0052: image search. Tùy chọn — thiếu thì /products/search/by-image trả 503.
  // Default fallback: http://localhost:8000 (clip), http://localhost:6333 (qdrant).
  @IsOptional()
  @IsString()
  CLIP_SERVICE_URL?: string;

  @IsOptional()
  @IsString()
  QDRANT_URL?: string;

  @IsOptional()
  @IsString()
  QDRANT_API_KEY?: string;

  @IsOptional()
  @IsString()
  QDRANT_COLLECTION?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const instance = plainToInstance(EnvVars, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(instance, { skipMissingProperties: false });
  if (errors.length > 0) {
    const messages = errors
      .map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`\n❌ Env validation failed:\n${messages}\n`);
  }
  return instance;
}
