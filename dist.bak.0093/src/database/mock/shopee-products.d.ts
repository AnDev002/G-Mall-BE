export declare const SHOPEE_HOT_PRODUCTS: ({
    name: string;
    price: number;
    images: {
        url: string;
    }[];
    description: string;
    rating: string;
    salesCount: string;
    location: string;
    stock: number;
    variant: string;
    discountPercent: string | null;
} | {
    name: string;
    price: number;
    images: {
        url: string;
    }[];
    description: string;
    rating: number;
    salesCount: string;
    location: string;
    stock: number;
    variant: string;
    discountPercent: string;
} | {
    name: string;
    price: number;
    images: {
        url: string;
    }[];
    description: string;
    rating: number;
    salesCount: string;
    location: string;
    stock: number;
    variant: string;
    discountPercent?: undefined;
} | {
    name: string;
    price: number;
    images: {
        url: string;
    }[];
    rating: number;
    salesCount: string;
    location: string;
    stock: number;
    variant: string;
    description?: undefined;
    discountPercent?: undefined;
} | {
    name: string;
    price: number;
    images: {
        url: string;
    }[];
    rating: number;
    salesCount: string;
    location: string;
    stock: number;
    variant: string;
    discountPercent: string;
    description?: undefined;
})[];
