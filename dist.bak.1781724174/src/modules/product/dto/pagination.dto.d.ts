export declare class PaginationDto {
    page?: number;
    limit?: number;
}
export declare class FindAllPublicDto extends PaginationDto {
    search?: string;
    categorySlug?: string;
    sort?: string;
    minPrice?: number;
    maxPrice?: number;
    rating?: number;
    tag?: string;
}
