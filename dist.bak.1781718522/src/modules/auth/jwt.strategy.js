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
exports.JwtStrategy = void 0;
const passport_jwt_1 = require("passport-jwt");
const passport_1 = require("@nestjs/passport");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const extractJwtFromCookie = (req) => {
    if (req.cookies && req.cookies.accessToken) {
        return req.cookies.accessToken;
    }
    return null;
};
let JwtStrategy = class JwtStrategy extends (0, passport_1.PassportStrategy)(passport_jwt_1.Strategy) {
    prisma;
    constructor(prisma, configService) {
        super({
            jwtFromRequest: passport_jwt_1.ExtractJwt.fromExtractors([
                passport_jwt_1.ExtractJwt.fromAuthHeaderAsBearerToken(),
                extractJwtFromCookie,
            ]),
            ignoreExpiration: false,
            secretOrKey: configService.getOrThrow('JWT_SECRET'),
        });
        this.prisma = prisma;
    }
    async validate(payload) {
        if (!payload.userId) {
            throw new common_1.UnauthorizedException('Token không hợp lệ');
        }
        const user = await this.prisma.user.findUnique({
            where: { id: payload.userId },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('Tài khoản không tồn tại hoặc đã bị xóa.');
        }
        if (user.isBanned) {
            throw new common_1.UnauthorizedException('Tài khoản đã bị khóa.');
        }
        if (typeof payload.tokenVersion === 'number' && payload.tokenVersion !== user.tokenVersion) {
            throw new common_1.UnauthorizedException('Phiên đăng nhập đã hết hiệu lực, vui lòng đăng nhập lại.');
        }
        return {
            id: user.id,
            userId: user.id,
            email: user.email,
            role: user.role,
            shopName: user.shopName,
        };
    }
};
exports.JwtStrategy = JwtStrategy;
exports.JwtStrategy = JwtStrategy = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], JwtStrategy);
//# sourceMappingURL=jwt.strategy.js.map