import { Body, Controller, Get, HttpStatus, Logger, Post, Query, Res } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { Public } from 'src/common/decorators/public.decorator';
import type { Response } from 'express';

@Controller('payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private paymentService: PaymentService,
    private prisma: PrismaService,
  ) {}

  // Cổng IPN của Pay2S (server-to-server callback). Đổi từ GET sang POST để
  // tránh trigger qua `<img src>` từ trang phishing — IPN không bao giờ
  // visible từ browser. Public để bypass JWT (Pay2S không có session user).
  @Public()
  @Post('pay2s-ipn')
  async handlePay2SIPN(@Body() body: any, @Res() res: Response) {
    const isValid = this.paymentService.verifyPay2SSignature(body);
    if (!isValid) {
      this.logger.warn(`[Pay2S IPN] Invalid signature for body=${JSON.stringify(body)}`);
      return res.status(HttpStatus.BAD_REQUEST).send({ message: 'Invalid Signature' });
    }

    const orderId = body.orderId || body.order_id;
    if (!orderId) {
      return res.status(HttpStatus.BAD_REQUEST).send({ message: 'Missing orderId' });
    }

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(HttpStatus.OK).send({ success: true });
    // Wiki 0082: chặn UNDERPAYMENT (paid < total) + cập nhật ATOMIC idempotent (chống replay IPN).
    // Dùng "< total" (không "!= total") để giỏ nhiều shop — gateway charge tổng cả giỏ ≥ slice của
    // master order — vẫn qua. Chữ ký đã verify phía trên nên body.amount tin được.
    const paid = Math.floor(Number(body.amount ?? -1));
    const expected = Math.floor(Number(order.totalAmount));
    if (paid >= 0 && paid < expected) {
      this.logger.warn(`[Pay2S IPN] underpayment order=${orderId} paid=${paid} < expected=${expected}`);
      return res.status(HttpStatus.BAD_REQUEST).send({ message: 'Amount mismatch' });
    }
    const upd = await this.prisma.order.updateMany({
      where: { id: orderId, paymentStatus: 'PENDING' },
      data: { paymentStatus: 'PAID' },
    });
    if (upd.count === 0) this.logger.log(`[Pay2S IPN] order=${orderId} đã xử lý hoặc không ở trạng thái chờ`);
    return res.status(HttpStatus.OK).send({ success: true });
  }

  // MoMo IPN: chữ ký HMAC SHA256 verified bằng `verifyMomoSignature`. Trước
  // đây endpoint này thiếu → MoMo callback không update order status → giao
  // dịch thành công nhưng order PENDING vĩnh viễn.
  @Public()
  @Post('momo-ipn')
  async handleMomoIPN(@Body() body: any, @Res() res: Response) {
    const isValid = this.paymentService.verifyMomoSignature(body);
    if (!isValid) {
      this.logger.warn(`[MoMo IPN] Invalid signature for orderId=${body?.orderId}`);
      return res.status(HttpStatus.BAD_REQUEST).send({ message: 'Invalid Signature' });
    }

    const orderId = body.orderId;
    if (!orderId) {
      return res.status(HttpStatus.BAD_REQUEST).send({ message: 'Missing orderId' });
    }

    // resultCode 0 = success theo spec MoMo
    const isSuccess = Number(body.resultCode) === 0;
    if (isSuccess) {
      const order = await this.prisma.order.findUnique({ where: { id: orderId } });
      if (!order) return res.status(HttpStatus.OK).send({ success: true });
      // Wiki 0082: chặn underpayment + cập nhật ATOMIC idempotent (chống replay IPN).
      const paid = Math.floor(Number(body.amount ?? -1));
      const expected = Math.floor(Number(order.totalAmount));
      if (paid >= 0 && paid < expected) {
        this.logger.warn(`[MoMo IPN] underpayment order=${orderId} paid=${paid} < expected=${expected}`);
        return res.status(HttpStatus.BAD_REQUEST).send({ message: 'Amount mismatch' });
      }
      const upd = await this.prisma.order.updateMany({
        where: { id: orderId, paymentStatus: 'PENDING' },
        data: { paymentStatus: 'PAID' },
      });
      if (upd.count === 0) this.logger.log(`[MoMo IPN] order=${orderId} đã xử lý`);
    } else {
      this.logger.log(`[MoMo IPN] orderId=${orderId} resultCode=${body.resultCode} message=${body.message}`);
    }
    return res.status(HttpStatus.OK).send({ success: true });
  }
}
