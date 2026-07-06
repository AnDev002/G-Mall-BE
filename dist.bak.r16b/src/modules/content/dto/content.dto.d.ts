export declare class CreateBannerDto {
    location: string;
    src: string;
    alt?: string;
    title?: string;
    description?: string;
    ctaLabel?: string;
    ctaLink?: string;
    theme?: string;
    order?: number;
    isActive?: boolean;
}
export declare class UpdateBannerDto extends CreateBannerDto {
}
declare class ReorderItem {
    id: string;
    order: number;
}
export declare class ReorderBannersDto {
    items: ReorderItem[];
}
export declare class SaveConfigDto {
    key: string;
    value: any;
}
export {};
