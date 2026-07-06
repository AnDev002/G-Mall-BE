import { Role } from '@prisma/client';
export declare class CreateUserDto {
    name: string;
    email?: string;
    username?: string;
    password: string;
    phone?: string;
    role?: Role;
    shopName?: string;
}
export declare class ToggleBanUserDto {
    isBanned: boolean;
    reason?: string;
}
