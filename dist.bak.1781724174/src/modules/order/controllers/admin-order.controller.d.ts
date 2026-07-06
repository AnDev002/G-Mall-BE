import { OrderService } from '../order.service';
export declare class AdminOrderController {
    private readonly orderService;
    constructor(orderService: OrderService);
    getAllOrders(page: number, limit: number, status: string, search: string): Promise<{
        data: ({
            user: {
                id: string;
                email: string | null;
                name: string | null;
                avatar: string | null;
            };
            items: {
                id: string;
                orderId: string;
                productId: string | null;
                variantId: string | null;
                flashSaleProductId: string | null;
                quantity: number;
                price: import("@prisma/client/runtime/library").Decimal;
            }[];
        } & {
            id: string;
            userId: string;
            status: import("@prisma/client").$Enums.OrderStatus;
            totalAmount: import("@prisma/client/runtime/library").Decimal;
            shippingFee: import("@prisma/client/runtime/library").Decimal;
            voucherId: string | null;
            appliedVoucherIds: import("@prisma/client").Prisma.JsonValue | null;
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
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    getOrderDetail(id: string): Promise<{
        user: {
            id: string;
            email: string | null;
            name: string | null;
            phone: string | null;
            avatar: string | null;
        };
        shop: {
            id: string;
            name: string;
            slug: string;
        } | null;
        voucher: {
            id: string;
            code: string;
            name: string;
            description: string | null;
            type: import("@prisma/client").$Enums.VoucherType;
            scope: import("@prisma/client").$Enums.VoucherScope;
            amount: import("@prisma/client/runtime/library").Decimal;
            maxDiscount: import("@prisma/client/runtime/library").Decimal | null;
            minOrderValue: import("@prisma/client/runtime/library").Decimal;
            usageLimit: number;
            usageCount: number;
            userUsageLimit: number;
            startDate: Date;
            endDate: Date;
            isActive: boolean;
            shopId: string | null;
            sellerId: string | null;
            createdAt: Date;
            updatedAt: Date;
            version: number;
        } | null;
        items: ({
            product: {
                id: string;
                name: string;
                slug: string;
                price: import("@prisma/client/runtime/library").Decimal;
                images: import("@prisma/client").Prisma.JsonValue;
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
        status: import("@prisma/client").$Enums.OrderStatus;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        shippingFee: import("@prisma/client/runtime/library").Decimal;
        voucherId: string | null;
        appliedVoucherIds: import("@prisma/client").Prisma.JsonValue | null;
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
    }>;
}
