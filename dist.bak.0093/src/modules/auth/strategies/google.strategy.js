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
var GoogleStrategy_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleStrategy = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const config_1 = require("@nestjs/config");
const passport_google_oauth20_1 = require("passport-google-oauth20");
let GoogleStrategy = class GoogleStrategy extends (0, passport_1.PassportStrategy)(passport_google_oauth20_1.Strategy, 'google') {
    static { GoogleStrategy_1 = this; }
    static logger = new common_1.Logger(GoogleStrategy_1.name);
    constructor(configService) {
        const clientID = configService.get('GOOGLE_CLIENT_ID');
        const clientSecret = configService.get('GOOGLE_CLIENT_SECRET');
        const callbackURL = configService.get('GOOGLE_CALLBACK_URL');
        const missing = !clientID || !clientSecret || !callbackURL;
        if (missing) {
            GoogleStrategy_1.logger.warn('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_CALLBACK_URL chưa set — Google login sẽ 503');
        }
        super({
            clientID: clientID || 'placeholder-not-configured',
            clientSecret: clientSecret || 'placeholder-not-configured',
            callbackURL: callbackURL || 'http://localhost:3001/auth/google/callback',
            scope: ['email', 'profile'],
        });
    }
    async validate(accessToken, refreshToken, profile, done) {
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
};
exports.GoogleStrategy = GoogleStrategy;
exports.GoogleStrategy = GoogleStrategy = GoogleStrategy_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GoogleStrategy);
//# sourceMappingURL=google.strategy.js.map