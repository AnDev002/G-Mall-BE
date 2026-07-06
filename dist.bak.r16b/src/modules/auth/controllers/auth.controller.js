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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth.service");
const public_decorator_1 = require("../../../common/decorators/public.decorator");
const jwt_guard_1 = require("../guards/jwt.guard");
const client_1 = require("@prisma/client");
const roles_guard_1 = require("../../../common/guards/roles.guard");
const roles_decorator_1 = require("../../../common/decorators/roles.decorator");
const user_decorator_1 = require("../../../common/decorators/user.decorator");
const rate_limit_guard_1 = require("../../../common/guards/rate-limit.guard");
const oauth_guard_1 = require("../guards/oauth.guard");
const config_1 = require("@nestjs/config");
const update_shop_dto_1 = require("../dto/update-shop.dto");
const auth_dto_1 = require("../dto/auth.dto");
const register_seller_dto_1 = require("../dto/register-seller.dto");
const password_dto_1 = require("../dto/password.dto");
const update_profile_dto_1 = require("../dto/update-profile.dto");
let AuthController = class AuthController {
    authService;
    configService;
    constructor(authService, configService) {
        this.authService = authService;
        this.configService = configService;
    }
    setAuthCookie(res, token) {
        const isProd = process.env.NODE_ENV === 'production';
        res.cookie('accessToken', token, {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/',
        });
    }
    async register(dto) {
        return this.authService.register(dto);
    }
    async registerSeller(body) {
        return this.authService.registerSeller(body);
    }
    async login(dto, res) {
        const data = await this.authService.login(dto, [client_1.Role.BUYER]);
        this.setAuthCookie(res, data.access_token);
        return { user: data.user };
    }
    async loginSeller(dto, res) {
        const data = await this.authService.login(dto, [client_1.Role.SELLER]);
        this.setAuthCookie(res, data.access_token);
        return { user: data.user };
    }
    async logout(res) {
        const isProd = process.env.NODE_ENV === 'production';
        res.clearCookie('accessToken', {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? 'none' : 'lax',
            path: '/',
        });
        return { message: 'Đăng xuất thành công' };
    }
    async loginAdmin(dto, res) {
        const data = await this.authService.login(dto, [client_1.Role.ADMIN]);
        this.setAuthCookie(res, data.access_token);
        return { user: data.user };
    }
    async sendOtp(dto) {
        const r = await this.authService.sendOtp(dto.email);
        const includeDevOtp = !r.mailConfigured && process.env.NODE_ENV !== 'production';
        return { message: 'Đã gửi lại mã OTP', ...(includeDevOtp ? { devOtp: r.otp } : {}) };
    }
    async verifyOtp(dto, res) {
        const data = await this.authService.verifyOtp(dto);
        this.setAuthCookie(res, data.access_token);
        return { user: data.user };
    }
    oauthStatus() {
        return {
            google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL),
            facebook: !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET && process.env.FACEBOOK_CALLBACK_URL),
        };
    }
    async updateShopProfile(user, body) {
        return this.authService.updateShopProfile(user.id, body);
    }
    async getProfile(user) {
        return this.authService.getUserProfile(user.id);
    }
    async updateProfile(user, dto) {
        return this.authService.updateProfile(user.id, dto);
    }
    async changePassword(user, dto, res) {
        const result = await this.authService.changePassword(user.id, dto);
        if (result?.access_token)
            this.setAuthCookie(res, result.access_token);
        return result;
    }
    async forgotPassword(dto) {
        return this.authService.forgotPassword(dto);
    }
    async resetPassword(dto) {
        return this.authService.resetPassword(dto);
    }
    async googleAuth() {
    }
    async googleCallback(req, res) {
        const feUrl = (this.configService.get('FE_URL') ?? 'http://localhost:3000').replace(/\/$/, '');
        try {
            const data = await this.authService.handleOAuthLogin(req.user);
            this.setAuthCookie(res, data.access_token);
            res.redirect(`${feUrl}/`);
        }
        catch (e) {
            const reason = e instanceof common_1.UnauthorizedException ? 'account_locked' : 'oauth_failed';
            res.redirect(`${feUrl}/login?oauth_error=${reason}`);
        }
    }
    async facebookAuth() { }
    async facebookCallback(req, res) {
        const feUrl = (this.configService.get('FE_URL') ?? 'http://localhost:3000').replace(/\/$/, '');
        try {
            const data = await this.authService.handleOAuthLogin(req.user);
            this.setAuthCookie(res, data.access_token);
            res.redirect(`${feUrl}/`);
        }
        catch (e) {
            const reason = e instanceof common_1.UnauthorizedException ? 'account_locked' : 'oauth_failed';
            res.redirect(`${feUrl}/login?oauth_error=${reason}`);
        }
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(rate_limit_guard_1.RateLimitGuard),
    (0, rate_limit_guard_1.RateLimit)({ points: 5, windowSeconds: 60, keyBy: 'ip+path' }),
    (0, common_1.Post)('register'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.RegisterDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(rate_limit_guard_1.RateLimitGuard),
    (0, rate_limit_guard_1.RateLimit)({ points: 5, windowSeconds: 60, keyBy: 'ip+path' }),
    (0, common_1.Post)('register/seller'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_seller_dto_1.RegisterSellerDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "registerSeller", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(rate_limit_guard_1.RateLimitGuard),
    (0, rate_limit_guard_1.RateLimit)({ points: 10, windowSeconds: 60, keyBy: 'body.email+path' }),
    (0, common_1.Post)('login'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.LoginDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(rate_limit_guard_1.RateLimitGuard),
    (0, rate_limit_guard_1.RateLimit)({ points: 10, windowSeconds: 60, keyBy: 'body.email+path' }),
    (0, common_1.Post)('login/seller'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.LoginDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "loginSeller", null);
__decorate([
    (0, common_1.Post)('logout'),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(rate_limit_guard_1.RateLimitGuard),
    (0, rate_limit_guard_1.RateLimit)({ points: 10, windowSeconds: 60, keyBy: 'body.email+path' }),
    (0, common_1.Post)('login/admin'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.LoginDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "loginAdmin", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(rate_limit_guard_1.RateLimitGuard),
    (0, rate_limit_guard_1.RateLimit)({ points: 3, windowSeconds: 60, keyBy: 'body.email+path' }),
    (0, common_1.Post)('send-otp'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.SendOtpDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "sendOtp", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('verify-otp'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.VerifyOtpDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verifyOtp", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('oauth-status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "oauthStatus", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('SELLER'),
    (0, common_1.Put)('seller/profile'),
    __param(0, (0, user_decorator_1.User)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_shop_dto_1.UpdateShopProfileDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "updateShopProfile", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Get)('me'),
    __param(0, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "getProfile", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Put)('profile'),
    __param(0, (0, user_decorator_1.User)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_profile_dto_1.UpdateProfileDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Post)('change-password'),
    __param(0, (0, user_decorator_1.User)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, password_dto_1.ChangePasswordDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "changePassword", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(rate_limit_guard_1.RateLimitGuard),
    (0, rate_limit_guard_1.RateLimit)({ points: 3, windowSeconds: 60, keyBy: 'body.email+path' }),
    (0, common_1.Post)('forgot-password'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [password_dto_1.ForgotPasswordDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "forgotPassword", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(rate_limit_guard_1.RateLimitGuard),
    (0, rate_limit_guard_1.RateLimit)({ points: 10, windowSeconds: 60, keyBy: 'body.email+path' }),
    (0, common_1.Post)('reset-password'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [password_dto_1.ResetPasswordDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "resetPassword", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(oauth_guard_1.GoogleOAuthGuard),
    (0, common_1.Get)('google'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "googleAuth", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(oauth_guard_1.GoogleOAuthGuard),
    (0, common_1.Get)('google/callback'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "googleCallback", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(oauth_guard_1.FacebookOAuthGuard),
    (0, common_1.Get)('facebook'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "facebookAuth", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(oauth_guard_1.FacebookOAuthGuard),
    (0, common_1.Get)('facebook/callback'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "facebookCallback", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        config_1.ConfigService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map