// src/auth/auth.service.ts
import { Injectable, UnauthorizedException, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma/prisma.service';
import { MailerService } from '@nestjs-modules/mailer';
import * as bcrypt from 'bcrypt'; // Cần cài: pnpm add bcrypt && pnpm add -D @types/bcrypt
import { RedisService } from '../../database/redis/redis.service';
import { Role, ShopStatus } from '@prisma/client';
import { UpdateShopProfileDto } from './dto/update-shop.dto';
import { RegisterDto, LoginDto, VerifyOtpDto } from './dto/auth.dto';
import { RegisterSellerDto } from './dto/register-seller.dto';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
function generateSlug(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}

@Injectable()
export class AuthService {
  // OTP sống trong Redis với TTL. Key: `otp:<email>`, value: mã 6 số.
  // Why: Map<> cũ mất hết khi restart, và không share giữa các instance PM2 cluster —
  // user nhập OTP ở instance khác instance gửi sẽ fail ngẫu nhiên.
  private static readonly OTP_TTL_SECONDS = 5 * 60;
  private static readonly OTP_KEY_PREFIX = 'otp:';

  // OTP reset password tách prefix khỏi OTP register để không ghi đè lẫn nhau
  // (nếu user đang dở register rồi lại forgot-password, 2 key khác nhau).
  // TTL 5 phút theo spec [0018]: link reset chỉ sống ngắn để giảm rủi ro.
  private static readonly PWD_RESET_TTL_SECONDS = 5 * 60;
  private static readonly PWD_RESET_KEY_PREFIX = 'pwd_reset:';

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private jwtService: JwtService,
    private mailerService: MailerService,
  ) {}

  private otpKey(email: string) {
    return `${AuthService.OTP_KEY_PREFIX}${email.toLowerCase()}`;
  }

  private pwdResetKey(email: string) {
    return `${AuthService.PWD_RESET_KEY_PREFIX}${email.toLowerCase()}`;
  }

  // --- 1. ĐĂNG KÝ (Tạo user + Gửi OTP) ---
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new BadRequestException('Email đã tồn tại');
    }

    // Mã hóa mật khẩu
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Tạo user mới (Chưa verify)
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        role: 'BUYER',
        isVerified: false, // Bắt buộc xác thực OTP
      },
    });
    // Tạo giỏ hàng
    await this.prisma.cart.create({ data: { userId: user.id } });


    // Wiki 0068 B2: await sendOtp để lấy OTP + biết mail có cấu hình hay không.
    // (Việc gửi mail vẫn fire-and-forget BÊN TRONG sendOtp nên không block response —
    // giữ nguyên tinh thần wiki 0021.)
    const otpResult = await this.sendOtp(user.email ?? undefined);

    // Bug "tạo tài khoản không nhận được OTP": MAIL_USER/PASS trống → mail fail im
    // lặng → user kẹt không verify được. Khi mail CHƯA cấu hình + môi trường
    // non-production → trả `devOtp` để hoàn tất đăng ký (không còn cách nhận OTP
    // nào khác). Production có mail → KHÔNG trả (bảo mật). Client phải set
    // MAIL_USER/MAIL_PASS để OTP gửi qua email thật ở prod.
    const includeDevOtp = !otpResult.mailConfigured && process.env.NODE_ENV !== 'production';
    return {
      message: 'Đăng ký thành công. Vui lòng kiểm tra email để nhập OTP.',
      ...(includeDevOtp ? { devOtp: otpResult.otp } : {}),
    };
  }

  async registerSeller(
    dto: RegisterSellerDto, 
  ) {
    // Bây giờ TypeScript sẽ hiểu dto có provinceId, districtId... nhờ import đúng file
    const { 
      email, password, name, shopName, pickupAddress, phoneNumber,
      provinceId, districtId, wardCode, lat, lng,
      businessLicenseFront, 
      businessLicenseBack,
      categoryId
    } = dto;

    const existingPhone = await this.prisma.user.findFirst({ where: { phone: phoneNumber } });
    if (existingPhone) {
        throw new BadRequestException('Số điện thoại đã được sử dụng');
    }

    // 1. Kiểm tra Email
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('Email đã tồn tại');

    // 2. Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    const slug = generateSlug(shopName);
    const existingSlug = await this.prisma.shop.findUnique({ where: { slug } });
    if (existingSlug) throw new BadRequestException('Tên Shop đã tồn tại, vui lòng chọn tên khác');

    // 5. Transaction tạo User & Shop
    await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
            data: {
                email,
                password: hashedPassword,
                name: name,
                role: Role.BUYER,
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
                
                status: ShopStatus.PENDING,
            }
        });
    });

    // Fix B-NEW-PERF-1 (wiki 0021): fire-and-forget — không block response.
    if(email) {
        void this.sendOtp(email);
    }

    return { message: 'Đăng ký người bán thành công. Vui lòng xác thực OTP.' };
  }

  

  // --- 2. ĐĂNG NHẬP (Check Password + Check Verified) ---
  async login(dto: LoginDto, allowedRoles?: string[]) {
    const user = await this.prisma.user.findFirst({ where: {OR: [{ email: dto.email }, { username: dto.email }]} });
    if (!user) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    if (user.isBanned) {
      throw new UnauthorizedException(`Tài khoản đã bị khóa. Lý do: ${user.banReason}`);
    }
    // 1. Check Password
    if (!user.password) {
        throw new UnauthorizedException('Tài khoản chưa thiết lập mật khẩu.');
    }
    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');

    // 2. Check Verification
    if (!user.isVerified) {
      await this.sendOtp(user.email ?? undefined);
      throw new UnauthorizedException('Tài khoản chưa xác thực. Vui lòng kiểm tra OTP.');
    }

    // 3. CRITICAL: Check Role Permission
    // Hệ thống lớn cần check ngay lúc login để chặn Token được tạo ra cho sai portal
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        throw new UnauthorizedException('Bạn không có quyền truy cập vào khu vực này.');
    }

    // 4. Tạo Token
    return this.generateTokens(user);
  }

  // --- 3. XÁC THỰC OTP (Kích hoạt tài khoản) ---
  async verifyOtp(dto: VerifyOtpDto) {
    const normalizedEmail = dto.email.toLowerCase();
    const storedOtp = await this.redisService.get(this.otpKey(normalizedEmail));

    // TTL của Redis đã xử lý hết hạn — nếu get() trả null thì là "không tồn tại hoặc đã hết hạn"
    if (!storedOtp) {
      throw new UnauthorizedException('Mã OTP không tồn tại hoặc đã hết hạn.');
    }

    if (storedOtp !== dto.otp) {
      // [FIX review-H6 - wiki 0088] Đếm sai bằng INCR ATOMIC (tránh TOCTOU get+set). KHÔNG xoá OTP
      // của user khi đạt ngưỡng — trước đây xoá → attacker (endpoint @Public) vô hiệu OTP của NẠN
      // NHÂN = griefing/DoS. Thay vào đó KHOÁ thử trong cửa sổ TTL; brute-force còn bị chặn thêm bởi
      // RateLimitGuard (email+path) ở controller. OTP vẫn còn để user thật dùng / khi xin lại.
      const failKey = `otp_fail:${normalizedEmail}`;
      const fails = await this.redisService.getClient().incr(failKey);
      if (fails === 1) await this.redisService.getClient().expire(failKey, 300);
      if (fails > 5) {
        throw new UnauthorizedException('Nhập sai OTP quá nhiều lần. Vui lòng thử lại sau ít phút hoặc yêu cầu mã mới.');
      }
      throw new UnauthorizedException('Mã OTP không đúng');
    }

    // Xóa OTP sau khi dùng (prevent replay) + reset bộ đếm sai
    await this.redisService.del(this.otpKey(normalizedEmail));
    await this.redisService.del(`otp_fail:${normalizedEmail}`);

    // Cập nhật User thành đã verify
    const user = await this.prisma.user.update({
      where: { email: normalizedEmail },
      data: { isVerified: true },
    });

    // Trả về Token để user đăng nhập luôn sau khi nhập OTP thành công
    return this.generateTokens(user);
  }

  // Wiki 0068 B2: mail chỉ "đã cấu hình" khi có cả MAIL_USER lẫn MAIL_PASS.
  private isMailConfigured(): boolean {
    return !!(process.env.MAIL_USER && process.env.MAIL_PASS);
  }

  // --- HELPER: Gửi OTP (Dùng chung cho Register & Forgot Password) ---
  // Trả { otp, mailConfigured } để caller quyết định có lộ devOtp (non-prod) không.
  async sendOtp(email?: string): Promise<{ otp: string | null; mailConfigured: boolean }> {
    const mailConfigured = this.isMailConfigured();
    if (!email) return { otp: null, mailConfigured };

    const normalizedEmail = email.toLowerCase();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await this.redisService.set(
      this.otpKey(normalizedEmail),
      otp,
      AuthService.OTP_TTL_SECONDS,
    );

    console.log(`>>> [DEBUG] OTP cho ${normalizedEmail}: ${otp}`);

    if (mailConfigured) {
      // Fix B-NEW-PERF-1 (wiki 0021): fire-and-forget để không block response.
      void this.mailerService
        .sendMail({
          to: normalizedEmail,
          subject: 'Mã xác thực GMall',
          html: `<b>Mã OTP của bạn là: ${otp}</b>. Có hiệu lực trong 5 phút.`,
        })
        .catch((error) => console.log('>>> [WARNING] Lỗi gửi mail:', error.message));
    } else {
      // Wiki 0068 B2: không cấu hình mail → KHÔNG gửi (tránh fail im lặng gây
      // hiểu nhầm "đã gửi"). Caller sẽ trả devOtp ở non-prod để vẫn verify được.
      console.log(
        `>>> [WARNING] MAIL_USER/MAIL_PASS chưa cấu hình — OTP cho ${normalizedEmail} KHÔNG gửi qua email. ` +
        `Set MAIL_USER/MAIL_PASS (.env) để bật gửi email ở production.`,
      );
    }

    return { otp, mailConfigured };
  }

  // --- HELPER: Tạo Token ---
  // Spec [0018]: kèm tokenVersion vào payload. JwtStrategy.validate so với
  // user.tokenVersion hiện tại; mismatch -> reject (force re-login). Sau khi
  // đổi password, BE bump tokenVersion -> mọi token cũ invalid.
  private generateTokens(user: any) {
    const payload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        tokenVersion: user.tokenVersion ?? 0,
    };

    const { password, ...userInfo } = user;

    return {
      access_token: this.jwtService.sign(payload),
      user: userInfo 
    };
  }

  async updateShopProfile(userId: string, data: UpdateShopProfileDto) {
    // 1. Tìm Shop của User này
    const shop = await this.prisma.shop.findUnique({
      where: { ownerId: userId }
    });

    if (!shop) {
      throw new NotFoundException('Cửa hàng không tồn tại.');
    }

    // 2. Check trùng tên Shop (nếu có đổi tên và tên khác tên cũ)
    if (data.shopName && data.shopName !== shop.name) {
      // Logic generate slug mới nếu đổi tên (Optional)
      const existingSlug = await this.prisma.shop.findFirst({
        where: { 
            name: data.shopName,
            id: { not: shop.id } // Loại trừ chính nó
        }
      });
      if (existingSlug) {
        throw new ConflictException('Tên Shop đã tồn tại, vui lòng chọn tên khác.');
      }
    }

    // 3. Update Database (Map các trường từ DTO vào Prisma Model)
    // Lưu ý: data.avatar, data.cover... bây giờ là URL string do FE gửi
    const updatedShop = await this.prisma.shop.update({
      where: { id: shop.id },
      data: {
        name: data.shopName, // Map shopName -> name
        pickupAddress: data.pickupAddress,
        description: data.description,
        
        // Cập nhật URL ảnh
        avatar: data.avatar,         
        coverImage: data.cover, // Map cover -> coverImage (theo schema Prisma của bạn)

        // Cập nhật Giấy tờ pháp lý
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

  /**
   * Update các field buyer profile. Email + password KHÔNG đổi ở đây —
   * dùng change-password / forgot-password flow riêng cho bảo mật.
   *
   * Fix B2.1 (update không có thông báo) và B2.4 (avatar regression):
   * Trước đây FE gọi PUT /users/profile nhưng BE không có endpoint tương
   * ứng -> 404 -> FE toast.error mơ hồ. Giờ endpoint tồn tại thật, thao
   * tác success/failure rõ ràng.
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    const dataToUpdate: any = {};
    if (dto.name !== undefined) dataToUpdate.name = dto.name;
    if (dto.phone !== undefined) dataToUpdate.phone = dto.phone;
    if (dto.avatar !== undefined) dataToUpdate.avatar = dto.avatar;
    if (dto.gender !== undefined) dataToUpdate.gender = dto.gender;
    if (dto.dob !== undefined) {
      // FE gửi ISO date string hoặc '' nếu muốn clear. Convert an toàn.
      dataToUpdate.dob = dto.dob ? new Date(dto.dob) : null;
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
    });

    const { password, ...result } = updated;
    return result;
  }

  async getUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
            shop: true // Lấy kèm thông tin Shop (chứa giấy tờ, avatar shop...)
        }
    });

    // [FIX] Kiểm tra null trước khi dùng
    if (!user) {
        throw new NotFoundException('Không tìm thấy người dùng'); 
    }

    // Sau khi check null, TypeScript sẽ hiểu user là object hợp lệ
    const { password, ...result } = user;
    return result;
  }

  // ===========================================================================
  // PASSWORD FLOWS — đổi / quên / đặt lại mật khẩu
  // ===========================================================================

  /**
   * Đổi mật khẩu khi đã đăng nhập (biết MK cũ).
   * Fix bug B2.3: trước đây không có endpoint này -> FE gọi đâu cũng không
   * update được hash trong DB, nên MK cũ vẫn login được.
   *
   * Lưu ý: JWT đang cấp trước thời điểm đổi MK vẫn hợp lệ cho đến khi hết
   * hạn. Muốn invalidate ngay (ví dụ kick user khỏi mọi thiết bị khác) cần
   * thêm `tokenVersion` vào User schema — xem wiki 0005.
   */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Mật khẩu mới không được trùng mật khẩu cũ');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.password) {
      throw new NotFoundException('Tài khoản không tồn tại hoặc chưa đặt mật khẩu');
    }

    const ok = await bcrypt.compare(dto.currentPassword, user.password);
    if (!ok) {
      throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    }

    const hashed = await bcrypt.hash(dto.newPassword, 10);
    // Spec [0018]: bump tokenVersion -> mọi JWT cũ invalid -> các thiết bị
    // khác tự logout. Trả về token mới để session hiện tại vẫn hoạt động.
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

  /**
   * Bước 1 của flow quên MK: nhận email, nếu tồn tại thì sinh OTP reset
   * (tách key với OTP register) và gửi mail. Luôn trả success message
   * giống nhau dù email có tồn tại hay không — tránh user enumeration
   * (attacker dò email nào đã đăng ký qua response khác nhau).
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const normalizedEmail = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (user) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      await this.redisService.set(
        this.pwdResetKey(normalizedEmail),
        otp,
        AuthService.PWD_RESET_TTL_SECONDS,
      );

      console.log(`>>> [DEBUG] Reset OTP cho ${normalizedEmail}: ${otp}`);

      // Link chứa cả email + OTP để FE auto-fill form — user chỉ cần click và nhập pass mới.
      // FE_URL đọc từ env; fallback localhost cho dev.
      const feUrl = (process.env.FE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
      const resetLink = `${feUrl}/reset-password?email=${encodeURIComponent(normalizedEmail)}&token=${otp}`;

      // Fix B-NEW-PERF-1 (wiki 0021): fire-and-forget sendMail.
      // Nếu mail rớt user vẫn dùng được "Gửi lại mã" sau.
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

  /**
   * Bước 2 của flow quên MK: verify OTP reset + đổi mật khẩu.
   * Xóa key sau khi dùng (prevent replay).
   */
  async resetPassword(dto: ResetPasswordDto) {
    const normalizedEmail = dto.email.toLowerCase();
    const storedOtp = await this.redisService.get(this.pwdResetKey(normalizedEmail));

    if (!storedOtp) {
      throw new UnauthorizedException('Mã đặt lại mật khẩu không tồn tại hoặc đã hết hạn');
    }
    if (storedOtp !== dto.token) {
      throw new UnauthorizedException('Mã đặt lại mật khẩu không đúng');
    }

    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      // Ít khi xảy ra (phải có user mới sinh được OTP), nhưng vẫn phòng DB đã xóa user.
      await this.redisService.del(this.pwdResetKey(normalizedEmail));
      throw new NotFoundException('Tài khoản không còn tồn tại');
    }

    const hashed = await bcrypt.hash(dto.newPassword, 10);
    // Spec [0018]: reset password cũng bump tokenVersion để invalidate JWT cũ
    // (lỡ ai đó còn token sau khi user mất quyền truy cập).
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, tokenVersion: { increment: 1 } },
    });

    await this.redisService.del(this.pwdResetKey(normalizedEmail));

    return { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập.' };
  }

  // ===========================================================================
  // OAUTH (Google / Facebook) — fix B1.1
  // ===========================================================================

  /**
   * Xử lý profile OAuth từ Google/Facebook.
   *
   * Policy:
   * - Nếu user với email đó đã tồn tại (đăng ký bằng email/password hoặc OAuth
   *   provider khác) -> link account: cho login luôn. KHÔNG tạo account trùng.
   *   (Đánh đổi: đồng nghĩa attacker claim email Google của nạn nhân có thể
   *   chiếm account nếu email verification yếu; GMall không verify email khi
   *   register thường, nên đây là thực tế. Mitigation thực sự cần email
   *   verification mạnh hơn ở flow register, out-of-scope.)
   * - Nếu chưa có user -> tạo mới, auto-verify (email đã được provider xác
   *   thực), role BUYER, không set password (login chỉ qua OAuth hoặc phải
   *   forgot-password để set pass).
   */
  async handleOAuthLogin(profile: {
    provider: 'google' | 'facebook';
    providerId: string;
    email: string;
    name: string;
    avatar?: string;
  }) {
    const normalizedEmail = profile.email.toLowerCase();
    let user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user) {
      if (user.isBanned) {
        throw new UnauthorizedException(
          `Tài khoản đã bị khóa. Lý do: ${user.banReason}`,
        );
      }
      // User đã verify vì provider đã xác minh email; nếu trước đó chưa
      // verify (đăng ký email/pass rồi chưa nhập OTP) thì promote lên verified.
      if (!user.isVerified) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { isVerified: true },
        });
      }
    } else {
      user = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          name: profile.name,
          avatar: profile.avatar,
          role: Role.BUYER,
          isVerified: true, // OAuth provider đã verify email
          password: null,
        },
      });
      await this.prisma.cart.create({ data: { userId: user.id } });
    }

    return this.generateTokens(user);
  }
}