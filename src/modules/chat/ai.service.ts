import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma/prisma.service';
import OpenAI from 'openai';

interface ProductSuggestion {
  id: string;
  image: string;
  title: string;
  price: number;
  rating: number;
  slug: string;
}

interface AiResponse {
    text: string;
    options: string[];
    searchSuggestions: Array<{ label: string; query: string }>;
    products: any[];
}

@Injectable()
export class AiService implements OnModuleInit {
  private openai: OpenAI;
  private readonly logger = new Logger(AiService.name);
  private responseCache = new Map<string, { data: any, timestamp: number }>();

  // Dữ liệu fallback
  private readonly GIFT_DICTIONARY = [
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

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    // Lazy init: OpenAI v6 SDK throw ngay constructor nếu apiKey rỗng -> app
    // không boot được. Cho phép null khi env thiếu, các route AI sẽ trả lỗi
    // có ngữ nghĩa thay vì crash whole app.
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    } else {
      this.logger.warn('OPENAI_API_KEY chưa set — route AI sẽ báo lỗi tới khi cấu hình');
      this.openai = null as any;
    }
  }

  async onModuleInit() { }

  // --- [FIX] THÊM HÀM CHAT (RAW TEXT) CHO GIFT CONSULTANT ---
  async chat(prompt: string): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini", // Hoặc gpt-3.5-turbo
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      });
      return completion.choices[0].message.content || "Xin lỗi, tôi không thể tư vấn lúc này.";
    } catch (error) {
      this.logger.error(`OpenAI Chat Error: ${error.message}`);
      return "Hệ thống tư vấn đang bận, vui lòng thử lại sau.";
    }
  }

  // --- 1. SEARCH ENGINE ---
  async executeProductSearch(searchTerms: string[], minPrice?: number, maxPrice?: number) {
    let keywords = searchTerms.flatMap(t => t.split(' ')).filter(t => t.length > 2);
    const stopWords = ['cho', 'tặng', 'mua', 'cần', 'là', 'của', 'những', 'cái'];
    keywords = keywords.filter(k => !stopWords.includes(k.toLowerCase()));

    if (keywords.length === 0) keywords = searchTerms;

    this.logger.debug(`🔍 Searching DB for keywords: [${keywords.join(', ')}]`);

    const conditions = keywords.map(term => ({
        OR: [
            { name: { contains: term, mode: 'insensitive' as const } }, 
            { description: { contains: term, mode: 'insensitive' as const } }
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
                const first = (p.images as any)[0];
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
    } catch (e) {
        this.logger.error(`DB Search Error: ${e.message}`);
        return [];
    }
  }

  // --- 2. MAIN HANDLER (CHAT THƯỜNG) ---
  async getAiResponse(userId: string, userMessage: string, historyMessages: any[] = []): Promise<AiResponse> {
    const cleanMsg = userMessage.trim();
    
    // Cache check
    const cacheKey = `${userId}:${cleanMsg.toLowerCase()}`;
    const cached = this.responseCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < 1000 * 60 * 5)) {
        return cached.data;
    }

    let aiResponse: AiResponse | null = null;

    if (this.configService.get('OPENAI_API_KEY')) {
        aiResponse = await this.tryCallAi(cleanMsg, historyMessages);
    }

    if (!aiResponse) {
        aiResponse = await this.fallbackRuleBased(cleanMsg);
    }

    this.responseCache.set(cacheKey, { data: aiResponse, timestamp: Date.now() });
    return aiResponse;
  }

  // --- 3. AI CALLER (JSON MODE) ---
  private async tryCallAi(msg: string, history: any[]): Promise<AiResponse | null> {
      const systemPrompt = `
        Bạn là "Chuyên gia Tư vấn Quà tặng Cao cấp" của LoveGifts.
        Trả về JSON: { "reply": "...", "searchParams": {...}, "options": [], "searchSuggestions": [] }
      `;

      try {
          const messages: any[] = [
              { role: "system", content: systemPrompt },
              ...history.map(m => ({
                  role: m.senderId === 'AI_ASSISTANT' ? 'assistant' : 'user',
                  content: m.content
              })),
              { role: "user", content: msg }
          ];

          const completion = await this.openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: messages,
              response_format: { type: "json_object" },
              temperature: 0.7,
          });

          const content = completion.choices[0].message.content;
          if (!content) return null;

          const parsed = JSON.parse(content);
          let products: ProductSuggestion[] = [];
          if (parsed.searchParams?.keywords?.length > 0) {
              products = await this.executeProductSearch(
                  parsed.searchParams.keywords, 
                  parsed.searchParams.minPrice, 
                  parsed.searchParams.maxPrice
              );
          }

          return {
              text: parsed.reply || "Mình nghe nè!",
              options: parsed.options || [],
              searchSuggestions: parsed.searchSuggestions || [],
              products: products
          };

      } catch (e) {
          console.error(`OpenAI Error:`, e.message);
          return null;
      }
  }

  private async fallbackRuleBased(msg: string): Promise<AiResponse> {
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
}