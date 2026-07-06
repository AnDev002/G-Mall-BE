import { PrismaService } from '../../database/prisma/prisma.service';
interface CreateComplaintInput {
    category: string;
    title: string;
    content: string;
    relatedOrderId?: string | null;
    attachments?: string[];
}
export declare class ComplaintService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(userId: string, dto: CreateComplaintInput): Promise<{
        id: string;
        userId: string;
        category: string;
        relatedOrderId: string | null;
        title: string;
        content: string;
        attachments: import(".prisma/client").Prisma.JsonValue | null;
        status: string;
        adminNote: string | null;
        resolvedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    listMine(userId: string, params?: {
        page?: number;
        limit?: number;
        status?: string;
    }): Promise<{
        data: {
            id: string;
            userId: string;
            category: string;
            relatedOrderId: string | null;
            title: string;
            content: string;
            attachments: import(".prisma/client").Prisma.JsonValue | null;
            status: string;
            adminNote: string | null;
            resolvedAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        }[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    findOneAsOwner(userId: string, id: string): Promise<{
        id: string;
        userId: string;
        category: string;
        relatedOrderId: string | null;
        title: string;
        content: string;
        attachments: import(".prisma/client").Prisma.JsonValue | null;
        status: string;
        adminNote: string | null;
        resolvedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    listAll(params?: {
        page?: number;
        limit?: number;
        status?: string;
    }): Promise<{
        data: ({
            user: {
                id: string;
                email: string | null;
                name: string | null;
            };
        } & {
            id: string;
            userId: string;
            category: string;
            relatedOrderId: string | null;
            title: string;
            content: string;
            attachments: import(".prisma/client").Prisma.JsonValue | null;
            status: string;
            adminNote: string | null;
            resolvedAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    updateStatus(id: string, status: string, adminNote?: string): Promise<{
        id: string;
        userId: string;
        category: string;
        relatedOrderId: string | null;
        title: string;
        content: string;
        attachments: import(".prisma/client").Prisma.JsonValue | null;
        status: string;
        adminNote: string | null;
        resolvedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
export {};
