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
    // Wiki 0083: nhóm thanh toán (multi-shop) — mark TẤT CẢ đơn cùng paymentGroupId + so khớp
    // TỔNG tiền cả nhóm (gateway charge tổng cả giỏ). Chặn underpayment + idempotent (chống replay).
    // Chữ ký đã verify ở trên nên body.amount tin được.
    const groupWhere: any = order.paymentGroupId ? { paymentGroupId: order.paymentGroupId } : { id: orderId };
    const agg = await this.prisma.order.aggregate({ where: groupWhere, _sum: { totalAmount: true } });
    const expected = Math.floor(Number(agg._sum.totalAmount ?? order.totalAmount));
    const paid = Math.floor(Number(body.amount ?? -1));
    if (paid >= 0 && paid < expected) {
      this.logger.warn(`[Pay2S IPN] underpayment group=${order.paymentGroupId ?? orderId} paid=${paid} < expected=${expected}`);
      return res.status(HttpStatus.BAD_REQUEST).send({ message: 'Amount mismatch' });
    }
    const upd = await this.prisma.order.updateMany({
      where: { ...groupWhere, paymentStatus: 'PENDING' },
      data: { paymentStatus: 'PAID' },
    });
    if (upd.count === 0) this.logger.log(`[Pay2S IPN] group=${order.paymentGroupId ?? orderId} đã xử lý`);
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
      // Wiki 0083: nhóm thanh toán — mark tất cả đơn cùng group + so TỔNG tiền nhóm + idempotent.
      const groupWhere: any = order.paymentGroupId ? { paymentGroupId: order.paymentGroupId } : { id: orderId };
      const agg = await this.prisma.order.aggregate({ where: groupWhere, _sum: { totalAmount: true } });
      const expected = Math.floor(Number(agg._sum.totalAmount ?? order.totalAmount));
      const paid = Math.floor(Number(body.amount ?? -1));
      if (paid >= 0 && paid < expected) {
        this.logger.warn(`[MoMo IPN] underpayment group=${order.paymentGroupId ?? orderId} paid=${paid} < expected=${expected}`);
        return res.status(HttpStatus.BAD_REQUEST).send({ message: 'Amount mismatch' });
      }
      const upd = await this.prisma.order.updateMany({
        where: { ...groupWhere, paymentStatus: 'PENDING' },
        data: { paymentStatus: 'PAID' },
      });
      if (upd.count === 0) this.logger.log(`[MoMo IPN] group=${order.paymentGroupId ?? orderId} đã xử lý`);
    } else {
      this.logger.log(`[MoMo IPN] orderId=${orderId} resultCode=${body.resultCode} message=${body.message}`);
    }
    return res.status(HttpStatus.OK).send({ success: true });
  }
}
