"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const generateSlug = (text) => text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
async function main() {
    console.log('🌱 Bắt đầu nâng cấp danh mục Blog lên 2 cấp (FIXED)...');
    const parentSlugs = {
        CONG_NGHE: 'cong-nghe',
        SAC_DEP: 'sac-dep',
        THOI_TRANG: 'thoi-trang',
        DU_LICH: 'du-lich',
        AM_THUC: 'am-thuc',
        DOI_SONG: 'doi-song',
        SACH: 'sach',
        KHAC: 'khac',
    };
    const parentIds = {};
    for (const [key, slug] of Object.entries(parentSlugs)) {
        const cat = await prisma.blogCategory.findUnique({ where: { slug } });
        if (cat) {
            parentIds[key] = cat.id;
        }
        else {
            console.warn(`⚠️ Không tìm thấy danh mục cha có slug: ${slug}`);
        }
    }
    const moveBySlugs = async (subCatId, blogSlugs) => {
        if (!subCatId)
            return;
        const blogs = await prisma.blogPost.findMany({
            where: { slug: { in: blogSlugs } },
            select: { id: true }
        });
        const foundIds = blogs.map(b => b.id);
        if (foundIds.length > 0) {
            await prisma.blogPost.updateMany({
                where: { id: { in: foundIds } },
                data: { categoryId: subCatId }
            });
            console.log(`   -> Đã chuyển ${foundIds.length} bài vào sub-cat ID: ${subCatId}`);
        }
        else {
            console.log(`   ⚠️ Không tìm thấy bài viết nào khớp với list slug cung cấp.`);
        }
    };
    if (parentIds['CONG_NGHE']) {
        const subTech_Dev = await createSubCategory('Lập trình & AI', parentIds['CONG_NGHE']);
        await moveBySlugs(subTech_Dev.id, [
            '5-ngon-ngu-lap-trinh-dang-hoc-nhat-2026',
            'tri-tue-nhan-tao-ai-nam-2026-xu-huong-va-tac-dong'
        ]);
        const subTech_Review = await createSubCategory('Review Thiết bị', parentIds['CONG_NGHE']);
        await moveBySlugs(subTech_Review.id, [
            'top-5-laptop-gaming-duoi-20-trieu-2024',
            'review-iphone-15-pro-max-sau-6-thang',
            'danh-gia-macbook-pro-m3-max'
        ]);
    }
    if (parentIds['SAC_DEP']) {
        const subBeauty_Skin = await createSubCategory('Chăm sóc da (Skincare)', parentIds['SAC_DEP']);
        await moveBySlugs(subBeauty_Skin.id, [
            'retinol-la-gi-huong-dan-nguoi-moi',
            'quy-trinh-skincare-7-buoc-chuan-han',
            'routine-skincare-cho-da-dau-mun-mua-he'
        ]);
        const subBeauty_Makeup = await createSubCategory('Trang điểm (Makeup)', parentIds['SAC_DEP']);
        await moveBySlugs(subBeauty_Makeup.id, [
            'xu-huong-trang-diem-clean-girl-makeup',
            'cach-chon-mau-son-hop-tone-da'
        ]);
    }
    if (parentIds['THOI_TRANG']) {
        const subFashion_Trend = await createSubCategory('Xu hướng & Phối đồ', parentIds['THOI_TRANG']);
        await moveBySlugs(subFashion_Trend.id, [
            'phoi-do-phong-cach-y2k',
            'phong-cach-thoi-trang-toi-gian-minimalism',
            'phong-cach-minimalism-toi-gian-len-ngoi'
        ]);
        const subFashion_Shoes = await createSubCategory('Giày & Phụ kiện', parentIds['THOI_TRANG']);
        await moveBySlugs(subFashion_Shoes.id, [
            'xu-huong-sneaker-2026-retro-chunky'
        ]);
        const subFashion_Local = await createSubCategory('Local Brand Việt', parentIds['THOI_TRANG']);
        await moveBySlugs(subFashion_Local.id, [
            'local-brand-viet-nam-chat-luong-gia-tien'
        ]);
    }
    if (parentIds['DU_LICH']) {
        const subTravel_VN = await createSubCategory('Điểm đến Việt Nam', parentIds['DU_LICH']);
        await moveBySlugs(subTravel_VN.id, [
            'kham-pha-phu-quoc-hon-dao-ngoc',
            'review-du-lich-ha-giang-cao-nguyen-da'
        ]);
        const subTravel_Tips = await createSubCategory('Cẩm nang vi vu', parentIds['DU_LICH']);
        await moveBySlugs(subTravel_Tips.id, [
            'du-lich-mot-minh-solo-travel-trai-nghiem'
        ]);
    }
    if (parentIds['AM_THUC']) {
        const subFood_Review = await createSubCategory('Review Quán Ngon', parentIds['AM_THUC']);
        await moveBySlugs(subFood_Review.id, [
            'top-5-quan-pho-gia-truyen-ha-noi',
            'van-hoa-ca-phe-viet-nam-via-he-specialty'
        ]);
        const subFood_Cooking = await createSubCategory('Góc Bếp & Công Thức', parentIds['AM_THUC']);
        await moveBySlugs(subFood_Cooking.id, [
            'eat-clean-dung-cach-thuc-don-giam-can',
            'cach-lam-banh-tiramisu-khong-can-lo-nuong'
        ]);
    }
    if (parentIds['DOI_SONG']) {
        const subLife_Growth = await createSubCategory('Phát triển bản thân', parentIds['DOI_SONG']);
        await moveBySlugs(subLife_Growth.id, [
            'review-sach-nha-gia-kim-paulo-coelho',
            'nghe-thuat-giao-tiep-dac-nhan-tam-thoi-dai-so',
            'loi-song-toi-gian-danshari-nguoi-nhat',
            'ky-thuat-pomodoro-tap-trung-sieu-dang',
            'chua-lanh-healing-trao-luu-hay-thiet-yeu'
        ]);
        const subLife_Finance = await createSubCategory('Tài chính cá nhân', parentIds['DOI_SONG']);
        await moveBySlugs(subLife_Finance.id, [
            'quan-ly-tai-chinh-ca-nhan-50-30-20'
        ]);
        const subLife_Love = await createSubCategory('Góc Yêu Thương', parentIds['DOI_SONG']);
        await moveBySlugs(subLife_Love.id, [
            'goi-y-qua-tang-valentine-y-nghia'
        ]);
    }
    if (parentIds['SACH'])
        await deleteCategoryIfEmpty(parentIds['SACH']);
    if (parentIds['KHAC'])
        await deleteCategoryIfEmpty(parentIds['KHAC']);
    console.log('✅ Hoàn tất Seed Data! Blog của bạn đã có cấu trúc 2 cấp chuẩn chỉnh.');
}
async function createSubCategory(name, parentId) {
    const slug = generateSlug(name);
    const category = await prisma.blogCategory.upsert({
        where: { slug: slug },
        update: { parentId: parentId },
        create: {
            name: name,
            slug: slug,
            parentId: parentId,
        },
    });
    console.log(`   + Sub-category created: [${name}]`);
    return category;
}
async function deleteCategoryIfEmpty(categoryId) {
    const count = await prisma.blogPost.count({ where: { categoryId } });
    const childrenCount = await prisma.blogCategory.count({ where: { parentId: categoryId } });
    if (count === 0 && childrenCount === 0) {
        await prisma.blogCategory.delete({ where: { id: categoryId } });
        console.log(`   - Deleted empty category ID: ${categoryId}`);
    }
}
main()
    .catch((e) => {
    console.error('❌ Lỗi khi seed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed-blog-hierarchy.js.map