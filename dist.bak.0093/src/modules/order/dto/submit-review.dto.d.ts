export declare class ProductReviewItemDto {
    productId: string;
    rating: number;
    comment?: string;
}
export declare class SubmitOrderReviewDto {
    orderId: string;
    shopRating: number;
    shopComment?: string;
    productReviews: ProductReviewItemDto[];
}
