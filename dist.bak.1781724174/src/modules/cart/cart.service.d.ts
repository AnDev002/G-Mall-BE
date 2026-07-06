import { Redis } from 'ioredis';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
export declare class CartService {
    private readonly redis;
    private prisma;
    private readonly logger;
    constructor(redis: Redis, prisma: PrismaService);
    private getCartKey;
    acquireStock(productId: string, quantity: number): Promise<boolean>;
    releaseStock(productId: string, quantity: number): Promise<void>;
    addToCart(userId: string, dto: AddToCartDto): Promise<{
        message: string;
    }>;
    getCart(userId: string): Promise<{
        items: {
            id: string;
            productId: string;
            title: string;
            imageUrl: any;
            price: number;
            quantity: number;
            stock: number;
            totalPrice: number;
            shopId: string;
            shopName: string;
        }[];
        total: number;
    }>;
    removeItem(userId: string, productId: string): Promise<{
        success: boolean;
    }>;
    updateQuantity(userId: string, productId: string, quantity: number): Promise<{
        success: boolean;
    }>;
    syncToDatabase(userId: string): Promise<void>;
    clearCart(userId: string): Promise<{
        success: boolean;
    }>;
}
