export interface Pagination {
    page: number;
    limit: number;
    skip: number;
}
export declare function getPagination(page?: number | string | null, limit?: number | string | null, opts?: {
    defaultLimit?: number;
    maxLimit?: number;
}): Pagination;
