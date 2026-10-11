import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const targetEmail = 'e.commerce.06.2025@gmail.com';
  
  const user = await prisma.user.findUnique({ 
    where: { email: targetEmail } 
  });

  if (!user) {
    console.log(`❌ Không tìm thấy tài khoản với email: ${targetEmail}`);
    return;
  }

  console.log(`Đang xóa dữ liệu của user: ${targetEmail} (ID: ${user.id})...`);

  try {
    // 1. Xóa tất cả các dữ liệu liên quan không có onDelete: Cascade
    await prisma.cart.deleteMany({ where: { userId: user.id } });
    await prisma.pointWallet.deleteMany({ where: { userId: user.id } });
    await prisma.dailyCheckIn.deleteMany({ where: { userId: user.id } });
    await prisma.pointHistory.deleteMany({ where: { userId: user.id } });
    await prisma.pointTransaction.deleteMany({ where: { userId: user.id } });
    await prisma.address.deleteMany({ where: { userId: user.id } });
    await prisma.payoutRequest.deleteMany({ where: { userId: user.id } });
    await prisma.walletTransaction.deleteMany({ where: { userId: user.id } });
    await prisma.productReview.deleteMany({ where: { userId: user.id } });
    await prisma.shopReview.deleteMany({ where: { userId: user.id } });
    
    // Nếu có đơn hàng (cần xóa item trước do orderItem không có cascade)
    await prisma.orderItem.deleteMany({ where: { order: { userId: user.id } } });
    await prisma.order.deleteMany({ where: { userId: user.id } });

    // 2. Xóa Shop (nếu user này là Seller)
    await prisma.shop.deleteMany({ where: { ownerId: user.id } });
    
    // 3. Cuối cùng mới xóa User
    await prisma.user.delete({ where: { id: user.id } });

    console.log('✅ Xóa tài khoản thành công! Bạn có thể test đăng ký lại.');
  } catch (error) {
    console.error('❌ Lỗi trong quá trình xóa:', error);
  }
}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
