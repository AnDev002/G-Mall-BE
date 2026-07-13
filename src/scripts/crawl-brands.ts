import { PrismaClient } from '@prisma/client';
import axios from 'axios';

// Khởi tạo Prisma độc lập cho script
const prisma = new PrismaClient();
const logger = console;

// Sử dụng lại User-Agent từ service của bạn để giảm tỷ lệ bị block
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Helper tạo slug từ tên brand
function generateSlug(name: string) {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

/**
 * CRAWL TIKI
 * Chiến thuật: Quét qua API danh sách sản phẩm theo Category phổ biến để bóc tách Brand
 */
async function crawlTikiBrands() {
  logger.info('[Tiki] Bắt đầu crawl thương hiệu...');
  // Các Category ID lớn trên Tiki (VD: 1815 là Thiết bị số, 8322 là Nhà cửa, 1520 là Làm đẹp...)
  const targetCategories = ['1815', '8322', '1520', '4384']; 
  
  for (const catId of targetCategories) {
    try {
      // Gọi API danh sách sản phẩm của Tiki để lấy bộ lọc Brands
      const res = await axios.get(`https://tiki.vn/api/v2/products`, {
        params: { limit: 50, category: catId },
        headers: { 'User-Agent': UA, 'Accept': 'application/json' },
        timeout: 10000,
      });

      // Tiki thường trả về danh sách brands trong filters
      const brandFilter = res.data?.filters?.find((f: any) => f.query_name === 'brand');
      if (!brandFilter || !brandFilter.values) continue;

      logger.info(`[Tiki] Tìm thấy ${brandFilter.values.length} brands trong category ${catId}`);

      for (const b of brandFilter.values) {
        if (!b.display_value) continue;
        const brandName = b.display_value;
        const slug = generateSlug(brandName);

        // Upsert vào Database
        await prisma.brand.upsert({
          where: { slug: slug },
          update: {}, // Nếu có rồi thì bỏ qua (hoặc cập nhật productCount nếu muốn)
          create: {
            name: brandName,
            slug: slug,
            logoUrl: '', // Tiki list api thường không kèm logo, có thể crawl chi tiết sau
            status: 'active',
            description: 'Crawled from Tiki',
          },
        });
      }
    } catch (error: any) {
      logger.error(`[Tiki Error] Lỗi crawl category ${catId}:`, error.message);
    }
    // Nghỉ 2s giữa các request để tránh rate limit
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

/**
 * CRAWL SHOPEE
 * Lưu ý: Như bạn đã ghi chú trong code, Shopee chặn rất rát (af-ac-enc-dat header).
 * Ở quy mô script, ta dùng Search API nhưng set rate limit thật chậm.
 */
async function crawlShopeeBrands() {
  logger.info('[Shopee] Bắt đầu crawl thương hiệu...');
  const keywords = ['điện thoại', 'mỹ phẩm', 'thời trang'];

  for (const kw of keywords) {
    try {
      const res = await axios.get('https://shopee.vn/api/v4/search/search_items', {
        params: { by: 'relevancy', keyword: kw, limit: 60, newest: 0, order: 'desc', page_type: 'search', scenario: 'PAGE_GLOBAL_SEARCH', version: 2 },
        headers: { 'User-Agent': UA, 'Accept': 'application/json' },
        timeout: 10000,
      });

      const items = res.data?.items || [];
      const uniqueBrands = new Map();

      items.forEach((itemWrapper: any) => {
        const item = itemWrapper.item_basic;
        if (item?.brand && item.brand !== 'No Brand' && item.brand !== 'OEM') {
          uniqueBrands.set(item.brand, item);
        }
      });

      logger.info(`[Shopee] Tìm thấy ${uniqueBrands.size} brands cho từ khóa "${kw}"`);

      for (const [brandName, item] of uniqueBrands.entries()) {
        const slug = generateSlug(brandName);
        await prisma.brand.upsert({
          where: { slug: slug },
          update: {},
          create: {
            name: brandName,
            slug: slug,
            status: 'active',
            description: 'Crawled from Shopee',
          },
        });
      }
    } catch (error: any) {
      logger.error(`[Shopee Error] Lỗi crawl từ khóa ${kw}:`, error.message);
    }
    // Nghỉ 5s để tránh Shopee ban IP Datacenter
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

async function main() {
  logger.info('=== START BULK CRAWL BRANDS ===');
  await crawlTikiBrands();
  await crawlShopeeBrands();
  logger.info('=== CRAWL COMPLETE ===');
}

main()
  .catch((e) => {
    logger.error('Fatal Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });