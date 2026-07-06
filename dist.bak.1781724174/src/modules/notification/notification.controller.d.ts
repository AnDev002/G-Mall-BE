import { NotificationService } from './notification.service';
export declare class NotificationController {
    private readonly service;
    constructor(service: NotificationService);
    list(req: any, page?: string, pageSize?: string): Promise<{
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
    unread(req: any): Promise<{
        count: number;
    }>;
    markRead(req: any, id: string): Promise<{
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
    markAll(req: any): Promise<{
        updated: number;
    }>;
}
