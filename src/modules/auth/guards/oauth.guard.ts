import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

/**
 * Wrap AuthGuard('google') / AuthGuard('facebook') với 1 precheck env.
 *
 * Lý do: strategy bên dưới có thể load với placeholder credentials nếu env
 * thiếu (để module boot được cho dev). Nếu request thật chạm vào trong trạng
 * thái đó, passport sẽ redirect đến Google với placeholder -> Google reply
 * "invalid_client" -> UX rất confusing.
 *
 * Guard này kiểm tra env cụ thể trước khi cho request đi qua; thiếu -> 503
 * với message rõ "chưa config".
 */
@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    ensureOauthEnabled(this.configService, 'google', [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_CALLBACK_URL',
    ]);
    return super.canActivate(context);
  }
}

@Injectable()
export class FacebookOAuthGuard extends AuthGuard('facebook') {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    ensureOauthEnabled(this.configService, 'facebook', [
      'FACEBOOK_APP_ID',
      'FACEBOOK_APP_SECRET',
      'FACEBOOK_CALLBACK_URL',
    ]);
    return super.canActivate(context);
  }
}

function ensureOauthEnabled(
  configService: ConfigService,
  provider: string,
  envKeys: string[],
) {
  for (const key of envKeys) {
    if (!configService.get<string>(key)) {
      throw new ServiceUnavailableException(
        `Đăng nhập ${provider} chưa được kích hoạt (env ${key} chưa set)`,
      );
    }
  }
}
