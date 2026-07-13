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
 * Cập nhật: Lấy thương hiệu trực tiếp từ thông tin của từng sản phẩm thay vì bộ lọc
 */
async function crawlTikiBrands() {
  logger.info('[Tiki] Bắt đầu crawl thương hiệu...');
  // Các Category ID lớn trên Tiki
  const targetCategories = ['1815', '8322', '1520', '4384']; 
  
  for (const catId of targetCategories) {
    try {
      const res = await axios.get(`https://tiki.vn/api/v2/products`, {
        params: { limit: 50, category: catId },
        headers: { 'User-Agent': UA, 'Accept': 'application/json' },
        timeout: 10000,
      });

      // Lấy mảng sản phẩm từ response
      const products = res.data?.data || [];
      const uniqueBrands = new Map();

      // Bóc tách brand từ từng sản phẩm
      for (const product of products) {
        // Tiki có thể lưu tên brand ở product.brand_name hoặc product.brand.name
        const brandName = product?.brand_name || product?.brand?.name;
        const logoUrl = product?.brand?.logo_url || '';

        if (brandName && brandName.toLowerCase() !== 'no brand' && brandName.toLowerCase() !== 'oem') {
          uniqueBrands.set(brandName, { name: brandName, logoUrl });
        }
      }

      logger.info(`[Tiki] Tìm thấy ${uniqueBrands.size} brands trong category ${catId}`);

      for (const [brandName, brandInfo] of uniqueBrands.entries()) {
        const slug = generateSlug(brandName);

        // Upsert vào Database
        await prisma.brand.upsert({
          where: { slug: slug },
          update: {}, 
          create: {
            name: brandName,
            slug: slug,
            logoUrl: brandInfo.logoUrl, // Lấy luôn được logo xịn từ Tiki
            status: 'active',
            description: 'Crawled from Tiki',
          },
        });
      }
    } catch (error: any) {
      logger.error(`[Tiki Error] Lỗi crawl category ${catId}:`, error.message);
    }
    // Nghỉ 2s giữa các request
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

/**
 * CRAWL SHOPEE
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
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

async function main() {
  logger.info('=== START BULK CRAWL BRANDS ===');
  
  // Chạy Tiki (sẽ thành công và có data)
  await crawlTikiBrands();
  
  // TẠM ẨN SHOPEE để tránh lỗi 403 do bị chặn IP VPS
  // await crawlShopeeBrands();
  
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