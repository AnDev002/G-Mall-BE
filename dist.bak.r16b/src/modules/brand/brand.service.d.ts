import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
export declare class BrandService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAllAdmin(query: {
        search?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        data: {
            id: number;
            name: string;
            slug: string;
            logoUrl: string | null;
            status: string;
            description: string | null;
            productCount: number;
        }[];
        meta: {
            total: number;
            page: number;
            last_page: number;
        };
    }>;
    findAllActive(): Promise<{
        id: number;
        name: string;
        logoUrl: string | null;
    }[]>;
    findActiveByCategoryIds(categoryIds: string[], limit?: number): Promise<({
        productCount: number;
        id: number;
        name: string;
        slug: string;
        logoUrl: string | null;
    } | null)[]>;
    create(dto: CreateBrandDto): Promise<{
        id: number;
        name: string;
        slug: string;
        logoUrl: string | null;
        description: string | null;
        status: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    update(id: number, dto: UpdateBrandDto): Promise<{
        id: number;
        name: string;
        slug: string;
        logoUrl: string | null;
        description: string | null;
        status: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    delete(id: number): Promise<{
        id: number;
        name: string;
        slug: string;
        logoUrl: string | null;
        description: string | null;
        status: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    toggleStatus(id: number): Promise<{
        id: number;
        name: string;
        slug: string;
        logoUrl: string | null;
        description: string | null;
        status: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findById(id: number): Promise<{
        id: number;
        name: string;
        slug: string;
        logoUrl: string | null;
        description: string | null;
        status: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
