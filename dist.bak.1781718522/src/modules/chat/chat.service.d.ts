import { OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { AiService } from './ai.service';
import { RedisService } from 'src/database/redis/redis.service';
export declare class ChatService implements OnModuleInit {
    private prisma;
    private aiService;
    private redis;
    constructor(prisma: PrismaService, aiService: AiService, redis: RedisService);
    onModuleInit(): Promise<void>;
    validateSocketUser(userId: string, tokenVersion?: number): Promise<{
        id: string;
        tokenVersion: number;
        isBanned: boolean;
    } | null>;
    getAiHistory(userId: string, limit?: number): Promise<({
        sender: {
            id: string;
            role: import(".prisma/client").$Enums.Role;
        };
    } & {
        id: string;
        content: string;
        type: import(".prisma/client").$Enums.MessageType;
        isRead: boolean;
        createdAt: Date;
        conversationId: string;
        senderId: string;
    })[]>;
    processUserMessage(userId: string | null, dto: CreateMessageDto): Promise<{
        userMessage: {
            id: string;
            content: string;
            senderId: string;
            createdAt: string;
        };
        aiMessage: {
            id: string;
            senderId: string;
            content: string;
            options: string[];
            searchSuggestions: {
                label: string;
                query: string;
            }[];
            type: string;
            payload: any[];
            createdAt: string;
        };
    } | {
        userMessage: {
            content: string;
            sender: {
                id: string;
                name: string | null;
                role: import(".prisma/client").$Enums.Role;
            };
            id: string;
            type: import(".prisma/client").$Enums.MessageType;
            isRead: boolean;
            createdAt: Date;
            conversationId: string;
            senderId: string;
        };
        aiMessage: any;
    }>;
    private sendMessageToDb;
    sendMessage(senderId: string, dto: CreateMessageDto): Promise<{
        content: string;
        senderId: string;
        sender: {
            id: string;
            name: string | null;
            role: import(".prisma/client").$Enums.Role;
        };
        id: string;
        type: import(".prisma/client").$Enums.MessageType;
        isRead: boolean;
        createdAt: Date;
        conversationId: string;
    }>;
    searchUsers(query: string, currentUserId: string): Promise<{
        id: string;
        name: string | null;
        avatar: string | null;
        role: import(".prisma/client").$Enums.Role;
    }[]>;
    findChatPartnerByRole(role: 'ADMIN' | 'SELLER'): Promise<{
        id: string;
        name: string | null;
        avatar: string | null;
        role: import(".prisma/client").$Enums.Role;
    } | null>;
    getUserConversations(userId: string): Promise<{
        id: string;
        partner: {
            id: string;
            name: string | null;
            avatar: string | null;
            role: import(".prisma/client").$Enums.Role;
        } | undefined;
        lastMessage: string;
        lastMessageAt: Date;
        unreadCount: number;
        isRead: boolean;
    }[]>;
    getMessages(conversationId: string, userId: string, limit?: number, cursor?: string): Promise<({
        sender: {
            id: string;
            name: string | null;
        };
    } & {
        id: string;
        content: string;
        type: import(".prisma/client").$Enums.MessageType;
        isRead: boolean;
        createdAt: Date;
        conversationId: string;
        senderId: string;
    })[]>;
    markAsRead(conversationId: string, userId: string): Promise<{
        success: boolean;
    }>;
    findOrCreateConversation(userId: string, partnerId: string): Promise<{
        id: string;
        partner: {
            id: string;
            name: string | null;
            role: import(".prisma/client").$Enums.Role;
        } | undefined;
        lastMessage: string;
        lastMessageAt: Date;
        unreadCount: number;
    }>;
}
