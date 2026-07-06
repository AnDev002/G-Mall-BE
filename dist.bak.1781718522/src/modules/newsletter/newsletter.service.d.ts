import { PrismaService } from '../../database/prisma/prisma.service';
export declare class NewsletterService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    subscribe(email: string, sourceTag?: string): Promise<{
        ok: boolean;
        alreadySubscribed: boolean;
        reactivated?: undefined;
    } | {
        ok: boolean;
        reactivated: boolean;
        alreadySubscribed?: undefined;
    } | {
        ok: boolean;
        alreadySubscribed?: undefined;
        reactivated?: undefined;
    }>;
    unsubscribe(email: string): Promise<{
        ok: boolean;
    }>;
}
