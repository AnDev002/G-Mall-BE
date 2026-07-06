"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var BrandCrawlerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrandCrawlerService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
let BrandCrawlerService = BrandCrawlerService_1 = class BrandCrawlerService {
    logger = new common_1.Logger(BrandCrawlerService_1.name);
    UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    async crawlByUrl(url) {
        if (!url)
            throw new common_1.BadRequestException('Thiếu URL');
        let parsed;
        try {
            parsed = new URL(url);
        }
        catch {
            throw new common_1.BadRequestException('URL không hợp lệ');
        }
        const host = parsed.hostname.replace(/^www\./, '');
        if (host.endsWith('tiki.vn'))
            return this.crawlTiki(parsed);
        if (host.endsWith('shopee.vn'))
            return this.crawlShopee(parsed);
        if (host.endsWith('lazada.vn'))
            throw new common_1.BadRequestException('Lazada chưa được hỗ trợ. Vui lòng nhập tay.');
        throw new common_1.BadRequestException('Chỉ hỗ trợ link Tiki và Shopee. Vui lòng kiểm tra lại URL.');
    }
    async crawlTiki(url) {
        const match = url.pathname.match(/-p(\d+)\.html$/);
        if (!match)
            throw new common_1.BadRequestException('Link Tiki không nhận diện được product id');
        const productId = match[1];
        try {
            const res = await axios_1.default.get(`https://tiki.vn/api/v2/products/${productId}`, {
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
        }
        catch (err) {
            this.logger.warn(`[Tiki crawl] fail ${productId}: ${err?.message}`);
            throw new common_1.BadRequestException('Không lấy được thông tin từ Tiki (có thể link bị xoá hoặc API thay đổi).');
        }
    }
    async crawlShopee(url) {
        let shopId;
        let itemId;
        const pat1 = url.pathname.match(/-i\.(\d+)\.(\d+)$/);
        const pat2 = url.pathname.match(/^\/product\/(\d+)\/(\d+)$/);
        if (pat1) {
            shopId = pat1[1];
            itemId = pat1[2];
        }
        else if (pat2) {
            shopId = pat2[1];
            itemId = pat2[2];
        }
        else {
            throw new common_1.BadRequestException('Link Shopee không nhận diện được shopId/itemId');
        }
        try {
            const res = await axios_1.default.get('https://shopee.vn/api/v4/item/get', {
                params: { itemid: itemId, shopid: shopId },
                headers: {
                    'User-Agent': this.UA,
                    Accept: 'application/json',
                    Referer: `https://shopee.vn/-i.${shopId}.${itemId}`,
                },
                timeout: 8000,
            });
            const d = res.data?.data;
            if (!d)
                throw new Error('Empty response from Shopee');
            let brandName = '';
            if (Array.isArray(d.attributes)) {
                const brandAttr = d.attributes.find((a) => /brand|thương hiệu/i.test(a?.name || ''));
                brandName = brandAttr?.value || '';
            }
            const firstImage = d.image && `https://cf.shopee.vn/file/${d.image}`;
            return {
                source: 'SHOPEE',
                name: d.name || '',
                image: firstImage,
                brand: brandName,
                brandImage: '',
                category: (Array.isArray(d.categories) && d.categories[d.categories.length - 1]?.display_name) || '',
                description: d.description || '',
                raw: { itemId, shopId },
            };
        }
        catch (err) {
            this.logger.warn(`[Shopee crawl] fail ${shopId}/${itemId}: ${err?.message}`);
            throw new common_1.BadRequestException('Không lấy được thông tin từ Shopee. Có thể bị anti-bot — paste link khác hoặc nhập tay.');
        }
    }
};
exports.BrandCrawlerService = BrandCrawlerService;
exports.BrandCrawlerService = BrandCrawlerService = BrandCrawlerService_1 = __decorate([
    (0, common_1.Injectable)()
], BrandCrawlerService);
//# sourceMappingURL=brand-crawler.service.js.map