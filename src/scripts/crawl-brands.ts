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
 * CRAWL TIKI + LOGO
 */
async function crawlTikiBrands() {
  logger.info('[Tiki] Bắt đầu crawl thương hiệu và logo...');
  const targetCategories = ['1815', '8322', '1520', '4384']; 
  
  for (const catId of targetCategories) {
    try {
      const res = await axios.get(`https://tiki.vn/api/v2/products`, {
        params: { limit: 50, category: catId },
        headers: { 'User-Agent': UA, 'Accept': 'application/json' },
        timeout: 10000,
      });

      const products = res.data?.data || [];
      const uniqueBrands = new Map();

      for (const product of products) {
        const brandName = product?.brand_name || product?.brand?.name;
        
        // Logic lấy logo: Ưu tiên logo của hãng -> Nếu không có thì lấy ảnh thumbnail của sản phẩm
        const logoUrl = product?.brand?.logo_url || product?.brand?.logo || product?.thumbnail_url || '';

        if (brandName && brandName.toLowerCase() !== 'no brand' && brandName.toLowerCase() !== 'oem') {
          // Lưu vào Map để lọc trùng lặp (lấy logo của sản phẩm đầu tiên tìm thấy)
          if (!uniqueBrands.has(brandName)) {
            uniqueBrands.set(brandName, { name: brandName, logoUrl });
          }
        }
      }

      logger.info(`[Tiki] Tìm thấy ${uniqueBrands.size} brands trong category ${catId}`);

      for (const [brandName, brandInfo] of uniqueBrands.entries()) {
        const slug = generateSlug(brandName);

        // Upsert vào Database (Cập nhật logo nếu thương hiệu đã tồn tại)
        await prisma.brand.upsert({
          where: { slug: slug },
          update: {
            // Chỉ update logoUrl nếu brandInfo có logo và khác rỗng
            ...(brandInfo.logoUrl ? { logoUrl: brandInfo.logoUrl } : {})
          }, 
          create: {
            name: brandName,
            slug: slug,
            logoUrl: brandInfo.logoUrl,
            status: 'active',
            description: 'Crawled from Tiki',
          },
        });
      }
    } catch (error: any) {
      logger.error(`[Tiki Error] Lỗi crawl category ${catId}:`, error.message);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

/**
 * CRAWL SHOPEE + LOGO (Dùng ảnh sản phẩm làm đại diện)
 */
async function crawlShopeeBrands() {
  logger.info('[Shopee] Bắt đầu crawl thương hiệu và logo...');
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
          if (!uniqueBrands.has(item.brand)) {
            // Shopee list không trả về brand logo, ta lấy ảnh sản phẩm map với CDN Shopee làm đại diện
            const logoUrl = item.image ? `https://cf.shopee.vn/file/${item.image}` : '';
            uniqueBrands.set(item.brand, { name: item.brand, logoUrl });
          }
        }
      });

      logger.info(`[Shopee] Tìm thấy ${uniqueBrands.size} brands cho từ khóa "${kw}"`);

      for (const [brandName, brandInfo] of uniqueBrands.entries()) {
        const slug = generateSlug(brandName);
        await prisma.brand.upsert({
          where: { slug: slug },
          update: {
            ...(brandInfo.logoUrl ? { logoUrl: brandInfo.logoUrl } : {})
          },
          create: {
            name: brandName,
            slug: slug,
            logoUrl: brandInfo.logoUrl,
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
  
  await crawlTikiBrands();
  
  // Lưu ý: Đã bỏ comment Shopee. Nhưng nếu chạy trên VPS bị lỗi 403 Forbidden 
  // thì bạn lại thêm // vào trước dòng dưới đây nhé!
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