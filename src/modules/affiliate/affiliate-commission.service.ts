import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { SystemSettingService } from '../../common/services/system-setting.service';

/** Một mục quy đổi FE gửi lên lúc thanh toán, lấy từ cookie `gm_aff`. */
export interface AffiliateRef {
  productId: string;
  code: string;
}

/** Kết quả sau khi BE kiểm lại — chỉ những mục hợp lệ mới có mặt. */
export interface ResolvedAffiliate {
  linkId: string;
  accountId: string;
  rate: number;
  shopId: string | null;
  sellerId: string | null;
}

/**
 * wiki 0105 — SỔ CÁI hoa hồng affiliate.
 *
 * Tách khỏi `order.service.ts` có chủ đích: file đó đã gánh gần như toàn bộ logic tiền
 * của sàn (voucher, xu, phí sàn, từ thiện, referral, hoàn kho, flash-sale) và là nơi
 * sinh ra nhiều bug tiền nhất trong lịch sử dự án. Thêm một hệ tiền nữa vào đó là làm
 * cho chỗ khó nhất càng khó. Ở đây `order.service` chỉ gọi ba hàm rõ nghĩa.
 *
 * Vòng đời một dòng hoa hồng:
 *   PENDING (đặt đơn) → APPROVED (giao xong) → SETTLED (chốt sổ, tiền vào ví)
 *                     ↘ CANCELLED (đơn huỷ)   ↘ REJECTED (gian lận)
 */
@Injectable()
export class AffiliateCommissionService {
  private readonly logger = new Logger(AffiliateCommissionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemSetting: SystemSettingService,
  ) {}

  /**
   * Kiểm lại từng mục quy đổi do FE gửi lên. Chạy NGOÀI transaction để giữ transaction
   * đặt hàng ngắn nhất có thể.
   *
   * Cookie nằm ở phía người dùng nên phải coi là dữ liệu KHÔNG tin được: mọi điều kiện
   * đều kiểm lại ở đây. Mục nào không qua thì bị bỏ IM LẶNG (không ném lỗi) — một link
   * hỏng không được phép làm hỏng cả đơn hàng của người mua.
   */
  async resolveRefs(
    buyerId: string,
    refs: AffiliateRef[] | undefined,
  ): Promise<Map<string, ResolvedAffiliate>> {
    const out = new Map<string, ResolvedAffiliate>();
    if (!Array.isArray(refs) || refs.length === 0) return out;

    // Chặn payload phình: 50 mục là quá thừa cho một lần thanh toán.
    const capped = refs.slice(0, 50).filter((r) => r?.productId && r?.code);
    if (capped.length === 0) return out;

    const links = await this.prisma.affiliateLink.findMany({
      where: { code: { in: capped.map((r) => String(r.code)) } },
      include: {
        account: { select: { id: true, userId: true, status: true } },
        product: {
          select: {
            id: true,
            affiliateEnabled: true,
            affiliateRate: true,
            shopId: true,
            sellerId: true,
          },
        },
      },
    });
    const byCode = new Map(links.map((l) => [l.code, l]));

    for (const ref of capped) {
      const link = byCode.get(String(ref.code));
      if (!link) continue;

      // Link phải đúng SẢN PHẨM đang mua — nếu không, ai cũng có thể lấy một link bất
      // kỳ rồi gán cho món đắt tiền nhất trong giỏ.
      if (link.productId !== ref.productId) continue;

      if (link.account?.status !== 'APPROVED') continue;

      // CẤM TỰ MUA: người tiếp thị mua qua chính link của mình = tự giảm giá cho bản
      // thân bằng tiền của seller.
      if (link.account.userId === buyerId) continue;

      const product = link.product;
      if (!product?.affiliateEnabled) continue;

      const rate = product.affiliateRate === null ? 0 : Number(product.affiliateRate);
      if (!Number.isFinite(rate) || rate <= 0) continue;

      // Click sau đè click trước: Map ghi đè theo thứ tự duyệt.
      out.set(ref.productId, {
        linkId: link.id,
        accountId: link.accountId,
        rate,
        shopId: product.shopId,
        sellerId: product.sellerId,
      });
    }

    return out;
  }

  /**
   * Sinh dòng hoa hồng PENDING cho các món có gắn link. Gọi TRONG transaction đặt hàng.
   *
   * `rate` được CHỤP LẠI tại đây: seller đổi % bất cứ lúc nào, nhưng hoa hồng của một
   * đơn đã đặt thì không được đổi theo — nếu không, seller có thể hạ % ngay sau khi có
   * đơn để trả ít đi.
   */
  async createPendingForOrder(
    tx: Prisma.TransactionClient,
    params: {
      orderId: string;
      items: { id: string; productId: string | null; quantity: number; price: Prisma.Decimal }[];
      affMap: Map<string, ResolvedAffiliate>;
    },
  ): Promise<number> {
    if (params.affMap.size === 0) return 0;

    let created = 0;
    for (const item of params.items) {
      if (!item.productId) continue;
      const aff = params.affMap.get(item.productId);
      if (!aff) continue;

      // Gốc tính = giá bán × số lượng của CHÍNH món đó. Không tính phí ship, không tính
      // phí gói quà — hai khoản đó không phải doanh thu của sản phẩm.
      const baseAmount = Number(item.price) * item.quantity;
      if (!Number.isFinite(baseAmount) || baseAmount <= 0) continue;

      const amount = Math.floor(baseAmount * aff.rate);
      if (amount <= 0) continue;

      await tx.affiliateCommission.create({
        data: {
          accountId: aff.accountId,
          linkId: aff.linkId,
          orderId: params.orderId,
          orderItemId: item.id, // @unique — khoá chống trả hai lần
          productId: item.productId,
          shopId: aff.shopId,
          sellerId: aff.sellerId,
          baseAmount: new Prisma.Decimal(baseAmount),
          rate: new Prisma.Decimal(aff.rate),
          amount: new Prisma.Decimal(amount),
          status: 'PENDING',
        },
      });
      created++;
    }

    return created;
  }

  /**
   * Chốt hoa hồng khi đơn GIAO THÀNH CÔNG. Gọi TRONG transaction của
   * `creditSellerOnDelivered`, trả về TỔNG hoa hồng (đã áp trần) để trừ vào doanh thu seller.
   *
   * ÁP TRẦN — đây là chốt chặn quan trọng nhất của cả hệ (wiki 0105):
   *   `Order.totalAmount` KHÔNG phải tiền hàng mà là
   *   `hàng + ship + gói quà − voucher − xu`, và seller nhận `totalAmount × 95%`.
   *   Nghĩa là seller đang gánh cả phần sàn tài trợ. Nếu khách dùng nhiều xu, phần
   *   seller thực nhận có thể NHỎ HƠN hoa hồng tính trên giá niêm yết:
   *     SP 100.000đ + khách dùng 90.000đ xu → seller nhận 9.500đ, hoa hồng 20% = 20.000đ
   *     → seller ÂM 10.500đ chỉ vì có người chia sẻ link.
   *   Nên tổng hoa hồng bị kẹp ≤ phần seller thực nhận, cắt theo tỉ lệ giữa những người
   *   tiếp thị của đơn, và seller không bao giờ âm.
   */
  async approveOnDelivered(
    tx: Prisma.TransactionClient,
    orderId: string,
    sellerNetBeforeCommission: number,
  ): Promise<number> {
    const rows = await tx.affiliateCommission.findMany({
      where: { orderId, status: 'PENDING' },
    });
    if (rows.length === 0) return 0;

    const now = new Date();
    const rawTotal = rows.reduce((s, r) => s + Number(r.amount), 0);
    const cap = Math.max(0, Math.floor(sellerNetBeforeCommission));

    if (rawTotal <= cap) {
      await tx.affiliateCommission.updateMany({
        where: { orderId, status: 'PENDING' },
        data: { status: 'APPROVED', deliveredAt: now },
      });
      return rawTotal;
    }

    // Chạm trần → cắt theo tỉ lệ. Dòng CUỐI nhận phần dư để Σ khớp đúng `cap`
    // (cùng thủ pháp phân bổ greedy của createOrder — floor từng dòng sẽ rơi mất vài đồng).
    this.logger.warn(
      `[Affiliate CLAMP] order=${orderId} hoa hồng ${rawTotal} > phần seller nhận ${cap} → cắt theo tỉ lệ`,
    );
    let remaining = cap;
    for (let i = 0; i < rows.length; i++) {
      const isLast = i === rows.length - 1;
      const share = isLast
        ? remaining
        : Math.min(remaining, Math.floor((Number(rows[i].amount) / rawTotal) * cap));
      remaining -= share;
      await tx.affiliateCommission.update({
        where: { id: rows[i].id },
        data: {
          status: share > 0 ? 'APPROVED' : 'REJECTED',
          amount: new Prisma.Decimal(share),
          deliveredAt: now,
          rejectReason:
            share > 0
              ? 'Bị cắt theo tỉ lệ vì tổng hoa hồng vượt doanh thu thực nhận của shop'
              : 'Doanh thu thực nhận của shop không đủ để trả hoa hồng',
        },
      });
    }
    return cap;
  }

  /**
   * Đơn ĐÃ GIAO nhưng KHÔNG có doanh thu để trích hoa hồng → đóng sổ bằng `REJECTED`.
   *
   * `creditSellerOnDelivered` có nhiều nhánh thoát sớm (đơn không gắn shop, shop không
   * còn chủ, `net <= 0` do khuyến mãi ăn hết đơn). Nếu không đóng ở đây, dòng hoa hồng
   * nằm lại `PENDING` VĨNH VIỄN: chốt sổ chỉ quét `APPROVED`, còn người tiếp thị thì mãi
   * mãi thấy "chờ khách nhận hàng" cho một đơn đã giao xong.
   *
   * Cùng lớp lỗi với "tiền mắc kẹt" ở chốt sổ — hỏng âm thầm, không ai khiếu nại vì
   * không ai biết mình có khoản đó. Thà đóng lại kèm lý do đọc được còn hơn treo.
   */
  async rejectUnfundable(
    tx: Prisma.TransactionClient,
    orderId: string,
    reason: string,
  ): Promise<number> {
    const res = await tx.affiliateCommission.updateMany({
      where: { orderId, status: 'PENDING' },
      data: { status: 'REJECTED', rejectReason: reason, deliveredAt: new Date() },
    });
    if (res.count > 0) {
      this.logger.warn(
        `[Affiliate] đóng ${res.count} khoản của đơn ${orderId} vì không có doanh thu để trích: ${reason}`,
      );
    }
    return res.count;
  }

  /** Đơn huỷ → hoa hồng huỷ theo. Tiền chưa hề chuyển đi nên không ai mất gì. */
  async cancelForOrder(tx: Prisma.TransactionClient, orderId: string): Promise<number> {
    const res = await tx.affiliateCommission.updateMany({
      where: { orderId, status: { in: ['PENDING', 'APPROVED'] } },
      data: { status: 'CANCELLED', rejectReason: 'Đơn hàng đã huỷ' },
    });
    return res.count;
  }

  /** Trần % hoa hồng seller được đặt — dùng chung cho cả kiểm đầu vào lẫn hiển thị. */
  async getMaxRate(): Promise<number> {
    return this.systemSetting.getNumber('AFFILIATE_MAX_RATE', 0.3);
  }
}
