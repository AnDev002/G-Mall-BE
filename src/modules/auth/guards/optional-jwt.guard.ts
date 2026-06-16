import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Wiki 0086: Optional JWT auth.
 *
 * KHÁC `JwtAuthGuard`: guard này KHÔNG kiểm tra @Public và KHÔNG short-circuit — nó LUÔN
 * chạy passport-jwt để cố populate `req.user` nếu có token hợp lệ, nhưng KHÔNG ném lỗi khi
 * thiếu/sai token (cho guest đi tiếp với req.user = null).
 *
 * Dùng cho các route "optional auth" như tracking: trước đây dùng @Public() + JwtAuthGuard,
 * nhưng JwtAuthGuard thấy @Public → return true mà KHÔNG chạy passport → req.user LUÔN undefined
 * → mọi fix dùng userId server-side (merge guest-data, affinity theo user) đều vô hiệu.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    // Luôn chạy passport (không đọc IS_PUBLIC) để thử xác thực.
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any) {
    // KHÔNG ném Unauthorized khi không có token — trả user nếu có, null nếu không.
    return user || null;
  }
}
