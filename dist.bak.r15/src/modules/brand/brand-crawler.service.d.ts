export declare class BrandCrawlerService {
    private readonly logger;
    private readonly UA;
    crawlByUrl(url: string): Promise<{
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
    private crawlTiki;
    private crawlShopee;
}
