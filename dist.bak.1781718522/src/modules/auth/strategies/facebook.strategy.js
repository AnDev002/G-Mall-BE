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
var FacebookStrategy_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FacebookStrategy = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const config_1 = require("@nestjs/config");
const passport_facebook_1 = require("passport-facebook");
let FacebookStrategy = class FacebookStrategy extends (0, passport_1.PassportStrategy)(passport_facebook_1.Strategy, 'facebook') {
    static { FacebookStrategy_1 = this; }
    static logger = new common_1.Logger(FacebookStrategy_1.name);
    constructor(configService) {
        const clientID = configService.get('FACEBOOK_APP_ID');
        const clientSecret = configService.get('FACEBOOK_APP_SECRET');
        const callbackURL = configService.get('FACEBOOK_CALLBACK_URL');
        if (!clientID || !clientSecret || !callbackURL) {
            FacebookStrategy_1.logger.warn('FACEBOOK_APP_ID / FACEBOOK_APP_SECRET / FACEBOOK_CALLBACK_URL chưa set — Facebook login sẽ 503');
        }
        super({
            clientID: clientID || 'placeholder-not-configured',
            clientSecret: clientSecret || 'placeholder-not-configured',
            callbackURL: callbackURL || 'http://localhost:3001/auth/facebook/callback',
            profileFields: ['id', 'displayName', 'emails', 'photos'],
            scope: ['email'],
        });
    }
    async validate(accessToken, refreshToken, profile, done) {
        const email = profile.emails?.[0]?.value;
        const name = profile.displayName || email || 'Facebook User';
        const avatar = profile.photos?.[0]?.value;
        if (!email) {
            return done(new Error('Tài khoản Facebook không cấp quyền email cho ứng dụng'), false);
        }
        done(null, {
            provider: 'facebook',
            providerId: profile.id,
            email: email.toLowerCase(),
            name,
            avatar,
        });
    }
};
exports.FacebookStrategy = FacebookStrategy;
exports.FacebookStrategy = FacebookStrategy = FacebookStrategy_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], FacebookStrategy);
//# sourceMappingURL=facebook.strategy.js.map