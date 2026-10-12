/**
 * prisma/seed-delete-buyers.ts
 *
 * Xoá TOÀN BỘ tài khoản role BUYER. GIỮ NGUYÊN: ADMIN, SELLER, PENDING_SELLER và mọi Shop.
 *
 * Chạy:
 *   pnpm ts-node prisma/seed-delete-buyers.ts            # DRY-RUN: chỉ đếm, không xoá gì
 *   pnpm ts-node prisma/seed-delete-buyers.ts --confirm  # xoá thật (có đếm ngược 5s để kịp Ctrl+C)
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO KHÔNG CHỈ `user.deleteMany({ where: { role: 'BUYER' } })`?
 * Schema có nhiều quan hệ tới User KHÔNG khai `onDelete` → Prisma mặc định là RESTRICT
 * cho quan hệ bắt buộc → xoá user sẽ vỡ FK. Nên phải dọn các bảng con trước, theo thứ tự:
 *
 *   RESTRICT (phải xoá tay): ProductReview, ShopReview, Order(+OrderItem), Cart, Address,
 *     PointTransaction, PointHistory, PointWallet, DailyCheckIn, WalletTransaction,
 *     PayoutRequest, Complaint
 *   CASCADE (DB tự xoá khi xoá user): Friendship, UserVoucher, Notification,
 *     AffiliateAccount (+Link/Click/Commission/Settlement), Message
 *   SET NULL (giữ dòng, bỏ liên kết): Donation.userId, User.referredById,
 *     Product.sellerId, Voucher.sellerId
 *
 * KHÔNG TỰ ĐỘNG XOÁ (bỏ qua có chủ đích — xem log "được giữ lại"):
 *   - BUYER đang sở hữu Shop: đây là người vừa đăng ký bán hàng, chờ admin duyệt
 *     (registerSeller tạo User role=BUYER + Shop status=PENDING). Shop.owner là CASCADE
 *     nên xoá user sẽ kéo theo xoá luôn Shop + hồ sơ pháp lý → giữ lại.
 *   - BUYER là tác giả BlogPost (BlogPost.authorId bắt buộc, không cascade).
 * ---------------------------------------------------------------------------
 */
