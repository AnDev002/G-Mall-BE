// src/database/prisma/seed-sellers.ts

import { PrismaClient, ShopStatus, Role } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt'; // <--- Thêm dòng này

// Load biến môi trường
dotenv.config();

const prisma = new PrismaClient();

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

  // --- SỬA LẠI ĐOẠN NÀY ---
  // Tạo hash thực tế cho password "123456"
  const RAW_PASSWORD = '123456'; 
  const hashedPassword = await bcrypt.hash(RAW_PASSWORD, 10);
  // ------------------------

  const numberOfSellers = 15;

  for (let i = 1; i <= numberOfSellers; i++) {
    const sellerName = `Seller Test ${i}`;
    const email = `seller${i}@gmall.com.vn`;
    const username = `seller_user_${i}`;
    const shopName = `Cửa Hàng Số ${i} Vip`;
    
    console.log(`⏳ Đang tạo: ${sellerName} (${email})...`);

    try {
      const user = await prisma.user.create({
        data: {
          email: email,
          username: username,
          password: hashedPassword, // Sử dụng hash thật vừa tạo
          name: sellerName,
          role: Role.SELLER,
          isVerified: true,
          walletBalance: 0,
          shopName: shopName, 
        },
      });

      const shopSlug = generateSlug(shopName);
      
      await prisma.shop.create({
        data: {
          name: shopName,
          slug: shopSlug,
          description: `Đây là mô tả cho ${shopName}. Chuyên cung cấp các sản phẩm chất lượng cao.`,
          ownerId: user.id, 
          status: ShopStatus.ACTIVE,
          rating: 5.0,
          totalSales: Math.floor(Math.random() * 1000),
          pickupAddress: "123 Đường Demo, Quận 1, TP.HCM",
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
  console.log(`👉 Mật khẩu cho tất cả tài khoản là: ${RAW_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });