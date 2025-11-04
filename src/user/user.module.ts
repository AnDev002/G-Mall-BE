// src/user/user.module.ts
import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller'; // <-- THÊM DÒNG NÀY

@Module({
  controllers: [UserController], // <-- THÊM DÒNG NÀY
  providers: [UserService],
  exports: [UserService], // <-- Export UserService tại đây
})
export class UserModule {}