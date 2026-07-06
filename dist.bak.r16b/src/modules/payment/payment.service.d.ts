import { ConfigService } from '@nestjs/config';
export declare class PaymentService {
    private configService;
    private readonly logger;
    constructor(configService: ConfigService);
    private safeCompareHmac;
    createMomoPayment(orderId: string, amount: number, description?: string): Promise<string>;
    verifyMomoSignature(body: any): boolean;
    createPay2SPayment(orderId: string, amount: number, description?: string): Promise<any>;
    verifyPay2SSignature(query: any): boolean;
}
