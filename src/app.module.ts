// src/app.module.ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';

import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { CustomerModule } from './customer/customer.module';
import { ProductModule } from './product/product.module';
import { AppointmentModule } from './appointment/appointment.module'; // <-- THÊM DÒNG NÀY

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    
    DatabaseModule,
    
    UserModule,
    AuthModule,
    CustomerModule,
    ProductModule,
    AppointmentModule, // <-- THÊM MODULE MỚI VÀO ĐÂY
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}