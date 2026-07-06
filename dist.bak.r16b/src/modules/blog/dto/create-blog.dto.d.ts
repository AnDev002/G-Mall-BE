export declare class CreateBlogDto {
    title: string;
    content: string;
    thumbnail?: string;
    slug?: string;
    categoryId?: string;
    status?: string;
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
    noIndex?: boolean;
    relatedProductIds?: string[];
}
