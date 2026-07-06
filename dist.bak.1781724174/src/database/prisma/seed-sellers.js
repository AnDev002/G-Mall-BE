"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const dotenv = __importStar(require("dotenv"));
const bcrypt = __importStar(require("bcrypt"));
dotenv.config();
const prisma = new client_1.PrismaClient();
function generateSlug(name) {
    return name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ /g, '-')
        .replace(/[^\w-]+/g, '') + '-' + Date.now() + Math.floor(Math.random() * 999);
}
async function main() {
    console.log('🚀 Bắt đầu seed 15 Seller (Chế độ tự sửa lỗi Conflict)...');
    const RAW_PASSWORD = '123456';
    const hashedPassword = await bcrypt.hash(RAW_PASSWORD, 10);
    const numberOfSellers = 15;
    for (let i = 1; i <= numberOfSellers; i++) {
        const email = `mall.0${i}@gmall.com.vn`;
        const sellerName = `Seller ${i}`;
        const username = `seller_user_${i}`;
        const shopName = `Cửa Hàng Số ${i}`;
        console.log(`\n⏳ Đang xử lý: ${sellerName} (${email})...`);
        try {
            const conflictShopUser = await prisma.user.findUnique({
                where: { shopName: shopName }
            });
            if (conflictShopUser && conflictShopUser.email !== email) {
                console.log(`   ⚠️  Phát hiện shopName "${shopName}" đang thuộc về user cũ (${conflictShopUser.email}). Đang gỡ bỏ...`);
                await prisma.user.update({
                    where: { id: conflictShopUser.id },
                    data: { shopName: null }
                });
            }
            const conflictUsernameUser = await prisma.user.findUnique({
                where: { username: username }
            });
            if (conflictUsernameUser && conflictUsernameUser.email !== email) {
                console.log(`   ⚠️  Phát hiện username "${username}" đang thuộc về user cũ (${conflictUsernameUser.email}). Đang gỡ bỏ...`);
                await prisma.user.update({
                    where: { id: conflictUsernameUser.id },
                    data: { username: null }
                });
            }
            const user = await prisma.user.upsert({
                where: { email: email },
                update: {
                    role: client_1.Role.SELLER,
                    shopName: shopName,
                    isVerified: true,
                    username: username,
                },
                create: {
                    email: email,
                    username: username,
                    password: hashedPassword,
                    name: sellerName,
                    role: client_1.Role.SELLER,
                    isVerified: true,
                    walletBalance: 0,
                    shopName: shopName,
                },
            });
            const shopSlug = generateSlug(shopName);
            await prisma.shop.upsert({
                where: { ownerId: user.id },
                update: {
                    status: client_1.ShopStatus.ACTIVE,
                },
                create: {
                    name: shopName,
                    slug: shopSlug,
                    description: `Shop xịn của ${sellerName}`,
                    ownerId: user.id,
                    status: client_1.ShopStatus.ACTIVE,
                    rating: 5.0,
                    totalSales: Math.floor(Math.random() * 1000),
                    pickupAddress: "123 Đường Demo, Quận 1, TP.HCM",
                    lat: 10.762622,
                    lng: 106.660172,
                },
            });
            console.log(`   ✅ Thành công: ${email}`);
        }
        catch (error) {
            console.error(`   ❌ Lỗi không thể xử lý seller thứ ${i}:`, error);
        }
    }
    console.log('\n🎉 HOÀN TẤT!');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed-sellers.js.map