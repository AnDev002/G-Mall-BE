export declare class FlashSaleItemDto {
    productId: string;
    variantId: string;
    promoPrice: number;
    promoStock: number;
    price: number;
    stock: number;
}
export declare class RegisterFlashSaleDto {
    sessionId: string;
    items: FlashSaleItemDto[];
}
