import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy, Profile } from 'passport-facebook';

/**
 * Facebook OAuth strategy. Xem comment chi tiết ở google.strategy.ts —
 * pattern tương tự, khác ở field names mà FB trả.
 *
 * Cần env: FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, FACEBOOK_CALLBACK_URL.
 * Lưu ý: FB App ở production phải qua app review để request `email` scope;
 * dev mode thì chỉ admin/test user của app đọc được.
 */
@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  private static readonly logger = new Logger(FacebookStrategy.name);

  constructor(configService: ConfigService) {
    const clientID = configService.get<string>('FACEBOOK_APP_ID');
    const clientSecret = configService.get<string>('FACEBOOK_APP_SECRET');
    const callbackURL = configService.get<string>('FACEBOOK_CALLBACK_URL');

    if (!clientID || !clientSecret || !callbackURL) {
      FacebookStrategy.logger.warn(
        'FACEBOOK_APP_ID / FACEBOOK_APP_SECRET / FACEBOOK_CALLBACK_URL chưa set — Facebook login sẽ 503',
      );
    }

    super({
      clientID: clientID || 'placeholder-not-configured',
      clientSecret: clientSecret || 'placeholder-not-configured',
      callbackURL: callbackURL || 'http://localhost:3001/auth/facebook/callback',
      profileFields: ['id', 'displayName', 'emails', 'photos'],
      scope: ['email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (err: any, user?: any) => void,
  ) {
    const email = profile.emails?.[0]?.value;
    const name = profile.displayName || email || 'Facebook User';
    const avatar = profile.photos?.[0]?.value;

    // FB có thể không trả email nếu user không grant (khác Google — Google luôn có).
    // Trong trường hợp đó, dùng providerId + placeholder email để vẫn tạo được user,
    // nhưng tốt hơn là require scope email. Ở đây reject nếu thiếu email để flow rõ
    // ràng — user phải grant email mới login được.
    if (!email) {
      return done(
        new Error('Tài khoản Facebook không cấp quyền email cho ứng dụng'),
        false,
      );
    }

    done(null, {
      provider: 'facebook',
      providerId: profile.id,
      email: email.toLowerCase(),
      name,
      avatar,
    });
  }
}
