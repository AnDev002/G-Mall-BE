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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const client_s3_1 = require("@aws-sdk/client-s3");
const axios_1 = __importDefault(require("axios"));
const mime = __importStar(require("mime-types"));
const uuid_1 = require("uuid");
const dotenv = __importStar(require("dotenv"));
const ioredis_1 = __importDefault(require("ioredis"));
dotenv.config();
const prisma = new client_1.PrismaClient();
const redis = new ioredis_1.default({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
});
const s3Client = new client_s3_1.S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
    forcePathStyle: true,
});
const BUCKET_NAME = process.env.R2_BUCKET_NAME || '';
const PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN || '';
const IMPORT_DIR = path.join(__dirname, '../../../data-import');
async function uploadImageToR2(sourceUrl) {
    try {
        if (!sourceUrl || !sourceUrl.startsWith('http'))
            return '';
        const response = await axios_1.default.get(sourceUrl, { responseType: 'arraybuffer', timeout: 10000 });
        const buffer = Buffer.from(response.data, 'binary');
        const contentType = response.headers['content-type'] || 'image/jpeg';
        const extension = mime.extension(contentType) || 'jpg';
        const fileName = `products/shopee-${(0, uuid_1.v4)()}.${extension}`;
        await s3Client.send(new client_s3_1.PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: fileName,
            Body: buffer,
            ContentType: contentType,
        }));
        return `${PUBLIC_DOMAIN}/${fileName}`;
    }
    catch (error) {
        console.error(`   ❌ Lỗi upload ảnh: ${sourceUrl.substring(0, 30)}...`);
        return sourceUrl;
    }
}
const HERO_SLIDES = [
    {
        location: "HERO_MAIN",
        src: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=1600",
        alt: "Thời trang sành điệu",
        title: "Phong Cách Mới 2024",
        description: "Khám phá bộ sưu tập thời trang Thu Đông mới nhất. Đẳng cấp trong từng đường nét.",
        ctaLabel: "Mua Ngay",
        ctaLink: "/shop/fashion",
        theme: "dark",
        order: 1
    },
    {
        location: "HERO_MAIN",
        src: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=1600",
        alt: "Công nghệ hiện đại",
        title: "Công Nghệ Đỉnh Cao",
        description: "Trải nghiệm những sản phẩm công nghệ mới nhất với ưu đãi lên đến 40%.",
        ctaLabel: "Xem Chi Tiết",
        ctaLink: "/shop/tech",
        theme: "light",
        order: 2
    },
    {
        location: "HERO_MAIN",
        src: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&q=80&w=1600",
        alt: "Siêu sale cuối năm",
        title: "Sale Sập Sàn",
        description: "Cơ hội săn hàng hiệu giá hời. Hàng ngàn voucher đang chờ bạn.",
        ctaLabel: "Săn Deal Ngay",
        ctaLink: "/shop/sale",
        theme: "dark",
        order: 3
    }
];
const SUB_HERO_SLIDES = [
    { src: "https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?auto=format&fit=crop&q=80&w=600", alt: "Trang sức cao cấp", title: "Trang Sức" },
    { src: "https://images.unsplash.com/photo-1617220828111-eb241202a929?auto=format&fit=crop&q=80&w=600", alt: "Mỹ phẩm chính hãng", title: "Mỹ Phẩm" },
    { src: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&q=80&w=600", alt: "Túi xách thời thượng", title: "Túi Xách" },
    { src: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=600", alt: "Giày hiệu năng động", title: "Giày Dép" },
].map((item, idx) => ({ ...item, location: "HERO_SUB", order: idx, ctaLink: "/shop" }));
const createSubItems = (prefix, count) => {
    return Array.from({ length: count }).map((_, i) => ({
        id: `${prefix}-sub-${i}`,
        name: `${prefix} Loại ${i + 1}`,
        slug: `${prefix}-loai-${i + 1}`,
        children: Array.from({ length: 8 }).map((_, j) => ({
            id: `${prefix}-item-${i}-${j}`,
            name: `${prefix} Sản phẩm ${j + 1}`,
            slug: `${prefix}-san-pham-${j + 1}`,
        })),
    }));
};
const FULL_CATEGORIES = [
    { id: 'dt', name: 'Điện thoại & Phụ kiện', slug: 'dien-thoai', children: createSubItems('Điện thoại', 12) },
    { id: 'mt', name: 'Máy tính & Laptop', slug: 'may-tinh', children: createSubItems('Laptop', 10) },
    { id: 'tt-nam', name: 'Thời Trang Nam', slug: 'thoi-trang-nam', children: createSubItems('Nam', 15) },
    { id: 'tt-nu', name: 'Thời Trang Nữ', slug: 'thoi-trang-nu', children: createSubItems('Nữ', 15) },
    { id: 'me-be', name: 'Mẹ & Bé', slug: 'me-be', children: createSubItems('Mẹ Bé', 12) },
];
const RECIPIENT_DATA = [
    {
        groupName: "Cho Phụ Nữ",
        items: [
            { title: "Mẹ & Bà", links: ["Quà tặng Mẹ", "Quà tặng Bà", "Mẹ chồng/Mẹ vợ", "Phụ nữ trung niên"] },
            { title: "Người Yêu & Vợ", links: ["Bạn gái mới quen", "Vợ yêu", "Vợ bầu", "Cầu hôn & Tỏ tình"] },
        ],
    },
    {
        groupName: "Cho Nam Giới",
        items: [
            { title: "Bố & Ông", links: ["Quà tặng Bố", "Quà tặng Ông", "Bố chồng/Bố vợ"] },
            { title: "Người Yêu & Chồng", links: ["Bạn trai", "Chồng yêu", "Quà kỷ niệm"] },
        ],
    },
];
const OCCASION_DATA = [
    {
        groupName: "Ngày Lễ Trong Năm",
        items: [
            { title: "Dịp Đầu Năm", links: ["Tết Nguyên Đán", "Tết Dương Lịch", "Lễ Tình Nhân (14/2)"] },
            { title: "Dịp Quốc Tế", links: ["Quốc tế Phụ nữ (8/3)", "Ngày của Mẹ"] },
        ],
    },
];
const BUSINESS_GIFT_DATA = [
    {
        groupName: "Quà Tặng Vinh Danh",
        items: [
            { title: "Biểu Trưng", links: ["Cúp pha lê", "Cúp kim loại", "Huy chương"] },
        ],
    },
];
const FOOTER_LINKS = {
    about: {
        title: "Về chúng tôi",
        links: [
            { label: "Giới thiệu GMall", href: "/about" },
            { label: "Tuyển dụng", href: "/careers" },
        ],
    },
    support: {
        title: "Hỗ trợ khách hàng",
        links: [
            { label: "Hướng dẫn mua hàng", href: "/guide" },
            { label: "Phương thức thanh toán", href: "/payment-policy" },
        ],
    },
};
async function seedContent() {
    console.log('🌱 Seeding Banners & System Config...');
    const existingBanners = await prisma.banner.count();
    if (existingBanners === 0) {
        for (const slide of [...HERO_SLIDES, ...SUB_HERO_SLIDES]) {
            await prisma.banner.create({ data: slide });
        }
    }
    const configs = [
        { key: 'HEADER_CATEGORIES', value: FULL_CATEGORIES, desc: 'Mega Menu Danh Mục' },
        { key: 'HEADER_RECIPIENT', value: RECIPIENT_DATA, desc: 'Menu Người Nhận' },
        { key: 'HEADER_OCCASION', value: OCCASION_DATA, desc: 'Menu Nhân Dịp' },
        { key: 'HEADER_BUSINESS', value: BUSINESS_GIFT_DATA, desc: 'Menu Quà Doanh Nghiệp' },
        { key: 'FOOTER_DATA', value: FOOTER_LINKS, desc: 'Liên kết Footer' }
    ];
    for (const conf of configs) {
        await prisma.systemConfig.upsert({
            where: { key: conf.key },
            update: {},
            create: {
                key: conf.key,
                value: conf.value,
                description: conf.desc
            }
        });
    }
}
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
    return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, '-').replace(/[^\w-]+/g, '') + '-' + Date.now() + Math.floor(Math.random() * 999);
}
function generateCatSlug(name) {
    return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, '-').replace(/[^\w-]+/g, '');
}
async function processSingleFile(fullPath, fileName, sellerId, categoryMap) {
    return new Promise((resolve, reject) => {
        const results = [];
        console.log(`📂 Đang đọc file: ${fileName}...`);
        fs.createReadStream(fullPath)
            .pipe((0, csv_parser_1.default)({ headers: false }))
            .on('data', (data) => results.push(data))
            .on('end', async () => {
            let count = 0;
            for (const row of results) {
                try {
                    const rawImageUrl = row[1];
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
                            create: { name: parentName, slug: parentSlug, parentId: null },
                        });
                        const childSlug = generateCatSlug(childName);
                        const childCat = await prisma.category.upsert({
                            where: { slug: childSlug },
                            update: {},
                            create: {
                                name: childName,
                                slug: childSlug,
                                parentId: parentCat.id,
                            },
                        });
                        childCategoryId = childCat.id;
                        categoryMap.set(mapKey, childCategoryId);
                    }
                    let finalImageUrl = rawImageUrl;
                    if (rawImageUrl && rawImageUrl.startsWith('http')) {
                        console.log(`   ⬆️ Uploading: ${name.substring(0, 20)}...`);
                        finalImageUrl = await uploadImageToR2(rawImageUrl);
                    }
                    const price = cleanPrice(rawPrice);
                    const salesCount = parseSalesCount(rawSales);
                    const rating = (Math.random() * (5.0 - 4.2) + 4.2).toFixed(1);
                    await prisma.product.create({
                        data: {
                            name: name.trim(),
                            slug: generateSlug(name),
                            description: `Mô tả: ${name}. ${rawSales || ''}. Hàng chính hãng, chất lượng cao.`,
                            price: price,
                            originalPrice: price * 1.25,
                            stock: Math.floor(Math.random() * 300) + 10,
                            salesCount: salesCount,
                            rating: parseFloat(rating),
                            images: finalImageUrl ? [{ url: finalImageUrl }] : [],
                            sellerId: sellerId,
                            categoryId: childCategoryId,
                            attributes: JSON.stringify({ origin: "Việt Nam", brand: "No Brand" }),
                            status: 'ACTIVE'
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
async function main() {
    console.log('🚀 Bắt đầu quá trình Import & Upload R2...');
    await seedContent();
    console.log(`\n🎉 HOÀN TẤT! Seed dữ liệu danh mục.`);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
    redis.disconnect();
});
//# sourceMappingURL=seed.js.map