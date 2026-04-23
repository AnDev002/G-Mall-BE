import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';

/**
 * Google OAuth 2.0 strategy.
 *
 * Flow:
 *  1. FE gọi `GET <BE>/auth/google` -> Guard `AuthGuard('google')` redirect
 *     user tới Google login.
 *  2. Google callbacks `GET <BE>/auth/google/callback?code=...`.
 *  3. passport-google-oauth20 exchange code -> profile, gọi `validate()` ở đây.
 *  4. Return object đi vào req.user ở controller, controller tạo JWT và redirect
 *     về FE.
 *
 * Cần env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL.
 * Nếu thiếu, strategy vẫn register nhưng log warning và throw khi có request
 * thật chạm vào (xem `OptionalOAuthGuard`). Tránh việc dev local chưa có
 * Google credentials nhưng vẫn muốn app boot.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private static readonly logger = new Logger(GoogleStrategy.name);

  constructor(configService: ConfigService) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackURL = configService.get<string>('GOOGLE_CALLBACK_URL');

    // passport-google-oauth20 yêu cầu các giá trị này phải là string non-empty
    // lúc construct. Dùng placeholder khi thiếu để module load được — guard
    // bảo vệ endpoint thực tế sẽ throw 503 nếu env chưa set.
    const missing = !clientID || !clientSecret || !callbackURL;
    if (missing) {
      GoogleStrategy.logger.warn(
        'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_CALLBACK_URL chưa set — Google login sẽ 503',
      );
    }

    super({
      clientID: clientID || 'placeholder-not-configured',
      clientSecret: clientSecret || 'placeholder-not-configured',
      callbackURL: callbackURL || 'http://localhost:3001/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  /**
   * Gọi bởi passport sau khi Google trả profile. Return value đi vào req.user
   * ở controller. Không tự tạo/tìm user ở đây — để service quản lý (separation
   * of concerns).
   */
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const email = profile.emails?.[0]?.value;
    const name = profile.displayName || email || 'Google User';
    const avatar = profile.photos?.[0]?.value;

    if (!email) {
      return done(new Error('Google profile không có email'), false);
    }

    done(null, {
      provider: 'google',
      providerId: profile.id,
      email: email.toLowerCase(),
      name,
      avatar,
    });
  }
}
