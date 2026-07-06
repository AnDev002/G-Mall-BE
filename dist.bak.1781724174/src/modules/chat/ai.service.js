"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var AiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const openai_1 = __importDefault(require("openai"));
let AiService = AiService_1 = class AiService {
    prisma;
    configService;
    openai;
    logger = new common_1.Logger(AiService_1.name);
    responseCache = new Map();
    GIFT_DICTIONARY = [
        { keys: ['sinh nhật', 'sn', 'birthday'], target: 'sinh nhật' },
        { keys: ['kỷ niệm', 'anniversary'], target: 'kỷ niệm' },
        { keys: ['bạn gái', 'người yêu', 'vợ', 'nữ'], target: 'nữ' },
        { keys: ['bạn trai', 'chồng', 'nam'], target: 'nam' },
        { keys: ['mẹ', 'u', 'trung niên'], target: 'mẹ' },
        { keys: ['trang trí', 'decor'], target: 'decor' },
        { keys: ['gấu', 'thú bông'], target: 'gấu' },
        { keys: ['hoa', 'bó'], target: 'hoa' },
        { keys: ['son', 'mỹ phẩm'], target: 'son' }
    ];
    constructor(prisma, configService) {
        this.prisma = prisma;
        this.configService = configService;
        const apiKey = this.configService.get('OPENAI_API_KEY');
        if (apiKey) {
            this.openai = new openai_1.default({ apiKey });
        }
        else {
            this.logger.warn('OPENAI_API_KEY chưa set — route AI sẽ báo lỗi tới khi cấu hình');
            this.openai = null;
        }
    }
    async onModuleInit() { }
    async chat(prompt) {
        try {
            const completion = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7,
            });
            return completion.choices[0].message.content || "Xin lỗi, tôi không thể tư vấn lúc này.";
        }
        catch (error) {
            this.logger.error(`OpenAI Chat Error: ${error.message}`);
            return "Hệ thống tư vấn đang bận, vui lòng thử lại sau.";
        }
    }
    async executeProductSearch(searchTerms, minPrice, maxPrice) {
        let keywords = searchTerms.flatMap(t => t.split(' ')).filter(t => t.length > 2);
        const stopWords = ['cho', 'tặng', 'mua', 'cần', 'là', 'của', 'những', 'cái'];
        keywords = keywords.filter(k => !stopWords.includes(k.toLowerCase()));
        if (keywords.length === 0)
            keywords = searchTerms;
        this.logger.debug(`🔍 Searching DB for keywords: [${keywords.join(', ')}]`);
        const conditions = keywords.map(term => ({
            OR: [
                { name: { contains: term } },
                { description: { contains: term } }
            ]
        }));
        try {
            let products = await this.prisma.product.findMany({
                where: {
                    AND: [
                        { OR: conditions },
                        minPrice ? { price: { gte: minPrice } } : {},
                        maxPrice ? { price: { lte: maxPrice } } : {},
                        { stock: { gt: 0 } }
                    ]
                },
                take: 6,
                orderBy: { salesCount: 'desc' },
                select: { id: true, name: true, price: true, images: true, rating: true, slug: true }
            });
            if (products.length === 0) {
                products = await this.prisma.product.findMany({
                    where: { stock: { gt: 0 } },
                    take: 4,
                    orderBy: { salesCount: 'desc' },
                    select: { id: true, name: true, price: true, images: true, rating: true, slug: true }
                });
            }
            return products.map(p => {
                const priceNum = Number(p.price);
                let imageUrl = '';
                if (Array.isArray(p.images) && p.images.length > 0) {
                    const first = p.images[0];
                    imageUrl = typeof first === 'string' ? first : first?.url || '';
                }
                return {
                    id: p.id,
                    image: imageUrl,
                    title: p.name,
                    price: priceNum,
                    rating: p.rating || 5,
                    slug: p.slug || ''
                };
            });
        }
        catch (e) {
            this.logger.error(`DB Search Error: ${e.message}`);
            return [];
        }
    }
    async getAiResponse(userId, userMessage, historyMessages = []) {
        const cleanMsg = userMessage.trim();
        const cacheKey = `${userId}:${cleanMsg.toLowerCase()}`;
        const cached = this.responseCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < 1000 * 60 * 5)) {
            return cached.data;
        }
        let aiResponse = null;
        if (this.configService.get('OPENAI_API_KEY')) {
            aiResponse = await this.tryCallAi(cleanMsg, historyMessages);
        }
        if (!aiResponse) {
            aiResponse = await this.fallbackRuleBased(cleanMsg);
        }
        this.responseCache.set(cacheKey, { data: aiResponse, timestamp: Date.now() });
        return aiResponse;
    }
    async tryCallAi(msg, history) {
        const systemPrompt = `
        Bạn là "Chuyên gia Tư vấn Quà tặng Cao cấp" của GMall.
        Trả về JSON: { "reply": "...", "searchParams": {...}, "options": [], "searchSuggestions": [] }
      `;
        try {
            const safeHistory = (Array.isArray(history) ? history : []).slice(-20);
            const messages = [
                { role: "system", content: systemPrompt },
                ...safeHistory.map(m => ({
                    role: m.senderId === 'AI_ASSISTANT' ? 'assistant' : 'user',
                    content: String(m.content ?? '').slice(0, 5000)
                })),
                { role: "user", content: String(msg ?? '').slice(0, 5000) }
            ];
            const completion = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: messages,
                response_format: { type: "json_object" },
                temperature: 0.7,
            });
            const content = completion.choices[0].message.content;
            if (!content)
                return null;
            const parsed = JSON.parse(content);
            let products = [];
            if (parsed.searchParams?.keywords?.length > 0) {
                products = await this.executeProductSearch(parsed.searchParams.keywords, parsed.searchParams.minPrice, parsed.searchParams.maxPrice);
            }
            return {
                text: parsed.reply || "Mình nghe nè!",
                options: parsed.options || [],
                searchSuggestions: parsed.searchSuggestions || [],
                products: products
            };
        }
        catch (e) {
            console.error(`OpenAI Error:`, e.message);
            return null;
        }
    }
    async fallbackRuleBased(msg) {
        const lowerMsg = msg.toLowerCase();
        let targetKeyword = 'quà tặng';
        for (const rule of this.GIFT_DICTIONARY) {
            if (rule.keys.some(k => lowerMsg.includes(k))) {
                targetKeyword = rule.target;
                break;
            }
        }
        const products = await this.executeProductSearch([targetKeyword]);
        return {
            text: `Mình tìm thấy vài món liên quan đến "${targetKeyword}" cho bạn đây:`,
            options: ['Xem thêm'],
            searchSuggestions: [{ label: `Tìm ${targetKeyword}`, query: targetKeyword }],
            products
        };
    }
};
exports.AiService = AiService;
exports.AiService = AiService = AiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], AiService);
//# sourceMappingURL=ai.service.js.map