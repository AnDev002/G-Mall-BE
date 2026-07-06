"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const mailer_1 = require("@nestjs-modules/mailer");
const bcrypt = __importStar(require("bcrypt"));
const redis_service_1 = require("../../database/redis/redis.service");
const client_1 = require("@prisma/client");
function generateSlug(text) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}
let AuthService = class AuthService {
    static { AuthService_1 = this; }
    prisma;
    redisService;
    jwtService;
    mailerService;
    static OTP_TTL_SECONDS = 5 * 60;
    static OTP_KEY_PREFIX = 'otp:';
    static PWD_RESET_TTL_SECONDS = 5 * 60;
    static PWD_RESET_KEY_PREFIX = 'pwd_reset:';
    constructor(prisma, redisService, jwtService, mailerService) {
        this.prisma = prisma;
        this.redisService = redisService;
        this.jwtService = jwtService;
        this.mailerService = mailerService;
    }
    otpKey(email) {
        return `${AuthService_1.OTP_KEY_PREFIX}${email.toLowerCase()}`;
    }
    pwdResetKey(email) {
        return `${AuthService_1.PWD_RESET_KEY_PREFIX}${email.toLowerCase()}`;
    }
    async register(dto) {
        const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (existing) {
            throw new common_1.BadRequestException('Email đã tồn tại');
        }
        const hashedPassword = await bcrypt.hash(dto.password, 10);
        const user = await this.prisma.user.create({
            data: {
                email: dto.email,
                password: hashedPassword,
                name: dto.name,
                role: 'BUYER',
                isVerified: false,
            },
        });
        await this.prisma.cart.create({ data: { userId: user.id } });
        const otpResult = await this.sendOtp(user.email ?? undefined);
        const includeDevOtp = !otpResult.mailConfigured && process.env.NODE_ENV !== 'production';
        return {
            message: 'Đăng ký thành công. Vui lòng kiểm tra email để nhập OTP.',
            ...(includeDevOtp ? { devOtp: otpResult.otp } : {}),
        };
    }
    async registerSeller(dto) {
        const { email, password, name, shopName, pickupAddress, phoneNumber, provinceId, districtId, wardCode, lat, lng, businessLicenseFront, businessLicenseBack, categoryId } = dto;
        const existingPhone = await this.prisma.user.findFirst({ where: { phone: phoneNumber } });
        if (existingPhone) {
            throw new common_1.BadRequestException('Số điện thoại đã được sử dụng');
        }
        const existing = await this.prisma.user.findUnique({ where: { email } });
        if (existing)
            throw new common_1.BadRequestException('Email đã tồn tại');
        const hashedPassword = await bcrypt.hash(password, 10);
        const slug = generateSlug(shopName);
        const existingSlug = await this.prisma.shop.findUnique({ where: { slug } });
        if (existingSlug)
            throw new common_1.BadRequestException('Tên Shop đã tồn tại, vui lòng chọn tên khác');
        await this.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name: name,
                    role: client_1.Role.BUYER,
                    isVerified: false,
                    phone: phoneNumber,
                },
            });
            await tx.shop.create({
                data: {
                    ownerId: user.id,
                    name: shopName,
                    categoryId: categoryId,
                    slug: slug,
                    address: pickupAddress,
                    provinceId: Number(provinceId) || 201,
                    districtId: Number(districtId) || 1484,
                    wardCode: wardCode || "1A0104",
                    lat: lat ? Number(lat) : undefined,
                    lng: lng ? Number(lng) : undefined,
                    businessLicenseFront: businessLicenseFront,
                    businessLicenseBack: businessLicenseBack,
                    status: client_1.ShopStatus.PENDING,
                }
            });
        });
        if (email) {
            void this.sendOtp(email);
        }
        return { message: 'Đăng ký người bán thành công. Vui lòng xác thực OTP.' };
    }
    async login(dto, allowedRoles) {
        const user = await this.prisma.user.findFirst({ where: { OR: [{ email: dto.email }, { username: dto.email }] } });
        if (!user)
            throw new common_1.UnauthorizedException('Email hoặc mật khẩu không đúng');
        if (user.isBanned) {
            throw new common_1.UnauthorizedException('Tài khoản đã bị khóa.');
        }
        if (!user.password) {
            throw new common_1.UnauthorizedException('Tài khoản chưa thiết lập mật khẩu.');
        }
        const isMatch = await bcrypt.compare(dto.password, user.password);
        if (!isMatch)
            throw new common_1.UnauthorizedException('Email hoặc mật khẩu không đúng');
        if (!user.isVerified) {
            await this.sendOtp(user.email ?? undefined);
            throw new common_1.UnauthorizedException('Tài khoản chưa xác thực. Vui lòng kiểm tra OTP.');
        }
        if (allowedRoles && !allowedRoles.includes(user.role)) {
            throw new common_1.UnauthorizedException('Bạn không có quyền truy cập vào khu vực này.');
        }
        return this.generateTokens(user);
    }
    async verifyOtp(dto) {
        const normalizedEmail = dto.email.toLowerCase();
        const storedOtp = await this.redisService.get(this.otpKey(normalizedEmail));
        if (!storedOtp) {
            throw new common_1.UnauthorizedException('Mã OTP không tồn tại hoặc đã hết hạn.');
        }
        if (storedOtp !== dto.otp) {
            const failKey = `otp_fail:${normalizedEmail}`;
            const fails = await this.redisService.getClient().incr(failKey);
            if (fails === 1)
                await this.redisService.getClient().expire(failKey, 300);
            if (fails > 5) {
                throw new common_1.UnauthorizedException('Nhập sai OTP quá nhiều lần. Vui lòng thử lại sau ít phút hoặc yêu cầu mã mới.');
            }
            throw new common_1.UnauthorizedException('Mã OTP không đúng');
        }
        await this.redisService.del(this.otpKey(normalizedEmail));
        await this.redisService.del(`otp_fail:${normalizedEmail}`);
        const user = await this.prisma.user.update({
            where: { email: normalizedEmail },
            data: { isVerified: true },
        });
        return this.generateTokens(user);
    }
    isMailConfigured() {
        return !!(process.env.MAIL_USER && process.env.MAIL_PASS);
    }
    async sendOtp(email) {
        const mailConfigured = this.isMailConfigured();
        if (!email)
            return { otp: null, mailConfigured };
        const normalizedEmail = email.toLowerCase();
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await this.redisService.set(this.otpKey(normalizedEmail), otp, AuthService_1.OTP_TTL_SECONDS);
        console.log(`>>> [DEBUG] OTP cho ${normalizedEmail}: ${otp}`);
        if (mailConfigured) {
            void this.mailerService
                .sendMail({
                to: normalizedEmail,
                subject: 'Mã xác thực GMall',
                html: `<b>Mã OTP của bạn là: ${otp}</b>. Có hiệu lực trong 5 phút.`,
            })
                .catch((error) => console.log('>>> [WARNING] Lỗi gửi mail:', error.message));
        }
        else {
            console.log(`>>> [WARNING] MAIL_USER/MAIL_PASS chưa cấu hình — OTP cho ${normalizedEmail} KHÔNG gửi qua email. ` +
                `Set MAIL_USER/MAIL_PASS (.env) để bật gửi email ở production.`);
        }
        return { otp, mailConfigured };
    }
    generateTokens(user) {
        const payload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            tokenVersion: user.tokenVersion ?? 0,
        };
        const { password, ...userInfo } = user;
        return {
            access_token: this.jwtService.sign(payload),
            user: { ...userInfo, point: userInfo.points },
        };
    }
    async updateShopProfile(userId, data) {
        const shop = await this.prisma.shop.findUnique({
            where: { ownerId: userId }
        });
        if (!shop) {
            throw new common_1.NotFoundException('Cửa hàng không tồn tại.');
        }
        if (data.shopName && data.shopName !== shop.name) {
            const existingSlug = await this.prisma.shop.findFirst({
                where: {
                    name: data.shopName,
                    id: { not: shop.id }
                }
            });
            if (existingSlug) {
                throw new common_1.ConflictException('Tên Shop đã tồn tại, vui lòng chọn tên khác.');
            }
        }
        const updatedShop = await this.prisma.shop.update({
            where: { id: shop.id },
            data: {
                name: data.shopName,
                pickupAddress: data.pickupAddress,
                description: data.description,
                avatar: data.avatar,
                coverImage: data.cover,
                businessLicenseFront: data.businessLicenseFront,
                businessLicenseBack: data.businessLicenseBack,
                salesLicense: data.salesLicense,
                trademarkCert: data.trademarkCert,
                distributorCert: data.distributorCert,
            },
        });
        return {
            message: 'Cập nhật hồ sơ Shop thành công',
            shop: updatedShop
        };
    }
    async updateProfile(userId, dto) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new common_1.NotFoundException('Không tìm thấy người dùng');
        const dataToUpdate = {};
        if (dto.name !== undefined)
            dataToUpdate.name = dto.name;
        if (dto.phone !== undefined)
            dataToUpdate.phone = dto.phone;
        if (dto.avatar !== undefined)
            dataToUpdate.avatar = dto.avatar;
        if (dto.gender !== undefined)
            dataToUpdate.gender = dto.gender;
        if (dto.dob !== undefined) {
            dataToUpdate.dob = dto.dob ? new Date(dto.dob) : null;
        }
        const updated = await this.prisma.user.update({
            where: { id: userId },
            data: dataToUpdate,
        });
        const { password, ...result } = updated;
        return result;
    }
    async getUserProfile(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                shop: true
            }
        });
        if (!user) {
            throw new common_1.NotFoundException('Không tìm thấy người dùng');
        }
        const { password, ...result } = user;
        return { ...result, point: result.points };
    }
    async changePassword(userId, dto) {
        if (dto.currentPassword === dto.newPassword) {
            throw new common_1.BadRequestException('Mật khẩu mới không được trùng mật khẩu cũ');
        }
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.password) {
            throw new common_1.NotFoundException('Tài khoản không tồn tại hoặc chưa đặt mật khẩu');
        }
        const ok = await bcrypt.compare(dto.currentPassword, user.password);
        if (!ok) {
            throw new common_1.UnauthorizedException('Mật khẩu hiện tại không đúng');
        }
        const hashed = await bcrypt.hash(dto.newPassword, 10);
        const updated = await this.prisma.user.update({
            where: { id: userId },
            data: { password: hashed, tokenVersion: { increment: 1 } },
        });
        const tokens = this.generateTokens(updated);
        return {
            message: 'Đổi mật khẩu thành công. Các thiết bị khác đã được đăng xuất.',
            access_token: tokens.access_token,
        };
    }
    async forgotPassword(dto) {
        const normalizedEmail = dto.email.toLowerCase();
        const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (user) {
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            await this.redisService.set(this.pwdResetKey(normalizedEmail), otp, AuthService_1.PWD_RESET_TTL_SECONDS);
            console.log(`>>> [DEBUG] Reset OTP cho ${normalizedEmail}: ${otp}`);
            const feUrl = (process.env.FE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
            const resetLink = `${feUrl}/reset-password?email=${encodeURIComponent(normalizedEmail)}&token=${otp}`;
            void this.mailerService
                .sendMail({
                to: normalizedEmail,
                subject: 'Đặt lại mật khẩu GMall',
                html: `
            <p>Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu cho tài khoản này.</p>
            <p>Nhấn vào link sau để đặt lại mật khẩu (hết hạn sau 5 phút):</p>
            <p><a href="${resetLink}">${resetLink}</a></p>
            <p>Hoặc nhập mã này vào form đặt lại mật khẩu: <b>${otp}</b></p>
            <p>Nếu không phải bạn, hãy bỏ qua email này.</p>
          `,
            })
                .catch((error) => console.log('>>> [WARNING] Lỗi gửi mail reset:', error.message));
        }
        return { message: 'Nếu email tồn tại, mã đặt lại mật khẩu đã được gửi.' };
    }
    async resetPassword(dto) {
        const normalizedEmail = dto.email.toLowerCase();
        const storedOtp = await this.redisService.get(this.pwdResetKey(normalizedEmail));
        if (!storedOtp) {
            throw new common_1.UnauthorizedException('Mã đặt lại mật khẩu không tồn tại hoặc đã hết hạn');
        }
        if (storedOtp !== dto.token) {
            throw new common_1.UnauthorizedException('Mã đặt lại mật khẩu không đúng');
        }
        const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (!user) {
            await this.redisService.del(this.pwdResetKey(normalizedEmail));
            throw new common_1.NotFoundException('Tài khoản không còn tồn tại');
        }
        const hashed = await bcrypt.hash(dto.newPassword, 10);
        await this.prisma.user.update({
            where: { id: user.id },
            data: { password: hashed, tokenVersion: { increment: 1 } },
        });
        await this.redisService.del(this.pwdResetKey(normalizedEmail));
        return { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập.' };
    }
    async handleOAuthLogin(profile) {
        const normalizedEmail = profile.email.toLowerCase();
        let user = await this.prisma.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (user) {
            if (user.isBanned) {
                throw new common_1.UnauthorizedException('Tài khoản đã bị khóa.');
            }
            if (!user.isVerified) {
                user = await this.prisma.user.update({
                    where: { id: user.id },
                    data: { isVerified: true },
                });
            }
        }
        else {
            user = await this.prisma.user.create({
                data: {
                    email: normalizedEmail,
                    name: profile.name,
                    avatar: profile.avatar,
                    role: client_1.Role.BUYER,
                    isVerified: true,
                    password: null,
                },
            });
            await this.prisma.cart.create({ data: { userId: user.id } });
        }
        return this.generateTokens(user);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        jwt_1.JwtService,
        mailer_1.MailerService])
], AuthService);
//# sourceMappingURL=auth.service.js.map