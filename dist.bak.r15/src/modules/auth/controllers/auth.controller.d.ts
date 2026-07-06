import { AuthService } from '../auth.service';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { UpdateShopProfileDto } from '../dto/update-shop.dto';
import { LoginDto, RegisterDto, SendOtpDto, VerifyOtpDto } from '../dto/auth.dto';
import { RegisterSellerDto } from '../dto/register-seller.dto';
import { ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto } from '../dto/password.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
export declare class AuthController {
    private readonly authService;
    private readonly configService;
    constructor(authService: AuthService, configService: ConfigService);
    private setAuthCookie;
    register(dto: RegisterDto): Promise<{
        devOtp?: string | null | undefined;
        message: string;
    }>;
    registerSeller(body: RegisterSellerDto): Promise<{
        message: string;
    }>;
    login(dto: LoginDto, res: Response): Promise<{
        user: any;
    }>;
    loginSeller(dto: LoginDto, res: Response): Promise<{
        user: any;
    }>;
    logout(res: Response): Promise<{
        message: string;
    }>;
    loginAdmin(dto: LoginDto, res: Response): Promise<{
        user: any;
    }>;
    sendOtp(dto: SendOtpDto): Promise<{
        devOtp?: string | null | undefined;
        message: string;
    }>;
    verifyOtp(dto: VerifyOtpDto, res: Response): Promise<{
        user: any;
    }>;
    oauthStatus(): {
        google: boolean;
        facebook: boolean;
    };
    updateShopProfile(user: any, body: UpdateShopProfileDto): Promise<{
        message: string;
        shop: {
            id: string;
            name: string;
            slug: string;
            description: string | null;
            avatar: string | null;
            coverImage: string | null;
            pickupAddress: string | null;
            provinceId: number | null;
            districtId: number | null;
            wardCode: string | null;
            lat: number | null;
            lng: number | null;
            categoryId: string | null;
            status: import("@prisma/client").$Enums.ShopStatus;
            banReason: string | null;
            reviewCount: number;
            decoration: import("@prisma/client").Prisma.JsonValue | null;
            pendingDetails: import("@prisma/client").Prisma.JsonValue | null;
            rating: number;
            totalSales: number;
            ownerId: string;
            address: string | null;
            licenseImage: string | null;
            taxCode: string | null;
            businessLicenseFront: string | null;
            businessLicenseBack: string | null;
            salesLicense: string | null;
            trademarkCert: string | null;
            distributorCert: string | null;
            createdAt: Date;
            updatedAt: Date;
        };
    }>;
    getProfile(user: any): Promise<{
        point: any;
        shop: {
            id: string;
            name: string;
            slug: string;
            description: string | null;
            avatar: string | null;
            coverImage: string | null;
            pickupAddress: string | null;
            provinceId: number | null;
            districtId: number | null;
            wardCode: string | null;
            lat: number | null;
            lng: number | null;
            categoryId: string | null;
            status: import("@prisma/client").$Enums.ShopStatus;
            banReason: string | null;
            reviewCount: number;
            decoration: import("@prisma/client").Prisma.JsonValue | null;
            pendingDetails: import("@prisma/client").Prisma.JsonValue | null;
            rating: number;
            totalSales: number;
            ownerId: string;
            address: string | null;
            licenseImage: string | null;
            taxCode: string | null;
            businessLicenseFront: string | null;
            businessLicenseBack: string | null;
            salesLicense: string | null;
            trademarkCert: string | null;
            distributorCert: string | null;
            createdAt: Date;
            updatedAt: Date;
        } | null;
        id: string;
        email: string | null;
        username: string | null;
        isVerified: boolean;
        tokenVersion: number;
        referredById: string | null;
        referralRewardPaid: boolean;
        name: string | null;
        phone: string | null;
        avatar: string | null;
        gender: string | null;
        dob: Date | null;
        role: import("@prisma/client").$Enums.Role;
        isBanned: boolean;
        banReason: string | null;
        walletBalance: import("@prisma/client/runtime/library").Decimal;
        shopId: string | null;
        points: number;
        lastCheckIn: Date | null;
        checkInStreak: number;
        createdAt: Date;
        updatedAt: Date;
        shopName: string | null;
        pickupAddress: string | null;
        description: string | null;
        coverImage: string | null;
    }>;
    updateProfile(user: any, dto: UpdateProfileDto): Promise<{
        id: string;
        email: string | null;
        username: string | null;
        isVerified: boolean;
        tokenVersion: number;
        referredById: string | null;
        referralRewardPaid: boolean;
        name: string | null;
        phone: string | null;
        avatar: string | null;
        gender: string | null;
        dob: Date | null;
        role: import("@prisma/client").$Enums.Role;
        isBanned: boolean;
        banReason: string | null;
        walletBalance: import("@prisma/client/runtime/library").Decimal;
        shopId: string | null;
        points: number;
        lastCheckIn: Date | null;
        checkInStreak: number;
        createdAt: Date;
        updatedAt: Date;
        shopName: string | null;
        pickupAddress: string | null;
        description: string | null;
        coverImage: string | null;
    }>;
    changePassword(user: any, dto: ChangePasswordDto, res: Response): Promise<{
        message: string;
        access_token: string;
    }>;
    forgotPassword(dto: ForgotPasswordDto): Promise<{
        message: string;
    }>;
    resetPassword(dto: ResetPasswordDto): Promise<{
        message: string;
    }>;
    googleAuth(): Promise<void>;
    googleCallback(req: Request & {
        user: any;
    }, res: Response): Promise<void>;
    facebookAuth(): Promise<void>;
    facebookCallback(req: Request & {
        user: any;
    }, res: Response): Promise<void>;
}
