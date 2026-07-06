import { ComplaintService } from './complaint.service';
declare class CreateComplaintDto {
    category: string;
    title: string;
    content: string;
    relatedOrderId?: string;
    attachments?: string[];
}
declare class UpdateStatusDto {
    status: string;
    adminNote?: string;
}
export declare class ComplaintController {
    private readonly service;
    constructor(service: ComplaintService);
    create(req: any, dto: CreateComplaintDto): Promise<{
        id: string;
        userId: string;
        category: string;
        relatedOrderId: string | null;
        title: string;
        content: string;
        attachments: import("@prisma/client").Prisma.JsonValue | null;
        status: string;
        adminNote: string | null;
        resolvedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    listMine(req: any, q: {
        page?: string;
        limit?: string;
        status?: string;
    }): Promise<{
        data: {
            id: string;
            userId: string;
            category: string;
            relatedOrderId: string | null;
            title: string;
            content: string;
            attachments: import("@prisma/client").Prisma.JsonValue | null;
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
    findOne(req: any, id: string): Promise<{
        id: string;
        userId: string;
        category: string;
        relatedOrderId: string | null;
        title: string;
        content: string;
        attachments: import("@prisma/client").Prisma.JsonValue | null;
        status: string;
        adminNote: string | null;
        resolvedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
export declare class AdminComplaintController {
    private readonly service;
    constructor(service: ComplaintService);
    list(q: {
        page?: string;
        limit?: string;
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
            attachments: import("@prisma/client").Prisma.JsonValue | null;
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
    updateStatus(id: string, dto: UpdateStatusDto): Promise<{
        id: string;
        userId: string;
        category: string;
        relatedOrderId: string | null;
        title: string;
        content: string;
        attachments: import("@prisma/client").Prisma.JsonValue | null;
        status: string;
        adminNote: string | null;
        resolvedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
export {};
