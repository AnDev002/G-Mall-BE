import { PrismaService } from '../../database/prisma/prisma.service';
import { ChatGateway } from '../chat/chat.gateway';
import { MailerService } from '@nestjs-modules/mailer';
export declare class FriendService {
    private prisma;
    private chatGateway;
    private readonly mailerService;
    constructor(prisma: PrismaService, chatGateway: ChatGateway, mailerService: MailerService);
    sendFriendRequest(userId: string, receiverId: string): Promise<{
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
    inviteByEmail(senderId: string, email: string, message: string): Promise<{
        success: boolean;
        type: string;
        message: string;
    }>;
    handleFriendRequest(userId: string, requestId: string, action: 'ACCEPT' | 'REJECT'): Promise<{
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
    getFriendList(userId: string): Promise<{
        joinedAt: Date;
        id: string;
        email: string | null;
        name: string | null;
        avatar: string | null;
        friendshipId: string;
    }[]>;
    getPendingRequests(userId: string): Promise<({
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
    unfriend(userId: string, friendId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    searchUsers(userId: string, keyword: string): Promise<{
        status: "FRIEND" | "NONE" | "PENDING_SENT" | "PENDING_RECEIVED";
        id: string;
        email: string | null;
        name: string | null;
        avatar: string | null;
        role: import("@prisma/client").$Enums.Role;
    }[]>;
}
