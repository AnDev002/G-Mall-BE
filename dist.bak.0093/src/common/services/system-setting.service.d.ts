import { PrismaService } from '../../database/prisma/prisma.service';
export declare class SystemSettingService {
    private prisma;
    private readonly logger;
    private cache;
    private static readonly CACHE_TTL_MS;
    constructor(prisma: PrismaService);
    get(key: string, defaultValue?: string): Promise<string | undefined>;
    getNumber(key: string, defaultValue: number): Promise<number>;
    set(key: string, value: string, description?: string): Promise<void>;
    seedDefaults(): Promise<void>;
}
