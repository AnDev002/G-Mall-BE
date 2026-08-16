import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';

const PAGE_SIZE = 24;
/** Gộp click trùng (cùng link + cùng IP) trong khoảng này để không thổi phồng số liệu. */
const CLICK_DEDUPE_MS = 60_000;

/**
 * wiki 0105 — link tiếp thị + nhật ký click + danh mục sản phẩm có hoa hồng.
 */
@Injectable()
export class AffiliateLinkService {
  private readonly logger = new Logger(AffiliateLinkService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Hồ sơ phải ĐÃ DUYỆT mới được lấy link — đây là chỗ luật "admin duyệt" có hiệu lực. */
  private async requireApprovedAccount(userId: string) {
    const account = await this.prisma.affiliateAccount.findUnique({ where: { userId } });
    if (!account) {
      throw new ForbiddenException('Bạn chưa đăng ký chương trình tiếp thị.');
    }
    if (account.status !== 'APPROVED') {
      throw new ForbiddenException(
        account.status === 'PENDING'
          ? 'Hồ sơ tiếp thị của bạn đang chờ duyệt.'
          : 'Tài khoản tiếp thị của bạn không ở trạng thái hoạt động.',
      );
    }
    return account;
  }

  private async generateLinkCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = Math.random().toString(36).slice(2, 10).toUpperCase();
      const dup = await this.prisma.affiliateLink.findUnique({ where: { code } });
      if (!dup) return code;
    }
    throw new BadRequestException('Không tạo được mã link, vui lòng thử lại.');
  }

  /**
   * Lấy link cho một sản phẩm. Gọi lại nhiều lần vẫn trả về ĐÚNG link cũ
   * (`@@unique([accountId, productId])`): người dùng đã dán link đi khắp nơi, đổi mã mỗi
   * lần bấm sẽ làm hỏng mọi bài đăng cũ của họ.
   */
  async createOrGetLink(userId: string, productId: string) {
    const account = await this.requireApprovedAccount(userId);

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        slug: true,
        images: true,
        price: true,
        shopId: true,
        affiliateEnabled: true,
        affiliateRate: true,
        status: true,
      },
    });
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại.');
    if (!product.affiliateEnabled || !product.affiliateRate || Number(product.affiliateRate) <= 0) {
      throw new BadRequestException('Sản phẩm này chưa bật tiếp thị liên kết.');
    }
    if (product.status !== 'ACTIVE') {
      throw new BadRequestException('Sản phẩm chưa được bán nên chưa lấy link được.');
    }

    const existing = await this.prisma.affiliateLink.findUnique({
      where: { accountId_productId: { accountId: account.id, productId } },
    });
    if (existing) {
      return this.toLinkView(existing, product);
    }

    const created = await this.prisma.affiliateLink.create({
      data: {
        code: await this.generateLinkCode(),
        accountId: account.id,
        productId,
        shopId: product.shopId,
      },
    });
    return this.toLinkView(created, product);
  }

  private toLinkView(link: { id: string; code: string; clicks: number }, product: any) {
    return {
      id: link.id,
      code: link.code,
      clicks: link.clicks,
      // Đường dẫn TƯƠNG ĐỐI: BE không biết domain nào đang phục vụ (localhost /
      // onrender / gmall.vn). FE ghép với `window.location.origin` — cùng cách trang
      // giới thiệu bạn bè đang làm.
      path: `/product-details/${product.id}?aff=${link.code}`,
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: Number(product.price),
        image: Array.isArray(product.images) ? product.images[0] ?? null : null,
        affiliateRate: Number(product.affiliateRate),
        estimatedCommission: Math.floor(Number(product.price) * Number(product.affiliateRate)),
      },
    };
  }

  /** Danh sách link của tôi, kèm số click và số tiền đã kiếm theo từng trạng thái. */
  async listMyLinks(userId: string, rawPage?: string) {
    const account = await this.requireApprovedAccount(userId);
    const page = Math.max(1, Number(rawPage) || 1);

    const [links, total] = await Promise.all([
      this.prisma.affiliateLink.findMany({
        where: { accountId: account.id },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            select: { id: true, name: true, slug: true, images: true, price: true, affiliateRate: true, affiliateEnabled: true },
          },
        },
      }),
      this.prisma.affiliateLink.count({ where: { accountId: account.id } }),
    ]);

    // Tiền LUÔN cộng từ sổ cái, không đọc cột tổng nào (wiki 0105: số dư denormalize
    // là nguồn drift). Gom một lượt theo linkId thay vì n+1 truy vấn.
    const grouped = links.length
      ? await this.prisma.affiliateCommission.groupBy({
          by: ['linkId', 'status'],
          where: { linkId: { in: links.map((l) => l.id) } },
          _sum: { amount: true },
          _count: { _all: true },
        })
      : [];

    const statsByLink = new Map<string, { orders: number; earned: number; pending: number }>();
    for (const g of grouped) {
      const cur = statsByLink.get(g.linkId) ?? { orders: 0, earned: 0, pending: 0 };
      const sum = Number(g._sum.amount ?? 0);
      if (g.status !== 'CANCELLED' && g.status !== 'REJECTED') cur.orders += g._count._all;
      if (g.status === 'SETTLED') cur.earned += sum;
      if (g.status === 'PENDING' || g.status === 'APPROVED') cur.pending += sum;
      statsByLink.set(g.linkId, cur);
    }

    return {
      data: links.map((l) => {
        const st = statsByLink.get(l.id) ?? { orders: 0, earned: 0, pending: 0 };
        return {
          id: l.id,
          code: l.code,
          clicks: l.clicks,
          path: `/product-details/${l.productId}?aff=${l.code}`,
          createdAt: l.createdAt,
          orders: st.orders,
          earnedSettled: st.earned,
          earnedPending: st.pending,
          product: {
            id: l.product?.id ?? l.productId,
            name: l.product?.name ?? '(sản phẩm đã bị gỡ)',
            price: l.product ? Number(l.product.price) : 0,
            image: Array.isArray(l.product?.images) ? (l.product!.images as any)[0] ?? null : null,
            affiliateRate: l.product?.affiliateRate ? Number(l.product.affiliateRate) : 0,
            // Seller có thể tắt affiliate SAU khi người ta đã lấy link → phải báo cho
            // người tiếp thị biết link đó không còn sinh hoa hồng nữa.
            affiliateEnabled: !!l.product?.affiliateEnabled,
          },
        };
      }),
      meta: { page, limit: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) },
    };
  }

  /**
   * Ghi nhận click. KHÔNG cần đăng nhập — người bấm link thường là khách vãng lai.
   *
   * Trả về 204-ish `{ ok: true }` kể cả khi mã sai: đây là điểm cuối công khai, báo
   * "mã không tồn tại" chỉ giúp người ta dò mã chứ không giúp được ai.
   */
  async recordClick(code: string, clientIp: string | null, userAgent: string | null, viewerId: string | null) {
    if (!code || typeof code !== 'string') return { ok: true };

    const link = await this.prisma.affiliateLink.findUnique({
      where: { code },
      select: { id: true, account: { select: { status: true, userId: true } } },
    });
    if (!link || link.account?.status !== 'APPROVED') return { ok: true };

    // Người tiếp thị tự bấm link của mình không được tính — nếu không, số click chỉ là
    // số lần họ tự làm mới trang.
    if (viewerId && viewerId === link.account.userId) return { ok: true };

    // Gộp click trùng cùng IP trong 60s: chống F5 liên tục thổi phồng số liệu.
    if (clientIp) {
      const recent = await this.prisma.affiliateClick.findFirst({
        where: {
          linkId: link.id,
          clientIp,
          createdAt: { gte: new Date(Date.now() - CLICK_DEDUPE_MS) },
        },
        select: { id: true },
      });
      if (recent) return { ok: true };
    }

    await this.prisma.$transaction([
      this.prisma.affiliateClick.create({
        data: {
          linkId: link.id,
          clientIp,
          userAgent: userAgent ? userAgent.slice(0, 500) : null,
          viewerId,
        },
      }),
      this.prisma.affiliateLink.update({
        where: { id: link.id },
        data: { clicks: { increment: 1 } },
      }),
    ]);

    return { ok: true };
  }

  /**
   * Danh mục sản phẩm ĐANG bật affiliate, của mọi shop — đây chính là "chọn danh sách
   * sản phẩm thuộc các shop" mà khách yêu cầu.
   */
  async listProducts(params: {
    search?: string;
    shopId?: string;
    categoryId?: string;
    sort?: string;
    page?: string;
  }) {
    const page = Math.max(1, Number(params.page) || 1);

    const where: Prisma.ProductWhereInput = {
      affiliateEnabled: true,
      affiliateRate: { gt: 0 },
      status: 'ACTIVE',
    };
    if (params.search?.trim()) where.name = { contains: params.search.trim() };
    if (params.shopId) where.shopId = params.shopId;
    if (params.categoryId) where.categoryId = params.categoryId;

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      params.sort === 'rate'
        ? { affiliateRate: 'desc' }
        : params.sort === 'price_asc'
          ? { price: 'asc' }
          : params.sort === 'price_desc'
            ? { price: 'desc' }
            : params.sort === 'bestseller'
              ? { salesCount: 'desc' }
              : { createdAt: 'desc' };

    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          images: true,
          salesCount: true,
          rating: true,
          affiliateRate: true,
          shop: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: rows.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        // Trả về SỐ, không phải Decimal → JSON.stringify của Prisma Decimal ra CHUỖI,
        // FE mất dấu phân cách và phép tính thành nối chuỗi (bug đã gặp ở wiki 0103).
        price: Number(p.price),
        image: Array.isArray(p.images) ? (p.images as any)[0] ?? null : null,
        salesCount: p.salesCount,
        rating: p.rating,
        affiliateRate: Number(p.affiliateRate),
        commissionPerUnit: Math.floor(Number(p.price) * Number(p.affiliateRate)),
        shop: p.shop ? { id: p.shop.id, name: p.shop.name, slug: p.shop.slug } : null,
      })),
      meta: { page, limit: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) },
    };
  }

  /** Danh sách shop đang có hàng bật affiliate — để FE dựng bộ lọc theo shop. */
  async listShops() {
    const rows = await this.prisma.product.groupBy({
      by: ['shopId'],
      where: { affiliateEnabled: true, affiliateRate: { gt: 0 }, status: 'ACTIVE', shopId: { not: null } },
      _count: { _all: true },
    });
    if (rows.length === 0) return [];

    const shops = await this.prisma.shop.findMany({
      where: { id: { in: rows.map((r) => r.shopId!) } },
      select: { id: true, name: true, slug: true, avatar: true },
    });
    const countById = new Map(rows.map((r) => [r.shopId!, r._count._all]));
    return shops
      .map((s) => ({ ...s, productCount: countById.get(s.id) ?? 0 }))
      .sort((a, b) => b.productCount - a.productCount);
  }
}
