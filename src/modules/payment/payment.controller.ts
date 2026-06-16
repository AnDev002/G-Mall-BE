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

  // Wiki 0086: phát hiện tín hiệu THẤT BẠI tường minh từ IPN. Chỉ skip mark PAID khi có cờ lỗi
  // rõ ràng (status string failed/cancelled, hoặc resultCode != 0). Giữ nguyên hành vi khi field
  // vắng mặt → KHÔNG false-reject đơn hợp lệ (cổng nào không gửi field này vẫn chạy như cũ).
  private hasExplicitPaymentFailure(body: any): boolean {
    const statusStr = String(body?.status ?? body?.payment_status ?? body?.transactionStatus ?? '').toLowerCase();
    if (['failed', 'fail', 'cancelled', 'canceled', 'declined', 'expired'].includes(statusStr)) return true;
    if (body?.resultCode !== undefined && body?.resultCode !== null && body?.resultCode !== '' &&
        Number.isFinite(Number(body.resultCode)) && Number(body.resultCode) !== 0) return true;
    return false;
  }

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

    // Wiki 0086: chỉ mark PAID khi KHÔNG có tín hiệu thất bại tường minh — Pay2S có thể callback
    // cả giao dịch failed/cancelled với chữ ký hợp lệ → trước đây vẫn mark PAID (nhận đơn chưa trả).
    if (this.hasExplicitPaymentFailure(body)) {
      this.logger.warn(`[Pay2S IPN] not successful, skip PAID: status=${body?.status} resultCode=${body?.resultCode}`);
      return res.status(HttpStatus.OK).send({ success: true });
    }
    // Wiki 0083: nhóm thanh toán (multi-shop) — mark TẤT CẢ đơn cùng paymentGroupId + so khớp
    // TỔNG tiền cả nhóm. Chữ ký đã verify ở trên nên body.amount tin được.
    const groupWhere: any = order.paymentGroupId ? { paymentGroupId: order.paymentGroupId } : { id: orderId };
    const agg = await this.prisma.order.aggregate({ where: groupWhere, _sum: { totalAmount: true }, _count: true });
    const expected = Math.floor(Number(agg._sum.totalAmount ?? order.totalAmount));
    const paid = Math.floor(Number(body.amount ?? -1));
    // Wiki 0086: nếu amount THIẾU/không phải số hữu hạn (paid < 0 hoặc NaN khi amount="abc") →
    // KHÔNG verify được số tiền → KHÔNG mark PAID. Trước đây `paid >= 0` false → bỏ qua check
    // underpay → đơn PAID không kiểm tiền. Trả 200 OK để cổng ngừng retry nhưng KHÔNG đụng paymentStatus.
    if (!Number.isFinite(paid) || paid < 0) {
      this.logger.warn(`[Pay2S IPN] missing/invalid amount, skip PAID: group=${order.paymentGroupId ?? orderId} amount=${body?.amount}`);
      return res.status(HttpStatus.OK).send({ success: true });
    }
    // Wiki 0086: dung sai làm tròn — tổng totalAmount/đơn (đã FLOOR phân bổ voucher/xu) có thể
    // > số tiền cổng charge vài đồng/đơn → trước đây false-reject đơn ĐÃ trả. Vẫn chặn underpay thật.
    const tolerance = (agg._count || 1) * 4 + 10;
    if (paid < expected - tolerance) {
      this.logger.warn(`[Pay2S IPN] underpayment group=${order.paymentGroupId ?? orderId} paid=${paid} < expected=${expected} (tol=${tolerance})`);
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
      const agg = await this.prisma.order.aggregate({ where: groupWhere, _sum: { totalAmount: true }, _count: true });
      const expected = Math.floor(Number(agg._sum.totalAmount ?? order.totalAmount));
      const paid = Math.floor(Number(body.amount ?? -1));
      // Wiki 0086: nếu amount THIẾU/không phải số hữu hạn (paid < 0 hoặc NaN khi amount="abc") →
      // KHÔNG verify được số tiền → KHÔNG mark PAID. Trước đây `paid >= 0` false → bỏ qua check
      // underpay → đơn PAID không kiểm tiền. Trả 200 OK để cổng ngừng retry nhưng KHÔNG đụng paymentStatus.
      if (!Number.isFinite(paid) || paid < 0) {
        this.logger.warn(`[MoMo IPN] missing/invalid amount, skip PAID: group=${order.paymentGroupId ?? orderId} amount=${body?.amount}`);
        return res.status(HttpStatus.OK).send({ success: true });
      }
      // Wiki 0086: dung sai làm tròn (xem giải thích ở Pay2S) — tránh false-reject đơn đã trả.
      const tolerance = (agg._count || 1) * 4 + 10;
      if (paid < expected - tolerance) {
        this.logger.warn(`[MoMo IPN] underpayment group=${order.paymentGroupId ?? orderId} paid=${paid} < expected=${expected} (tol=${tolerance})`);
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
