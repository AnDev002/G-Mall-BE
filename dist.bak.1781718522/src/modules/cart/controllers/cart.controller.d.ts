import { CartService } from '../cart.service';
import { AddToCartDto } from '../dto/add-to-cart.dto';
import { UpdateCartDto } from '../dto/update-cart.dto';
export declare class CartController {
    private readonly cartService;
    constructor(cartService: CartService);
    getCart(req: any): Promise<{
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
    addToCart(req: any, dto: AddToCartDto): Promise<{
        message: string;
    }>;
    updateQuantity(req: any, productId: string, dto: UpdateCartDto): Promise<{
        success: boolean;
    }>;
    removeItem(req: any, productId: string): Promise<{
        success: boolean;
    }>;
}
