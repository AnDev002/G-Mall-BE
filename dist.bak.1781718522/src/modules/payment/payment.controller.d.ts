import { PaymentService } from './payment.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import type { Response } from 'express';
export declare class PaymentController {
    private paymentService;
    private prisma;
    private readonly logger;
    constructor(paymentService: PaymentService, prisma: PrismaService);
    private hasExplicitPaymentFailure;
    handlePay2SIPN(body: any, res: Response): Promise<Response<any, Record<string, any>>>;
    handleMomoIPN(body: any, res: Response): Promise<Response<any, Record<string, any>>>;
}
