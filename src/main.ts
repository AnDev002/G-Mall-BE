// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common'; // <-- THÊM DÒNG NÀY

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Kích hoạt CORS
  app.enableCors();

  // --- THÊM DÒNG NÀY ĐỂ KÍCH HOẠT VALIDATION ---
  // Nó sẽ tự động kiểm tra tất cả DTO (như RegisterAuthDto)
  app.useGlobalPipes(new ValidationPipe());
  // ---------------------------------------------

  // Đổi cổng của backend thành 3001
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();