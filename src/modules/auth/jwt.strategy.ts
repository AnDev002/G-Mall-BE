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
    if (!payload.userId) {
        throw new UnauthorizedException('Token không hợp lệ');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị xóa.');
    }

    // [FIX H5 - wiki 0088] CHẶN user bị BAN ngay tại mỗi request. Trước đây validate() chỉ check
    // tồn tại + tokenVersion, KHÔNG xét isBanned, và toggleBanUser không bump tokenVersion → user
    // bị ban vẫn gọi mọi API (đặt đơn, rút tiền, chat) tới khi JWT hết hạn (7 ngày) = ban vô tác
    // dụng trên HTTP (WS đã check). Giờ ban có hiệu lực ở request kế tiếp.
    if (user.isBanned) {
      throw new UnauthorizedException('Tài khoản đã bị khóa.');
    }

    // Spec [0018]: tokenVersion check — sau khi đổi password, BE bump
    // user.tokenVersion. JWT cũ có version cũ -> reject -> các thiết bị khác
    // tự logout khi gọi API tiếp theo (token đã invalidate).
    // Token mới (cấp cùng lúc đổi pass) có version mới nên không bị ảnh hưởng.
    if (typeof payload.tokenVersion === 'number' && payload.tokenVersion !== user.tokenVersion) {
        throw new UnauthorizedException('Phiên đăng nhập đã hết hiệu lực, vui lòng đăng nhập lại.');
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