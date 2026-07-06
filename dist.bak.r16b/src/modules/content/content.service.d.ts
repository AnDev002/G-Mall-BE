import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateBannerDto, SaveConfigDto } from './dto/content.dto';
export declare class ContentService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    getBanners(location?: string): Promise<{
        id: string;
        location: string;
        src: string;
        alt: string | null;
        title: string | null;
        description: string | null;
        ctaLabel: string | null;
        ctaLink: string | null;
        theme: string | null;
        order: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    getConfig(key: string): Promise<any>;
    getAllBannersAdmin(): Promise<{
        id: string;
        location: string;
        src: string;
        alt: string | null;
        title: string | null;
        description: string | null;
        ctaLabel: string | null;
        ctaLink: string | null;
        theme: string | null;
        order: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    createBanner(data: CreateBannerDto): Promise<{
        id: string;
        location: string;
        src: string;
        alt: string | null;
        title: string | null;
        description: string | null;
        ctaLabel: string | null;
        ctaLink: string | null;
        theme: string | null;
        order: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    updateBanner(id: string, data: Partial<CreateBannerDto>): Promise<{
        id: string;
        location: string;
        src: string;
        alt: string | null;
        title: string | null;
        description: string | null;
        ctaLabel: string | null;
        ctaLink: string | null;
        theme: string | null;
        order: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    deleteBanner(id: string): Promise<{
        id: string;
        location: string;
        src: string;
        alt: string | null;
        title: string | null;
        description: string | null;
        ctaLabel: string | null;
        ctaLink: string | null;
        theme: string | null;
        order: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    reorderBanners(payload: {
        id: string;
        order: number;
    }[] | {
        items: {
            id: string;
            order: number;
        }[];
    }): Promise<{
        id: string;
        location: string;
        src: string;
        alt: string | null;
        title: string | null;
        description: string | null;
        ctaLabel: string | null;
        ctaLink: string | null;
        theme: string | null;
        order: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    saveConfig(dto: SaveConfigDto): Promise<{
        key: string;
        value: import(".prisma/client").Prisma.JsonValue;
        description: string | null;
        updatedAt: Date;
    }>;
}
