// Backend/auth/guards/admin.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt.guard';
import { Reflector } from '@nestjs/core'; // <-- Import Reflector

@Injectable()
export class AdminGuard extends JwtAuthGuard implements CanActivate {
  
  // SỬA LỖI: Bỏ 'private' hoặc 'private readonly' khỏi 'reflector'
  constructor(reflector: Reflector) {
    super(reflector); // Truyền reflector thẳng lên cho lớp cha (JwtAuthGuard)
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Chạy logic xác thực JWT trước (đã đăng nhập chưa)
    const canActivate = (await super.canActivate(context)) as boolean;
    if (!canActivate) {
      return false;
    }

    // 2. Lấy thông tin user từ request
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // 3. Kiểm tra vai trò 'Admin'
    return user && user.role === 'Admin';
  }
}