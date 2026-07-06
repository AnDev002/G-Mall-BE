import { PrismaService } from '../../database/prisma/prisma.service';
import { Prisma } from '@prisma/client';
export declare class NotificationService {
    private prisma;
    constructor(prisma: PrismaService);
    create(data: {
        userId: string;
        type?: 'ORDER' | 'PROMOTION' | 'SYSTEM' | 'CHAT' | 'FRIEND';
        title: string;
        content: string;
        link?: string;
        image?: string;
    }, tx?: Prisma.TransactionClient): Promise<{
        id: string;
        userId: string;
        type: string;
        title: string;
        content: string;
        link: string | null;
        image: string | null;
        isRead: boolean;
        readAt: Date | null;
        createdAt: Date;
    }>;
    listMine(userId: string, page?: number, pageSize?: number): Promise<{
        items: {
            id: string;
            userId: string;
            type: string;
            title: string;
            content: string;
            link: string | null;
            image: string | null;
            isRead: boolean;
            readAt: Date | null;
            createdAt: Date;
        }[];
        meta: {
            page: number;
            pageSize: number;
            total: number;
            unread: number;
        };
    }>;
    unreadCount(userId: string): Promise<{
        count: number;
    }>;
    markRead(userId: string, id: string): Promise<{
        id: string;
        userId: string;
        type: string;
        title: string;
        content: string;
        link: string | null;
        image: string | null;
        isRead: boolean;
        readAt: Date | null;
        createdAt: Date;
    }>;
    markAllRead(userId: string): Promise<{
        updated: number;
    }>;
}
