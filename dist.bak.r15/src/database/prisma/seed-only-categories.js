"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const slugify_1 = __importDefault(require("slugify"));
const prisma = new client_1.PrismaClient();
const createSlug = (name) => (0, slugify_1.default)(name, { lower: true, locale: 'vi', remove: /[*+~.()'"!:@]/g }) + '-' + Date.now();
const CATEGORY_TREES = [
    {
        name: "Sức khỏe & Sắc đẹp",
        image: "https://down-vn.img.susercontent.com/file/ef1f336ecc6f97b790d5aae9916dcb72_tn",
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
        image: "https://down-vn.img.susercontent.com/file/31234a27876fb89cd522d7e3db1ba5ca_tn",
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
        image: "https://down-vn.img.susercontent.com/file/687f3967b7c2fe6a134a2c11894eea4b_tn",
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
async function main() {
    console.log('🚀 Bắt đầu thêm danh mục 4 cấp...');
    console.log('⚠️  Lưu ý: Script này KHÔNG xóa dữ liệu cũ để bảo toàn sản phẩm của bạn.');
    let count = 0;
    for (const l1 of CATEGORY_TREES) {
        const cat1 = await prisma.category.create({
            data: {
                name: l1.name,
                slug: createSlug(l1.name),
                image: l1.image
            }
        });
        count++;
        if (l1.children) {
            for (const l2 of l1.children) {
                const cat2 = await prisma.category.create({
                    data: {
                        name: l2.name,
                        slug: createSlug(l2.name),
                        parentId: cat1.id
                    }
                });
                count++;
                if (l2.children) {
                    for (const l3 of l2.children) {
                        const cat3 = await prisma.category.create({
                            data: {
                                name: l3.name,
                                slug: createSlug(l3.name),
                                parentId: cat2.id
                            }
                        });
                        count++;
                        if (l3.children) {
                            for (const l4Name of l3.children) {
                                await prisma.category.create({
                                    data: {
                                        name: l4Name,
                                        slug: createSlug(l4Name),
                                        parentId: cat3.id
                                    }
                                });
                                count++;
                            }
                        }
                    }
                }
            }
        }
    }
    console.log(`✅ Đã thêm thành công ${count} danh mục mới!`);
}
main()
    .catch((e) => {
    console.error("❌ Lỗi khi seed:", e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed-only-categories.js.map