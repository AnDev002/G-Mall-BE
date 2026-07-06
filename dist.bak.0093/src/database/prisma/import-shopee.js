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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const csv = require("csv-parser");
const prisma = new client_1.PrismaClient();
const IMPORT_DIR = path.join(__dirname, '../../../data-import');
const CATEGORY_TREE = [
    {
        parent: "THỜI TRANG NỮ",
        children: [
            { name: "Áo Nữ", keywords: ['áo', 'top', 'croptop', 'polo', 'hoodie', 'sweater', 'cardigan', 'khoác', 'jacket', 'blazer'] },
            { name: "Quần & Chân Váy", keywords: ['quần', 'jeans', 'kaki', 'short', 'legging', 'váy', 'skirt'] },
            { name: "Đầm & Váy Liền", keywords: ['đầm', 'dress', 'yếm', 'jum', 'liền thân'] },
            { name: "Đồ Lót & Đồ Ngủ", keywords: ['lót', 'ngủ', 'bra', 'chip', 'nội y', 'pyjama'] },
            { name: "Giày Dép & Phụ Kiện", keywords: ['giày', 'dép', 'guốc', 'boot', 'túi', 'balo', 'ví', 'nón', 'kính', 'tất', 'vớ'] }
        ]
    },
    {
        parent: "ĐỒ ĐIỆN TỬ",
        children: [
            { name: "Phụ Kiện Điện Thoại", keywords: ['ốp', 'cường lực', 'dán', 'cáp', 'sạc', 'pin', 'giá đỡ', 'pop'] },
            { name: "Thiết Bị Âm Thanh", keywords: ['tai nghe', 'loa', 'mic', 'audio'] },
            { name: "Máy Tính & Laptop", keywords: ['laptop', 'chuột', 'phím', 'pad', 'usb', 'thẻ nhớ', 'wifi'] },
            { name: "Điện Gia Dụng", keywords: ['quạt', 'đèn', 'máy', 'nồi', 'bếp', 'ấm'] }
        ]
    },
    {
        parent: "SẮC ĐẸP",
        children: [
            { name: "Trang Điểm", keywords: ['son', 'phấn', 'cushion', 'mascara', 'kẻ', 'mi'] },
            { name: "Chăm Sóc Da", keywords: ['kem', 'serum', 'toner', 'sữa rửa mặt', 'tẩy trang', 'mặt nạ', 'lotion'] },
            { name: "Chăm Sóc Tóc & Cơ Thể", keywords: ['gội', 'xả', 'tắm', 'dưỡng', 'nước hoa', 'body'] }
        ]
    },
    {
        parent: "BÁCH HÓA ONLINE",
        children: [
            { name: "Đồ Ăn Vặt", keywords: ['bánh', 'kẹo', 'snack', 'khô', 'cơm cháy', 'rong biển', 'đậu'] },
            { name: "Đồ Uống & Sữa", keywords: ['trà', 'sữa', 'cà phê', 'nước', 'ngọt', 'gas'] },
            { name: "Thực Phẩm Nấu Ăn", keywords: ['mì', 'miến', 'phở', 'gia vị', 'sốt', 'dầu'] }
        ]
    },
    {
        parent: "QUÀ HANDMADE",
        children: [
            { name: "Nguyên Liệu DIY", keywords: ['len', 'sợi', 'kẽm', 'nhung', 'charm', 'hạt', 'vải'] },
            { name: "Thành Phẩm Handmade", keywords: ['handmade', 'thủ công', 'móc khóa', 'thú bông', 'hoa len', 'tô tượng'] }
        ]
    },
    {
        parent: "QUÀ CAO CẤP",
        children: [
            { name: "Set Quà Tặng", keywords: ['set quà', 'hộp quà', 'gift', 'quà tặng'] },
            { name: "Sức Khỏe & Tổ Yến", keywords: ['yến', 'sâm', 'đông trùng', 'thực phẩm chức năng'] }
        ]
    }
];
function detectCategory(name) {
    const lowerName = name.toLowerCase();
    for (const group of CATEGORY_TREE) {
        for (const child of group.children) {
            if (child.keywords.some(k => lowerName.includes(k))) {
                return { parentName: group.parent, childName: child.name };
            }
        }
    }
    return { parentName: "Sản Phẩm Khác", childName: "Chưa Phân Loại" };
}
function cleanPrice(rawPrice) {
    if (!rawPrice)
        return 0;
    const cleanString = rawPrice.replace(/[^\d]/g, '');
    let price = parseInt(cleanString, 10);
    if (price > 0 && price < 10000)
        price = price * 1000;
    return price;
}
function parseSalesCount(rawSales) {
    if (!rawSales)
        return 0;
    const match = rawSales.toLowerCase().match(/([\d,\.]+)(k?)/);
    if (!match)
        return 0;
    let num = parseFloat(match[1].replace(',', '.'));
    if (match[2] === 'k')
        num = num * 1000;
    return Math.floor(num);
}
function generateSlug(name) {
    return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, '-').replace(/[^\w-]+/g, '') + '-' + Date.now() + Math.floor(Math.random() * 9999);
}
function generateCatSlug(name) {
    return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, '-').replace(/[^\w-]+/g, '');
}
async function processSingleFile(fullPath, fileName, sellerId, categoryMap) {
    return new Promise((resolve, reject) => {
        const results = [];
        console.log(`📂 Đang đọc file: ${fileName}...`);
        fs.createReadStream(fullPath)
            .pipe(csv({ headers: false }))
            .on('data', (data) => results.push(data))
            .on('end', async () => {
            let count = 0;
            for (const row of results) {
                try {
                    const imageUrl = row[1];
                    const name = row[4];
                    const rawPrice = row[6];
                    const rawSales = row[7];
                    if (!name || name.length < 5 || !rawPrice)
                        continue;
                    const { parentName, childName } = detectCategory(name);
                    const mapKey = `${parentName}|${childName}`;
                    let childCategoryId = categoryMap.get(mapKey);
                    if (!childCategoryId) {
                        const parentSlug = generateCatSlug(parentName);
                        const parentCat = await prisma.category.upsert({
                            where: { slug: parentSlug },
                            update: {},
                            create: { name: parentName, slug: parentSlug, parentId: null, image: imageUrl },
                        });
                        const childSlug = generateCatSlug(childName);
                        const childCat = await prisma.category.upsert({
                            where: { slug: childSlug },
                            update: {},
                            create: {
                                name: childName,
                                slug: childSlug,
                                parentId: parentCat.id,
                                image: imageUrl
                            },
                        });
                        childCategoryId = childCat.id;
                        categoryMap.set(mapKey, childCategoryId);
                    }
                    const price = cleanPrice(rawPrice);
                    const salesCount = parseSalesCount(rawSales);
                    const rating = (Math.random() * (5.0 - 4.2) + 4.2).toFixed(1);
                    await prisma.product.create({
                        data: {
                            name: name.trim(),
                            slug: generateSlug(name),
                            description: `Mô tả: ${name}. ${rawSales || ''}.`,
                            price: price,
                            originalPrice: price * 1.25,
                            stock: Math.floor(Math.random() * 300) + 10,
                            salesCount: salesCount,
                            rating: parseFloat(rating),
                            images: imageUrl ? [imageUrl] : [],
                            sellerId: sellerId,
                            categoryId: childCategoryId,
                            attributes: { origin: "Việt Nam", brand: "No Brand" }
                        },
                    });
                    count++;
                }
                catch (error) {
                }
            }
            console.log(`   -> ✅ Đã xong file ${fileName}: ${count} sản phẩm.`);
            resolve();
        })
            .on('error', (err) => {
            console.error(`   -> ❌ Lỗi file ${fileName}:`, err);
            resolve();
        });
    });
}
async function importShopeeData() {
    console.log('🗑️  Clean Database (Xóa sạch làm lại)...');
    await prisma.cartItem.deleteMany({});
    await prisma.orderItem.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
    console.log('✅ Đã xoá sạch dữ liệu cũ.');
    const defaultSeller = await prisma.user.upsert({
        where: { email: 'seller@shopee.vn' },
        update: {},
        create: {
            email: 'seller@shopee.vn', name: 'Official Store', password: 'password123', role: 'SELLER',
            avatar: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
        },
    });
    const globalCategoryMap = new Map();
    if (!fs.existsSync(IMPORT_DIR)) {
        fs.mkdirSync(IMPORT_DIR);
        console.log(`⚠️ Đã tạo thư mục "data-import". Vui lòng copy file .csv vào và chạy lại!`);
        return;
    }
    const files = fs.readdirSync(IMPORT_DIR).filter(f => f.toLowerCase().endsWith('.csv'));
    if (files.length === 0) {
        console.log(`⚠️ Không tìm thấy file .csv nào trong "data-import".`);
        return;
    }
    console.log(`📦 Tìm thấy ${files.length} file CSV.`);
    for (const fileName of files) {
        const fullPath = path.join(IMPORT_DIR, fileName);
        await processSingleFile(fullPath, fileName, defaultSeller.id, globalCategoryMap);
    }
    console.log(`\n🎉 HOÀN TẤT! Dữ liệu đã được phân loại vào danh mục 2 cấp.`);
    await prisma.$disconnect();
}
importShopeeData().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=import-shopee.js.map