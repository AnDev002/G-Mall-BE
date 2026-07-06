import { AdminUsersService } from '../admin-users.service';
import { CreateUserDto, ToggleBanUserDto } from '../dto/admin-users.dto';
export declare class AdminUsersController {
    private readonly adminUsersService;
    constructor(adminUsersService: AdminUsersService);
    getSellers(page: number, limit: number, search: string): Promise<{
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
            walletBalance: import("@prisma/client/runtime/library").Decimal;
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
    getSellerDetail(id: string): Promise<{
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
            walletBalance: import("@prisma/client/runtime/library").Decimal;
            createdAt: Date;
        };
        productCount: number;
        recentProducts: {
            id: string;
            name: string;
            createdAt: Date;
            slug: string;
            status: import("@prisma/client").$Enums.ProductStatus;
            price: import("@prisma/client/runtime/library").Decimal;
            images: import("@prisma/client").Prisma.JsonValue;
        }[];
        totalRevenue: number;
        totalOrders: number;
        isBanned: boolean;
    }>;
    toggleBan(req: any, id: string, body: {
        isBanned: boolean;
        reason?: string;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
    getUsers(page: number, limit: number, search: string, role: string, minPoints: string, maxPoints: string, industryId: string): Promise<{
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
    toggleBanUser(adminId: string, userId: string, dto: ToggleBanUserDto): Promise<{
        success: boolean;
        message: string;
        user: {
            id: string;
            isBanned: boolean;
        };
    }>;
    getPendingShops(page: number, limit: number): Promise<{
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
        })[];
        meta: {
            total: number;
            page: number;
            lastPage: number;
        };
    }>;
    approveShop(req: any, shopId: string): Promise<{
        message: string;
    }>;
    rejectShop(req: any, shopId: string, body: {
        reason: string;
    }): Promise<{
        message: string;
    }>;
    getShopUpdateRequests(page?: number, limit?: number): Promise<{
        data: {
            id: string;
            name: string;
            avatar: string | null;
            updatedAt: Date;
            pendingDetails: import("@prisma/client").Prisma.JsonValue;
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
    approveShopUpdate(req: any, shopId: string): Promise<{
        message: string;
    }>;
    deleteUser(adminId: string, userId: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
