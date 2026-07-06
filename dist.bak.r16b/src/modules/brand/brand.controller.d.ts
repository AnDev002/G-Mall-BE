import { BrandService } from './brand.service';
import { BrandCrawlerService } from './brand-crawler.service';
import { CategoryService } from '../category/category.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
export declare class BrandController {
    private readonly brandService;
    private readonly brandCrawler;
    private readonly categoryService;
    constructor(brandService: BrandService, brandCrawler: BrandCrawlerService, categoryService: CategoryService);
    crawlBrand(dto: {
        url: string;
    }): Promise<{
        source: string;
        name: any;
        image: any;
        brand: any;
        brandImage: any;
        category: any;
        description: any;
        raw: {
            id: any;
            slug: any;
        };
    } | {
        source: string;
        name: any;
        image: any;
        brand: string;
        brandImage: string;
        category: any;
        description: any;
        raw: {
            itemId: string;
            shopId: string;
        };
    }>;
    getActiveBrands(categoryId?: string, limit?: string): Promise<({
        productCount: number;
        id: number;
        name: string;
        slug: string;
        logoUrl: string | null;
    } | null)[] | {
        id: number;
        name: string;
        logoUrl: string | null;
    }[]>;
    getBrandsAdmin(search: string, page: string, limit: string): Promise<{
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
    getBrandById(id: number): Promise<{
        id: number;
        name: string;
        slug: string;
        logoUrl: string | null;
        description: string | null;
        status: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
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
}
