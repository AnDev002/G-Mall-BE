import { FriendService } from './friend.service';
import { FriendRequestDto, HandleRequestDto, InviteByEmailDto } from './dto/friend.dto';
import type { User as UserEntity } from '@prisma/client';
export declare class FriendController {
    private readonly friendService;
    constructor(friendService: FriendService);
    sendRequest(req: any, dto: FriendRequestDto): Promise<{
        message: string;
        data: {
            sender: {
                id: string;
                name: string | null;
                avatar: string | null;
            };
        } & {
            id: string;
            senderId: string;
            receiverId: string;
            status: import("@prisma/client").$Enums.FriendshipStatus;
            createdAt: Date;
            updatedAt: Date;
        };
    }>;
    handleRequest(req: any, dto: HandleRequestDto): Promise<{
        message: string;
        data?: undefined;
    } | {
        message: string;
        data: {
            receiver: {
                id: string;
                name: string | null;
                avatar: string | null;
            };
        } & {
            id: string;
            senderId: string;
            receiverId: string;
            status: import("@prisma/client").$Enums.FriendshipStatus;
            createdAt: Date;
            updatedAt: Date;
        };
    }>;
    getMyFriends(req: any): Promise<{
        joinedAt: Date;
        id: string;
        email: string | null;
        name: string | null;
        avatar: string | null;
        friendshipId: string;
    }[]>;
    getPendingRequests(req: any): Promise<({
        sender: {
            id: string;
            name: string | null;
            avatar: string | null;
        };
    } & {
        id: string;
        senderId: string;
        receiverId: string;
        status: import("@prisma/client").$Enums.FriendshipStatus;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    inviteByEmail(user: UserEntity, dto: InviteByEmailDto): Promise<{
        success: boolean;
        type: string;
        message: string;
    }>;
    searchNewFriends(req: any, q: string): Promise<{
        status: "FRIEND" | "NONE" | "PENDING_SENT" | "PENDING_RECEIVED";
        id: string;
        email: string | null;
        name: string | null;
        avatar: string | null;
        role: import("@prisma/client").$Enums.Role;
    }[]>;
    unfriend(req: any, friendId: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
