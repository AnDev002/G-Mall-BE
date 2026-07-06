import { PrismaService } from '../../database/prisma/prisma.service';
import { SubmitOrderReviewDto } from './dto/submit-review.dto';
export declare class ReviewService {
    private prisma;
    constructor(prisma: PrismaService);
    listPending(userId: string): Promise<({
        items: ({
            product: {
                id: string;
                name: string;
                slug: string;
                price: import("@prisma/client/runtime/library").Decimal;
                images: import(".prisma/client").Prisma.JsonValue;
            } | null;
        } & {
            id: string;
            orderId: string;
            productId: string | null;
            variantId: string | null;
            flashSaleProductId: string | null;
            quantity: number;
            price: import("@prisma/client/runtime/library").Decimal;
        })[];
    } & {
        id: string;
        userId: string;
        status: import(".prisma/client").$Enums.OrderStatus;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        shippingFee: import("@prisma/client/runtime/library").Decimal;
        voucherId: string | null;
        appliedVoucherIds: import(".prisma/client").Prisma.JsonValue | null;
        shippingOrderCode: string | null;
        shippingProvider: string | null;
        isReviewed: boolean;
        shopId: string | null;
        districtId: number | null;
        wardCode: string | null;
        provinceId: number | null;
        recipientName: string | null;
        recipientPhone: string | null;
        recipientAddress: string | null;
        message: string | null;
        isGift: boolean;
        paymentMethod: string;
        paymentStatus: string;
        coinUsed: number;
        paymentGroupId: string | null;
        clientIp: string | null;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    listMine(userId: string): Promise<{
        productReviews: ({
            product: {
                id: string;
                name: string;
                slug: string;
                images: import(".prisma/client").Prisma.JsonValue;
            };
        } & {
            id: string;
            content: string | null;
            rating: number;
            images: import(".prisma/client").Prisma.JsonValue | null;
            userId: string;
            productId: string;
            orderId: string;
            createdAt: Date;
            updatedAt: Date;
        })[];
        shopReviews: ({
            shop: {
                id: string;
                name: string;
                avatar: string | null;
            };
        } & {
            id: string;
            content: string | null;
            rating: number;
            userId: string;
            shopId: string;
            orderId: string;
            createdAt: Date;
            updatedAt: Date;
        })[];
    }>;
    submitReview(userId: string, dto: SubmitOrderReviewDto): Promise<{
        success: boolean;
        message: string;
        order: {
            id: string;
            userId: string;
            status: import(".prisma/client").$Enums.OrderStatus;
            totalAmount: import("@prisma/client/runtime/library").Decimal;
            shippingFee: import("@prisma/client/runtime/library").Decimal;
            voucherId: string | null;
            appliedVoucherIds: import(".prisma/client").Prisma.JsonValue | null;
            shippingOrderCode: string | null;
            shippingProvider: string | null;
            isReviewed: boolean;
            shopId: string | null;
            districtId: number | null;
            wardCode: string | null;
            provinceId: number | null;
            recipientName: string | null;
            recipientPhone: string | null;
            recipientAddress: string | null;
            message: string | null;
            isGift: boolean;
            paymentMethod: string;
            paymentStatus: string;
            coinUsed: number;
            paymentGroupId: string | null;
            clientIp: string | null;
            createdAt: Date;
            updatedAt: Date;
        };
    }>;
}