import {
  PrismaClient,
  Prisma,
  Role,
  AffiliateCommissionStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

const CONFIRM = process.argv.includes('--confirm');
const CHUNK_SIZE = 500; // tránh `IN (...)` quá dài
const COUNTDOWN_SECONDS = 5;

/** Điều kiện chọn user sẽ bị xoá. Dùng chung cho đếm + xoá. */
const BUYER_WHERE: Prisma.UserWhereInput = {
  role: Role.BUYER,
  shop: { is: null }, // giữ người đăng ký bán hàng (BUYER + Shop PENDING)
  blogPosts: { none: {} }, // giữ tác giả blog
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function chunk<T>(arr: T[], size = CHUNK_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** In host/db đang trỏ tới (KHÔNG in password) để khỏi xoá nhầm DB production. */
function describeDatabase(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? '');
    return `${u.hostname}:${u.port || '3306'}${u.pathname}`;
  } catch {
    return '(không đọc được DATABASE_URL)';
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Xoá dữ liệu của 1 lô user (chạy bên trong transaction)
// ---------------------------------------------------------------------------

async function purgeChunk(
  tx: Prisma.TransactionClient,
  ids: string[],
  affected: { productIds: Set<string>; shopIds: Set<string> },
): Promise<number> {
  const byUser = { userId: { in: ids } };

  // 1. Đánh giá — ghi nhớ product/shop bị ảnh hưởng để tính lại rating sau.
  //    Phải xoá TRƯỚC Order vì ProductReview/ShopReview.orderId trỏ tới Order.
  const productRows = await tx.productReview.findMany({
    where: byUser,
    select: { productId: true },
    distinct: ['productId'],
  });
  productRows.forEach((r) => affected.productIds.add(r.productId));

  const shopRows = await tx.shopReview.findMany({
    where: byUser,
    select: { shopId: true },
    distinct: ['shopId'],
  });
  shopRows.forEach((r) => affected.shopIds.add(r.shopId));

  await tx.productReview.deleteMany({ where: byUser });
  await tx.shopReview.deleteMany({ where: byUser });

  // 2. Đơn hàng. OrderItem không cascade nên phải xoá trước Order.
  //    AffiliateCommission KHÔNG có FK tới Order/OrderItem (chỉ lưu chuỗi id) nên DB không
  //    tự dọn: nếu để lại dòng PENDING/APPROVED, kỳ chốt sổ sau vẫn có thể trả hoa hồng
  //    cho một đơn không còn tồn tại. Dòng SETTLED (tiền đã vào ví) giữ lại làm sổ sách.
  const orders = await tx.order.findMany({
    where: byUser,
    select: { id: true },
  });
  for (const orderIds of chunk(orders.map((o) => o.id))) {
    await tx.affiliateCommission.deleteMany({
      where: {
        orderId: { in: orderIds },
        status: { not: AffiliateCommissionStatus.SETTLED },
      },
    });
    await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await tx.order.deleteMany({ where: { id: { in: orderIds } } });
  }

  // 3. Gỡ viewerId trong nhật ký click affiliate (cột chuỗi, không có FK)
  await tx.affiliateClick.updateMany({
    where: { viewerId: { in: ids } },
    data: { viewerId: null },
  });

  // 4. Hội thoại có buyer tham gia: xoá cả hội thoại (Message cascade theo conversationId).
  //    Nếu chỉ xoá user thì Message do buyer gửi bị cascade, còn tin của seller/admin
  //    nằm lại trong một hội thoại mất người đối thoại.
  await tx.conversation.deleteMany({
    where: { participants: { some: { id: { in: ids } } } },
  });

  // 5. Các bảng con RESTRICT còn lại (CartItem cascade theo Cart)
  await tx.cart.deleteMany({ where: byUser });
  await tx.address.deleteMany({ where: byUser });
  await tx.pointTransaction.deleteMany({ where: byUser });
  await tx.pointHistory.deleteMany({ where: byUser });
  await tx.pointWallet.deleteMany({ where: byUser });
  await tx.dailyCheckIn.deleteMany({ where: byUser });
  await tx.walletTransaction.deleteMany({ where: byUser });
  await tx.payoutRequest.deleteMany({ where: byUser });
  await tx.complaint.deleteMany({ where: byUser });

  // 6. Cuối cùng mới xoá User. DB tự cascade: Friendship, UserVoucher, Notification,
  //    AffiliateAccount (+Link/Click/Commission/Settlement). Tự SET NULL: Donation.userId,
  //    referredById của người được giới thiệu, Product.sellerId, Voucher.sellerId.
  const { count } = await tx.user.deleteMany({ where: { id: { in: ids } } });
  return count;
}

/** Tính lại rating/reviewCount denormalize sau khi review bị xoá. */
async function recomputeRatings(
  tx: Prisma.TransactionClient,
  affected: { productIds: Set<string>; shopIds: Set<string> },
) {
  const round1 = (n: number | null) => (n ? Math.round(n * 10) / 10 : 0);

  for (const productId of affected.productIds) {
    const agg = await tx.productReview.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await tx.product.update({
      where: { id: productId },
      data: { rating: round1(agg._avg.rating), reviewCount: agg._count._all },
    });
  }

  for (const shopId of affected.shopIds) {
    const agg = await tx.shopReview.aggregate({
      where: { shopId },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await tx.shop.update({
      where: { id: shopId },
      data: { rating: round1(agg._avg.rating), reviewCount: agg._count._all },
    });
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('='.repeat(60));
  console.log(`Database : ${describeDatabase()}`);
  console.log(
    `Chế độ   : ${CONFIRM ? 'XOÁ THẬT (--confirm)' : 'DRY-RUN (chỉ đếm, không xoá)'}`,
  );
  console.log('='.repeat(60));

  // 1. Hiện trạng
  const byRole = await prisma.user.groupBy({
    by: ['role'],
    _count: { _all: true },
  });
  console.log('\nSố tài khoản theo role (trước khi xoá):');
  console.table(byRole.map((r) => ({ role: r.role, count: r._count._all })));

  const [keptShopOwners, keptBlogAuthors] = await Promise.all([
    prisma.user.count({ where: { role: Role.BUYER, shop: { isNot: null } } }),
    prisma.user.count({ where: { role: Role.BUYER, blogPosts: { some: {} } } }),
  ]);
  console.log(
    `\nBUYER được giữ lại: ${keptShopOwners} người đang sở hữu Shop (đăng ký bán chờ duyệt), ` +
      `${keptBlogAuthors} người là tác giả blog.`,
  );

  const buyers = await prisma.user.findMany({
    where: BUYER_WHERE,
    select: { id: true },
  });
  const buyerIds = buyers.map((b) => b.id);

  if (buyerIds.length === 0) {
    console.log('\nKhông có tài khoản BUYER nào cần xoá. Kết thúc.');
    return;
  }

  // 2. Đếm dữ liệu liên quan sẽ bị xoá
  const entries: [string, Promise<number>][] = [
    ['User (BUYER)', prisma.user.count({ where: BUYER_WHERE })],
    ['Order', prisma.order.count({ where: { user: BUYER_WHERE } })],
    ['ProductReview', prisma.productReview.count({ where: { user: BUYER_WHERE } })],
    ['ShopReview', prisma.shopReview.count({ where: { user: BUYER_WHERE } })],
    ['Cart', prisma.cart.count({ where: { user: BUYER_WHERE } })],
    ['Address', prisma.address.count({ where: { user: BUYER_WHERE } })],
    ['PointTransaction', prisma.pointTransaction.count({ where: { user: BUYER_WHERE } })],
    ['PointHistory', prisma.pointHistory.count({ where: { user: BUYER_WHERE } })],
    ['WalletTransaction', prisma.walletTransaction.count({ where: { user: BUYER_WHERE } })],
    ['PayoutRequest', prisma.payoutRequest.count({ where: { user: BUYER_WHERE } })],
    ['Complaint', prisma.complaint.count({ where: { user: BUYER_WHERE } })],
    ['Notification', prisma.notification.count({ where: { user: BUYER_WHERE } })],
    [
      'Friendship',
      prisma.friendship.count({
        where: { OR: [{ sender: BUYER_WHERE }, { receiver: BUYER_WHERE }] },
      }),
    ],
    [
      'Conversation (xoá cả hội thoại)',
      prisma.conversation.count({ where: { participants: { some: BUYER_WHERE } } }),
    ],
    ['AffiliateAccount', prisma.affiliateAccount.count({ where: { user: BUYER_WHERE } })],
    [
      'Donation (GIỮ LẠI, userId → NULL)',
      prisma.donation.count({ where: { user: BUYER_WHERE } }),
    ],
  ];
  const results = await Promise.all(entries.map(([, p]) => p));
  console.log('\nDữ liệu sẽ bị xoá:');
  console.table(
    entries.map(([label], i) => ({ Bảng: label, 'Số dòng': results[i] })),
  );

  if (!CONFIRM) {
    console.log(
      '\n[DRY-RUN] Chưa xoá gì. Kiểm tra số liệu rồi chạy lại với --confirm để xoá thật.',
    );
    return;
  }

  // 3. Đếm ngược để kịp huỷ
  console.log(
    `\n⚠️  Sẽ XOÁ THẬT ${buyerIds.length} tài khoản BUYER sau ${COUNTDOWN_SECONDS}s — Ctrl+C để huỷ...`,
  );
  await sleep(COUNTDOWN_SECONDS * 1000);

  // 4. Xoá trong MỘT transaction: lỗi ở bất kỳ bước nào → rollback toàn bộ.
  const affected = { productIds: new Set<string>(), shopIds: new Set<string>() };

  const deleted = await prisma.$transaction(
    async (tx) => {
      let total = 0;
      const batches = chunk(buyerIds);
      for (let i = 0; i < batches.length; i++) {
        total += await purgeChunk(tx, batches[i], affected);
        console.log(`  lô ${i + 1}/${batches.length}: đã xoá ${total}/${buyerIds.length} user`);
      }
      await recomputeRatings(tx, affected);
      return total;
    },
    { timeout: 10 * 60 * 1000, maxWait: 10_000 },
  );

  // 5. Kiểm tra lại
  const after = await prisma.user.groupBy({
    by: ['role'],
    _count: { _all: true },
  });
  console.log(`\n✅ Đã xoá ${deleted} tài khoản BUYER.`);
  console.log(
    `   Đã tính lại rating cho ${affected.productIds.size} sản phẩm, ${affected.shopIds.size} shop.`,
  );
  console.log('\nSố tài khoản theo role (sau khi xoá):');
  console.table(after.map((r) => ({ role: r.role, count: r._count._all })));
}

main()
  .catch((e) => {
    console.error('\n❌ Lỗi — transaction đã rollback, DB không bị thay đổi:\n', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });