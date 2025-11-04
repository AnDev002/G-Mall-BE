// src/database/prisma/prisma.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    // Hàm này sẽ tự động chạy khi module được khởi tạo
    await this.$connect();
    console.log('✅ Đã kết nối thành công tới database MySQL.');
  }
}