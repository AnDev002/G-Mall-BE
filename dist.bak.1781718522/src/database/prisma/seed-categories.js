"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const faker_1 = require("@faker-js/faker");
const slugify_1 = __importDefault(require("slugify"));
const prisma = new client_1.PrismaClient();
const createSlug = (name) => (0, slugify_1.default)(name, { lower: true, locale: 'vi', remove: /[*+~.()'"!:@]/g }) + '-' + Date.now();
const PRODUCT_IMAGES = [
    "https://down-bs-vn.img.susercontent.com/vn-11134207-7r98o-lmzzm22jdz2ub0.webp",
    "https://down-bs-vn.img.susercontent.com/vn-11134207-7qukw-ljz616524jiy56.webp",
    "https://down-bs-vn.img.susercontent.com/vn-11134207-7r98o-lon94843477j68.webp",
    "https://down-bs-vn.img.susercontent.com/vn-11134207-7r98o-lon948435lrz44.webp",
    "https://down-bs-vn.img.susercontent.com/vn-11134207-7r98o-lmzzm22jevmad6.webp",
    "https://down-vn.img.susercontent.com/file/sg-11134201-22100-2442432423ivd5",
];
const CATEGORY_TREES = [
    {
        name: "Sức khỏe & Sắc đẹp",
        children: [
            {
                name: "Chăm sóc răng miệng",
                children: [
                    {
                        name: "Bàn chải",
                        children: ["Bàn chải điện", "Bàn chải thường", "Đầu bàn chải thay thế", "Máy tăm nước"]
                    },
                    {
                        name: "Kem đánh răng",
                        children: ["Làm trắng răng", "Cho răng nhạy cảm", "Hương thảo dược"]
                    }
                ]
            },
            {
                name: "Chăm sóc da mặt",
                children: [
                    {
                        name: "Làm sạch",
                        children: ["Sữa rửa mặt", "Tẩy trang", "Tẩy tế bào chết"]
                    }
                ]
            }
        ]
    },
    {
        name: "Thiết bị điện tử",
        children: [
            {
                name: "Điện thoại & Phụ kiện",
                children: [
                    {
                        name: "Điện thoại di động",
                        children: ["Apple", "Samsung", "Xiaomi", "Oppo"]
                    },
                    {
                        name: "Phụ kiện",
                        children: ["Ốp lưng", "Kính cường lực", "Cáp sạc"]
                    }
                ]
            }
        ]
    },
    {
        name: "Thời trang Nam",
        children: [
            {
                name: "Áo",
                children: [
                    {
                        name: "Áo thun",
                        children: ["Áo thun ngắn tay", "Áo thun dài tay", "Áo Polo"]
                    }
                ]
            }
        ]
    }
];
const KEYWORDS_PREFIX = ["Siêu Rẻ", "Xả Kho", "Chính Hãng", "Cao Cấp", "[Mã giảm 50k]", "Hot Trend", "Freeship"];
async function main() {
    console.log('🚀 Bắt đầu seed dữ liệu Shopee 4 Cấp...');
    await prisma.cartItem.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.productVariant.deleteMany();
    await prisma.productOptionValue.deleteMany();
    await prisma.productOption.deleteMany();
    await prisma.product.deleteMany();
    await prisma.shopCategory.deleteMany();
    await prisma.shop.deleteMany();
    await prisma.user.deleteMany();
    await prisma.category.deleteMany();
    console.log('📦 Đang tạo cấu trúc danh mục 4 cấp...');
    const leafCategoryIds = [];
    for (const l1 of CATEGORY_TREES) {
        const cat1 = await prisma.category.create({
            data: { name: l1.name, slug: createSlug(l1.name), image: faker_1.fakerVI.image.urlLoremFlickr({ category: 'fashion' }) }
        });
        if (l1.children) {
            for (const l2 of l1.children) {
                const cat2 = await prisma.category.create({
                    data: { name: l2.name, slug: createSlug(l2.name), parentId: cat1.id }
                });
                if (l2.children) {
                    for (const l3 of l2.children) {
                        const cat3 = await prisma.category.create({
                            data: { name: l3.name, slug: createSlug(l3.name), parentId: cat2.id }
                        });
                        if (l3.children) {
                            for (const l4Name of l3.children) {
                                const cat4 = await prisma.category.create({
                                    data: { name: l4Name, slug: createSlug(l4Name), parentId: cat3.id }
                                });
                                leafCategoryIds.push(cat4.id);
                            }
                        }
                        else {
                            leafCategoryIds.push(cat3.id);
                        }
                    }
                }
            }
        }
    }
    console.log('🏪 Đang tạo 10 Shop & Seller...');
    const shops = [];
    for (let i = 0; i < 10; i++) {
        const user = await prisma.user.create({
            data: {
                email: `seller${i}@shopee.fake`,
                name: faker_1.fakerVI.person.fullName(),
                password: 'password123',
                role: client_1.Role.SELLER,
                isVerified: true,
                phone: faker_1.fakerVI.phone.number(),
                avatar: faker_1.fakerVI.image.avatar(),
                walletBalance: 0,
            }
        });
        const shop = await prisma.shop.create({
            data: {
                name: faker_1.fakerVI.company.name() + (i % 2 === 0 ? " Official Store" : " Mall"),
                slug: createSlug(faker_1.fakerVI.company.name()),
                ownerId: user.id,
                avatar: faker_1.fakerVI.image.urlLoremFlickr({ category: 'business' }),
                coverImage: faker_1.fakerVI.image.urlLoremFlickr({ category: 'nature' }),
                description: faker_1.fakerVI.lorem.paragraph(),
                status: 'ACTIVE',
                rating: faker_1.fakerVI.number.float({ min: 4.2, max: 5.0, fractionDigits: 1 }),
                totalSales: faker_1.fakerVI.number.int({ min: 500, max: 100000 }),
                pickupAddress: faker_1.fakerVI.location.streetAddress() + ", TP.HCM",
                shopCategories: {
                    create: [{ name: "Sản phẩm mới" }, { name: "Sale sập sàn" }]
                }
            },
            include: { shopCategories: true }
        });
        shops.push(shop);
    }
    console.log('👕 Đang tạo 300 sản phẩm...');
    for (const shop of shops) {
        for (let j = 0; j < 30; j++) {
            const categoryId = faker_1.fakerVI.helpers.arrayElement(leafCategoryIds);
            const prefix = faker_1.fakerVI.helpers.arrayElement(KEYWORDS_PREFIX);
            const baseName = faker_1.fakerVI.commerce.productName();
            const productName = `${prefix} ${baseName} ${faker_1.fakerVI.commerce.productAdjective()}`;
            const originalPrice = Number(faker_1.fakerVI.commerce.price({ min: 50000, max: 5000000 }));
            const price = Math.floor(originalPrice * 0.7);
            const hasVariants = Math.random() > 0.2;
            const product = await prisma.product.create({
                data: {
                    name: productName,
                    slug: createSlug(productName),
                    description: faker_1.fakerVI.commerce.productDescription() + "\n\n" + faker_1.fakerVI.lorem.paragraphs(2),
                    price: price,
                    originalPrice: originalPrice,
                    stock: faker_1.fakerVI.number.int({ min: 50, max: 1000 }),
                    images: JSON.stringify(faker_1.fakerVI.helpers.arrayElements(PRODUCT_IMAGES, faker_1.fakerVI.number.int({ min: 3, max: 5 }))),
                    status: client_1.ProductStatus.ACTIVE,
                    salesCount: faker_1.fakerVI.number.int({ min: 10, max: 5000 }),
                    rating: faker_1.fakerVI.number.float({ min: 3, max: 5, fractionDigits: 1 }),
                    categoryId: categoryId,
                    shopId: shop.id,
                    sellerId: shop.ownerId,
                    shopCategoryId: faker_1.fakerVI.helpers.arrayElement(shop.shopCategories)?.id,
                    attributes: JSON.stringify({
                        brand: "No Brand",
                        origin: "Việt Nam",
                        warranty: "12 Tháng"
                    }),
                }
            });
            if (hasVariants) {
                const option1 = await prisma.productOption.create({
                    data: {
                        productId: product.id,
                        name: Math.random() > 0.5 ? "Màu sắc" : "Kiểu dáng",
                        position: 0,
                        values: {
                            create: [
                                { value: "Cơ bản", image: PRODUCT_IMAGES[0], position: 0 },
                                { value: "Cao cấp", image: PRODUCT_IMAGES[1], position: 1 }
                            ]
                        }
                    },
                    include: { values: true }
                });
                let option2 = null;
                if (Math.random() > 0.5) {
                    option2 = await prisma.productOption.create({
                        data: {
                            productId: product.id,
                            name: "Kích cỡ",
                            position: 1,
                            values: {
                                create: [
                                    { value: "Nhỏ", position: 0 },
                                    { value: "Lớn", position: 1 }
                                ]
                            }
                        },
                        include: { values: true }
                    });
                }
                if (!option2) {
                    for (const val1 of option1.values) {
                        await prisma.productVariant.create({
                            data: {
                                productId: product.id,
                                price: price,
                                stock: faker_1.fakerVI.number.int({ min: 10, max: 50 }),
                                sku: `${product.id.slice(0, 5)}-${val1.value}`,
                                tierIndex: `${val1.position}`
                            }
                        });
                    }
                }
                else {
                    for (const val1 of option1.values) {
                        for (const val2 of option2.values) {
                            await prisma.productVariant.create({
                                data: {
                                    productId: product.id,
                                    price: price + (val2.position * 10000),
                                    stock: faker_1.fakerVI.number.int({ min: 10, max: 50 }),
                                    sku: `${product.id.slice(0, 5)}-${val1.value}-${val2.value}`,
                                    tierIndex: `${val1.position},${val2.position}`
                                }
                            });
                        }
                    }
                }
            }
        }
        console.log(`   -> Đã seed xong Shop: ${shop.name}`);
    }
    console.log('✅ Seed hoàn tất!');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed-categories.js.map