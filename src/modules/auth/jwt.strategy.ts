import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../database/prisma/prisma.service';

const extractJwtFromCookie = (req: Request) => {
  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }
  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    // Dùng getOrThrow để đồng bộ với AuthModule.JwtModule — nếu thiếu env thì
    // boot fail sớm. Trước đây strategy default 'super_secret_key' còn module
    // default 'secret_mac_dinh_123' → sign/verify dùng hai khóa khác nhau,
    // token mới tạo sẽ luôn 401 khi verify, khó debug.
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        extractJwtFromCookie,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // [DEBUG] In ra để kiểm tra xem Token có đúng userId không
    console.log(`[JwtStrategy] Validating userId: ${payload.userId}`);

    if (!payload.userId) {
        console.error('[JwtStrategy] Token invalid: missing userId');
        throw new UnauthorizedException('Token không hợp lệ');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      console.error(`[JwtStrategy] User not found in DB (ID: ${payload.userId})`);
      // User trong token không khớp với DB (do reset DB hoặc user bị xóa)
      throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị xóa.');
    }

    // Trả về user để gắn vào req.user.
    // Cả `id` và `userId` để backward-compat: nhiều controller cũ (admin-users,
    // cart, chat, shop, ...) đọc `req.user.userId`, file mới đọc `req.user.id`.
    // Trả 2 alias tránh phải refactor 10+ chỗ và tránh regression khi ai đó
    // không biết convention.
    return {
        id: user.id,
        userId: user.id,
        email: user.email,
        role: user.role,
        shopName: user.shopName,
    };
  }
}