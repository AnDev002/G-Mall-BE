import { Body, Controller, Post, Get, UseGuards, Request, UseInterceptors, UploadedFile, BadRequestException, Put, UploadedFiles, Res, Req } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { Public } from 'src/common/decorators/public.decorator';
import { JwtAuthGuard } from '../guards/jwt.guard';
import { Role } from '@prisma/client';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { User } from '../../../common/decorators/user.decorator';
import { RateLimit, RateLimitGuard } from '../../../common/guards/rate-limit.guard';
import { GoogleOAuthGuard, FacebookOAuthGuard } from '../guards/oauth.guard';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { UpdateShopProfileDto } from '../dto/update-shop.dto';
import { LoginDto, RegisterDto, SendOtpDto, VerifyOtpDto } from '../dto/auth.dto';
import { RegisterSellerDto } from '../dto/register-seller.dto';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from '../dto/password.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private setAuthCookie(res: Response, token: string) {
    res.cookie('accessToken', token, {
      httpOnly: true,
      secure: true, // BẮT BUỘC true khi dùng sameSite: 'none'
      sameSite: 'none', // QUAN TRỌNG: Cho phép gửi cookie cross-site (FE -> BE)
      maxAge: 7 * 24 * 60 * 60 * 10000,
      path: '/',
    });
  }

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('register/seller')
  async registerSeller(
    @Body() body: RegisterSellerDto // Lúc này RegisterSellerDto đã có đủ field
  ) {
    // Validate file
    return this.authService.registerSeller(body);
  }

  // 2. Đăng nhập (Email + Pass)@Public()
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ points: 10, windowSeconds: 60, keyBy: 'body.email+path' })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response
  ) {
    // [FIX] Chỉ cho phép BUYER đăng nhập ở trang này.
    // Loại bỏ Role.SELLER và Role.ADMIN để chặn Seller/Admin đăng nhập vào trang mua hàng.
    const data = await this.authService.login(dto, [Role.BUYER]);
    
    this.setAuthCookie(res, data.access_token);
    return { user: data.user };
  }

  // 2. Đăng nhập dành riêng cho Seller Dashboard
  @Public()
  @Post('login/seller')
  async loginSeller(
    @Body() dto: LoginDto, 
    @Res({ passthrough: true }) res: Response
  ) {
      // [FIX] Chỉ cho phép SELLER. 
      // Admin không được phép đăng nhập vào giao diện Seller (trừ khi có tính năng "Login as Seller" riêng biệt).
      const data = await this.authService.login(dto, [Role.SELLER]);

      this.setAuthCookie(res, data.access_token);

      return { user: data.user };
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('accessToken');
    return { message: 'Đăng xuất thành công' };
  }

  // 3. Đăng nhập dành riêng cho Admin Portal
  @Public()
  @Post('login/admin')
  async loginAdmin(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const data = await this.authService.login(dto, [Role.ADMIN]);
    this.setAuthCookie(res, data.access_token);
    return { user: data.user };
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ points: 3, windowSeconds: 60, keyBy: 'body.email+path' })
  @Post('send-otp')
  async sendOtp(@Body() dto: SendOtpDto) {
    await this.authService.sendOtp(dto.email);
    return { message: 'Đã gửi lại mã OTP' };
  }

  @Public()
  @Post('verify-otp')
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER')
  @Put('seller/profile') // Route: PUT /auth/seller/profile
  async updateShopProfile(
    @User() user: any,
    @Body() body: UpdateShopProfileDto, // Chỉ nhận JSON body
  ) {
    // Không cần xử lý file ở đây nữa, gọi thẳng service
    return this.authService.updateShopProfile(user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@User() user: any) {
    // Gọi xuống service để findUnique lấy full thông tin mới nhất từ DB
    // Vì thông tin trong token (request.user) có thể bị cũ
    return this.authService.getUserProfile(user.id);
  }

  /** PUT /auth/profile — update buyer profile (name/phone/avatar/gender/dob). */
  @UseGuards(JwtAuthGuard)
  @Put('profile')
  async updateProfile(@User() user: any, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(user.id, dto);
  }

  // ===========================================================================
  // PASSWORD FLOWS (fix B1.2 / B1.3 / B2.3)
  // ===========================================================================

  /** Đổi MK khi đã login (biết MK cũ) — fix B2.3. */
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(@User() user: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto);
  }

  /** Bước 1: gửi mã reset tới email — fix B1.2 (email không gửi khi quên MK). */
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ points: 3, windowSeconds: 60, keyBy: 'body.email+path' })
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  /** Bước 2: nhập mã + MK mới — fix B1.3 (đặt lại MK không thực sự cập nhật DB). */
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ points: 10, windowSeconds: 60, keyBy: 'body.email+path' })
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // ===========================================================================
  // OAUTH endpoints (fix B1.1)
  //
  // Flow chuẩn "backend-initiated OAuth":
  //   FE <a href="{BE}/auth/google">Login</a>
  //     -> GET /auth/google   : guard redirect user tới Google.
  //     -> Google login page -> user grant -> Google redirect callback URL.
  //     -> GET /auth/google/callback : guard exchange code -> gọi
  //        GoogleStrategy.validate() -> gắn user vào req.user.
  //     -> controller tạo JWT cookie + redirect về FE.
  //
  // FE không trực tiếp POST login; chỉ link đến BE endpoint.
  // ===========================================================================

  @Public()
  @UseGuards(GoogleOAuthGuard)
  @Get('google')
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async googleAuth() {
    // Guard đã redirect user sang Google login. Hàm này không bao giờ chạy body.
  }

  @Public()
  @UseGuards(GoogleOAuthGuard)
  @Get('google/callback')
  async googleCallback(
    @Req() req: Request & { user: any },
    @Res({ passthrough: true }) res: Response,
  ) {
    // req.user do GoogleStrategy.validate() trả; có { provider, providerId, email, name, avatar }
    const data = await this.authService.handleOAuthLogin(req.user);
    this.setAuthCookie(res, data.access_token);
    const feUrl = (this.configService.get<string>('FE_URL') ?? 'http://localhost:3000').replace(/\/$/, '');
    res.redirect(`${feUrl}/`);
  }

  @Public()
  @UseGuards(FacebookOAuthGuard)
  @Get('facebook')
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async facebookAuth() {}

  @Public()
  @UseGuards(FacebookOAuthGuard)
  @Get('facebook/callback')
  async facebookCallback(
    @Req() req: Request & { user: any },
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.authService.handleOAuthLogin(req.user);
    this.setAuthCookie(res, data.access_token);
    const feUrl = (this.configService.get<string>('FE_URL') ?? 'http://localhost:3000').replace(/\/$/, '');
    res.redirect(`${feUrl}/`);
  }
}