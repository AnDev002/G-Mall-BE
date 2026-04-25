import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

/**
 * Spec [0018]: Crawl brand từ Shopee/Tiki/Lazada.
 *
 * Workflow: seller paste link sản phẩm Shopee/Tiki -> service trả về thông tin
 * brand (name + image). Seller click "Áp dụng" để auto-fill form đăng SP.
 *
 * Nguồn:
 *  - Tiki:   https://tiki.vn/api/v2/products/<id> (JSON public, hợp tác mềm).
 *  - Shopee: https://shopee.vn/api/v4/item/get?itemid=<i>&shopid=<s>
 *            (cần parse shopid/itemid từ slug-i.<shopid>.<itemid>).
 *  - Lazada: chưa hỗ trợ — datacenter IP bị 403.
 *
 * Caveats:
 *  - 2 nguồn này thay đổi response shape thường xuyên — code defensive (optional chain
 *    + fallback rỗng).
 *  - Có thể bị rate-limit khi seller spam paste link. Nên cache theo URL ở caller
 *    nếu cần (hiện chưa cache).
 *  - Không cố gắng bypass anti-bot (captcha, header obfuscation) — đây là tool
 *    tiện lợi cho seller, không phải scraper khối lượng lớn.
 */
@Injectable()
export class BrandCrawlerService {
  private readonly logger = new Logger(BrandCrawlerService.name);

  // User-Agent giả browser thường để API public chấp nhận.
  // Không phải bypass — đa số public CDN cản UA empty/curl.
  private readonly UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  /**
   * Public method — duyệt URL, dispatch sang handler tương ứng.
   * Trả: { source, name, image, brand, raw } hoặc throw BadRequest nếu không support.
   */
  async crawlByUrl(url: string) {
    if (!url) throw new BadRequestException('Thiếu URL');
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('URL không hợp lệ');
    }

    const host = parsed.hostname.replace(/^www\./, '');

    if (host.endsWith('tiki.vn')) return this.crawlTiki(parsed);
    if (host.endsWith('shopee.vn')) return this.crawlShopee(parsed);
    if (host.endsWith('lazada.vn'))
      throw new BadRequestException('Lazada chưa được hỗ trợ. Vui lòng nhập tay.');

    throw new BadRequestException(
      'Chỉ hỗ trợ link Tiki và Shopee. Vui lòng kiểm tra lại URL.',
    );
  }

  // ---------- TIKI ----------
  private async crawlTiki(url: URL) {
    // Tiki URL pattern: /<slug>-p<productId>.html  hoặc  /api/v2/products/<id>
    // Lấy productId từ -p<digits>.
    const match = url.pathname.match(/-p(\d+)\.html$/);
    if (!match) throw new BadRequestException('Link Tiki không nhận diện được product id');
    const productId = match[1];

    try {
      const res = await axios.get(`https://tiki.vn/api/v2/products/${productId}`, {
        headers: { 'User-Agent': this.UA, Accept: 'application/json' },
        timeout: 8000,
      });
      const d = res.data;
      const brandName = d?.brand?.name || '';
      const brandImage = d?.brand?.logo || '';
      return {
        source: 'TIKI',
        name: d?.name || '',
        image: d?.thumbnail_url || d?.images?.[0]?.large_url || '',
        brand: brandName,
        brandImage,
        category: d?.categories?.name || '',
        description: d?.short_description || '',
        raw: { id: d?.id, slug: d?.url_path },
      };
    } catch (err: any) {
      this.logger.warn(`[Tiki crawl] fail ${productId}: ${err?.message}`);
      throw new BadRequestException(
        'Không lấy được thông tin từ Tiki (có thể link bị xoá hoặc API thay đổi).',
      );
    }
  }

  // ---------- SHOPEE ----------
  private async crawlShopee(url: URL) {
    // Shopee URL pattern:
    //   /<slug>-i.<shopid>.<itemid>             (canonical)
    //   /product/<shopid>/<itemid>              (deeplink)
    let shopId: string | undefined;
    let itemId: string | undefined;

    const pat1 = url.pathname.match(/-i\.(\d+)\.(\d+)$/);
    const pat2 = url.pathname.match(/^\/product\/(\d+)\/(\d+)$/);
    if (pat1) {
      shopId = pat1[1];
      itemId = pat1[2];
    } else if (pat2) {
      shopId = pat2[1];
      itemId = pat2[2];
    } else {
      throw new BadRequestException('Link Shopee không nhận diện được shopId/itemId');
    }

    try {
      const res = await axios.get('https://shopee.vn/api/v4/item/get', {
        params: { itemid: itemId, shopid: shopId },
        headers: {
          'User-Agent': this.UA,
          Accept: 'application/json',
          // Shopee API hay refuse nếu thiếu af-ac-enc-dat header — thử bỏ để API public-ish.
          Referer: `https://shopee.vn/-i.${shopId}.${itemId}`,
        },
        timeout: 8000,
      });
      const d = res.data?.data;
      if (!d) throw new Error('Empty response from Shopee');
      // Brand trong Shopee nằm trong attributes hoặc tier_variations
      let brandName = '';
      if (Array.isArray(d.attributes)) {
        const brandAttr = d.attributes.find((a: any) =>
          /brand|thương hiệu/i.test(a?.name || ''),
        );
        brandName = brandAttr?.value || '';
      }
      const firstImage =
        d.image && `https://cf.shopee.vn/file/${d.image}`;

      return {
        source: 'SHOPEE',
        name: d.name || '',
        image: firstImage,
        brand: brandName,
        brandImage: '',
        category:
          (Array.isArray(d.categories) && d.categories[d.categories.length - 1]?.display_name) || '',
        description: d.description || '',
        raw: { itemId, shopId },
      };
    } catch (err: any) {
      this.logger.warn(`[Shopee crawl] fail ${shopId}/${itemId}: ${err?.message}`);
      throw new BadRequestException(
        'Không lấy được thông tin từ Shopee. Có thể bị anti-bot — paste link khác hoặc nhập tay.',
      );
    }
  }
}
