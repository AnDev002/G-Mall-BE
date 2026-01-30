// src/database/prisma/seed-sellers.ts

import { PrismaClient, ShopStatus, Role } from '@prisma/client';
import * as dotenv from 'dotenv';

// Load biến môi trường
dotenv.config();

const prisma = new PrismaClient();

// Hàm tạo slug đơn giản (giống trong seed.ts của bạn)
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ /g, '-')
    .replace(/[^\w-]+/g, '') + '-' + Date.now() + Math.floor(Math.random() * 999);
}

async function main() {
  console.log('🚀 Bắt đầu seed 15 tài khoản Seller và Shop...');

  // Mật khẩu hash mẫu (ví dụ cho "123456"). 
  // Nếu hệ thống bạn dùng bcrypt, hãy thay chuỗi này bằng hash thực tế từ code của bạn.
  // Đây là hash bcrypt chuẩn của "123456"
  const DEFAULT_PASSWORD_HASH = '$2b$10$3euPcmQFCiblsZeEu5s7p.9OVHhyHd.7.1jZ5C5.1.1.1.1'; 

  const numberOfSellers = 15;

  for (let i = 1; i <= numberOfSellers; i++) {
    const sellerName = `Seller Test ${i}`;
    const email = `seller${i}@example.com`;
    const username = `seller_user_${i}`;
    const shopName = `Cửa Hàng Số ${i} Vip`;
    
    console.log(`⏳ Đang tạo: ${sellerName} (${email})...`);

    try {
      // 1. Tạo User (Seller) trước
      const user = await prisma.user.create({
        data: {
          email: email,
          username: username,
          password: DEFAULT_PASSWORD_HASH, 
          name: sellerName,
          role: Role.SELLER, // Set role Seller
          isVerified: true,  // Mặc định đã xác thực
          walletBalance: 0,
          
          // Lưu ý: Trong schema của bạn, User cũng có trường shopName @unique
          // Nên cần điền vào đây để tránh lỗi và đồng bộ dữ liệu
          shopName: shopName, 
        },
      });

      // 2. Tạo Shop ngay sau khi có User ID
      const shopSlug = generateSlug(shopName);
      
      await prisma.shop.create({
        data: {
          name: shopName,
          slug: shopSlug,
          description: `Đây là mô tả cho ${shopName}. Chuyên cung cấp các sản phẩm chất lượng cao.`,
          
          // Liên kết quan trọng: Owner là User vừa tạo
          ownerId: user.id, 
          
          status: ShopStatus.ACTIVE, // Shop hoạt động luôn
          rating: 5.0,
          totalSales: Math.floor(Math.random() * 1000), // Fake số liệu bán
          pickupAddress: "123 Đường Demo, Quận 1, TP.HCM",
          
          // Fake tọa độ (nếu cần cho map)
          lat: 10.762622,
          lng: 106.660172,
        },
      });

      console.log(`   ✅ Xong: User [${user.id}] -> Shop [${shopName}]`);

    } catch (error) {
      console.error(`   ❌ Lỗi khi tạo seller thứ ${i}:`, error);
    }
  }

  console.log('\n🎉 HOÀN TẤT QUÁ TRÌNH SEED SELLER!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });