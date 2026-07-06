export declare class CartItemDto {
    productId: string;
    quantity: number;
    variantId?: string;
}
export declare class CreateOrderDto {
    isBuyNow: boolean;
    items?: CartItemDto[];
    voucherIds?: string[];
    useCoins?: boolean;
    isGift?: boolean;
    paymentMethod: string;
    receiverInfo?: any;
    senderInfo?: any;
    giftWrapIndex?: number;
    cardIndex?: number;
    note?: string | Record<string, string>;
    shippingFee?: number;
}
