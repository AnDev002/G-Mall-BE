"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FacebookOAuthGuard = exports.GoogleOAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const config_1 = require("@nestjs/config");
let GoogleOAuthGuard = class GoogleOAuthGuard extends (0, passport_1.AuthGuard)('google') {
    configService;
    constructor(configService) {
        super();
        this.configService = configService;
    }
    canActivate(context) {
        ensureOauthEnabled(this.configService, 'google', [
            'GOOGLE_CLIENT_ID',
            'GOOGLE_CLIENT_SECRET',
            'GOOGLE_CALLBACK_URL',
        ]);
        return super.canActivate(context);
    }
};
exports.GoogleOAuthGuard = GoogleOAuthGuard;
exports.GoogleOAuthGuard = GoogleOAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GoogleOAuthGuard);
let FacebookOAuthGuard = class FacebookOAuthGuard extends (0, passport_1.AuthGuard)('facebook') {
    configService;
    constructor(configService) {
        super();
        this.configService = configService;
    }
    canActivate(context) {
        ensureOauthEnabled(this.configService, 'facebook', [
            'FACEBOOK_APP_ID',
            'FACEBOOK_APP_SECRET',
            'FACEBOOK_CALLBACK_URL',
        ]);
        return super.canActivate(context);
    }
};
exports.FacebookOAuthGuard = FacebookOAuthGuard;
exports.FacebookOAuthGuard = FacebookOAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], FacebookOAuthGuard);
function ensureOauthEnabled(configService, provider, envKeys) {
    for (const key of envKeys) {
        if (!configService.get(key)) {
            throw new common_1.ServiceUnavailableException(`Đăng nhập ${provider} chưa được kích hoạt (env ${key} chưa set)`);
        }
    }
}
//# sourceMappingURL=oauth.guard.js.map