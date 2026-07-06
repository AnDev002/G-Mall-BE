import { ChatService } from '../chat.service';
import { OpenChatDto } from '../dto/chat.dto';
import { CreateMessageDto } from '../dto/create-message.dto';
export declare class ChatController {
    private readonly chatService;
    constructor(chatService: ChatService);
    sendMessage(req: any, dto: CreateMessageDto): Promise<{
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
    getConversations(req: any): Promise<{
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
    getMessages(req: any, conversationId: string, limit: number, cursor: string): Promise<({
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
    markAsRead(req: any, conversationId: string): Promise<{
        success: boolean;
    }>;
    openChat(req: any, dto: OpenChatDto): Promise<{
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
    searchUsers(q: string, req: any): Promise<{
        id: string;
        name: string | null;
        avatar: string | null;
        role: import(".prisma/client").$Enums.Role;
    }[]>;
    findPartner(role: string): Promise<{
        id: string;
        name: string | null;
        avatar: string | null;
        role: import(".prisma/client").$Enums.Role;
    } | null>;
}
