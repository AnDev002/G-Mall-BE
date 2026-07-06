import { PrismaService } from '../../database/prisma/prisma.service';
import { TrackingService } from '../tracking/tracking.service';
import { MailerService } from '@nestjs-modules/mailer';
import { Prisma } from '@prisma/client';
import { CreateUserDto } from './dto/admin-users.dto';
export declare class AdminUsersService {
    private prisma;
    private trackingService;
    private mailerService;
    constructor(prisma: PrismaService, trackingService: TrackingService, mailerService: MailerService);
    getSellers(params: {
        page?: number;
        limit?: number;
        search?: string;
    }): Promise<{
        data: {
            id: string;
            shopName: string;
            avatar: string | null;
            createdAt: Date;
            status: import("@prisma/client").$Enums.ShopStatus;
            isBanned: boolean;
            ownerId: string;
            name: string | null;
            email: string | null;
            phone: string | null;
            walletBalance: Prisma.Decimal;
            totalRevenue: number;
            totalOrders: number;
            totalProducts: number;
            rating: number;
        }[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    getSellerDetail(shopId: string): Promise<{
        id: string;
        name: string;
        slug: string;
        status: import("@prisma/client").$Enums.ShopStatus;
        avatar: string | null;
        coverImage: string | null;
        description: string | null;
        pickupAddress: string | null;
        rating: number;
        createdAt: Date;
        owner: {
            id: string;
            email: string | null;
            isVerified: boolean;
            name: string | null;
            phone: string | null;
            avatar: string | null;
            isBanned: boolean;
            walletBalance: Prisma.Decimal;
            createdAt: Date;
        };
        productCount: number;
        recentProducts: {
            id: string;
            name: string;
            createdAt: Date;
            slug: string;
            status: import("@prisma/client").$Enums.ProductStatus;
            price: Prisma.Decimal;
            images: Prisma.JsonValue;
        }[];
        totalRevenue: number;
        totalOrders: number;
        isBanned: boolean;
    }>;
    toggleBanShop(adminId: string, shopId: string, isBanned: boolean, reason?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getPendingShops(page?: number, limit?: number): Promise<{
        data: ({
            owner: {
                email: string | null;
                name: string | null;
                phone: string | null;
            };
        } & {
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
            decoration: Prisma.JsonValue | null;
            pendingDetails: Prisma.JsonValue | null;
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
        })[];
        meta: {
            total: number;
            page: number;
            lastPage: number;
        };
    }>;
    approveShopUpdate(adminId: string, shopId: string): Promise<{
        message: string;
    }>;
    approveShop(adminId: string, shopId: string): Promise<{
        message: string;
    }>;
    getShopUpdateRequests(page?: number, limit?: number): Promise<{
        data: {
            id: string;
            name: string;
            avatar: string | null;
            updatedAt: Date;
            pendingDetails: Prisma.JsonValue;
            owner: {
                email: string | null;
                name: string | null;
                phone: string | null;
            };
        }[];
        total: number;
        page: number;
        lastPage: number;
    }>;
    rejectShop(adminId: string, shopId: string, reason?: string): Promise<{
        message: string;
    }>;
    getAllUsers(params: {
        page?: number;
        limit?: number;
        search?: string;
        role?: string;
        minPoints?: number;
        maxPoints?: number;
        industryId?: string;
    }): Promise<{
        data: {
            pointBalance: number;
            dominantIndustry: string | null;
            shop: {
                category: {
                    name: string;
                } | null;
                id: string;
                name: string;
                categoryId: string | null;
                status: import("@prisma/client").$Enums.ShopStatus;
            } | null;
            pointWallet: {
                balance: number;
            } | null;
            id: string;
            email: string | null;
            username: string | null;
            isVerified: boolean;
            name: string | null;
            phone: string | null;
            avatar: string | null;
            role: import("@prisma/client").$Enums.Role;
            isBanned: boolean;
            banReason: string | null;
            createdAt: Date;
        }[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    createUser(adminId: string, dto: CreateUserDto): Promise<{
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
        walletBalance: Prisma.Decimal;
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
    toggleBanUser(adminId: string, userId: string, isBanned: boolean, reason?: string): Promise<{
        success: boolean;
        message: string;
        user: {
            id: string;
            isBanned: boolean;
        };
    }>;
    deleteUser(adminId: string, userId: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
