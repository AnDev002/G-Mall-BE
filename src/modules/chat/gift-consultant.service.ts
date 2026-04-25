import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { ConsultationState, ConsultationStep } from './dto/gift-consultation.dto';

// --- Interface & Constants ---
export interface StreamChunk {
  type: 'text_delta' | 'final_json';
  content?: string;
  data?: any;
}

const CONSULTATION_OPTIONS = {
  RELATIONSHIPS: ['Người yêu (Nữ)', 'Người yêu (Nam)', 'Vợ', 'Chồng', 'Mẹ', 'Bố', 'Bạn thân', 'Sếp', 'Trẻ em', 'Đối tác'],
  OCCASIONS: ['Sinh nhật', 'Kỷ niệm', 'Valentine', '8/3', '20/10', 'Giáng sinh', 'Tết', 'Tân gia', 'Thăm bệnh'],
  PERSONALITIES: ['Hiện đại', 'Truyền thống', 'Lãng mạn', 'Thực tế', 'Công nghệ', 'Yêu bếp', 'Thời trang', 'Hài hước', 'Sang trọng'],
  BUDGETS: ['< 500k', '500k - 1tr', '1 - 2tr', '2 - 5tr', '> 5tr', 'Tùy chọn']
};

// Mock Data mở rộng 12 món
const MOCK_PRODUCTS_POOL = [
    { id: 1, name: "Set Quà Nàng Thơ (Nến + Hoa)", price: 850000, image: "https://via.placeholder.com/150", rating: 5, category: "lang-man" },
    { id: 2, name: "Đồng Hồ Smartwatch Gen 5", price: 2500000, image: "https://via.placeholder.com/150", rating: 4.8, category: "cong-nghe" },
    { id: 3, name: "Rượu Vang Đỏ Cao Cấp & Hộp Gỗ", price: 1650000, image: "https://via.placeholder.com/150", rating: 4.9, category: "sang-trong" },
    { id: 4, name: "Bút Ký Doanh Nhân Mạ Vàng", price: 1200000, image: "https://via.placeholder.com/150", rating: 5, category: "sang-trong" },
    { id: 5, name: "Máy Ảnh Instax Lấy Liền", price: 3200000, image: "https://via.placeholder.com/150", rating: 4.7, category: "nghe-thuat" },
    { id: 6, name: "Túi Xách Da Thời Trang", price: 950000, image: "https://via.placeholder.com/150", rating: 4.6, category: "thoi-trang" },
    { id: 7, name: "Bộ Mỹ Phẩm Skincare Fullsize", price: 2100000, image: "https://via.placeholder.com/150", rating: 4.9, category: "lam-dep" },
    { id: 8, name: "Loa Bluetooth Marshall", price: 3900000, image: "https://via.placeholder.com/150", rating: 5, category: "cong-nghe" },
    { id: 9, name: "Tranh Treo Tường Decor", price: 450000, image: "https://via.placeholder.com/150", rating: 4.5, category: "nghe-thuat" },
    { id: 10, name: "Thực Phẩm Chức Năng (Sâm/Yến)", price: 1500000, image: "https://via.placeholder.com/150", rating: 4.8, category: "suc-khoe" },
    { id: 11, name: "Máy Massage Cổ Vai Gáy", price: 890000, image: "https://via.placeholder.com/150", rating: 4.7, category: "suc-khoe" },
    { id: 12, name: "Album Ảnh Kỷ Niệm Handmade", price: 350000, image: "https://via.placeholder.com/150", rating: 4.9, category: "lang-man" },
];

@Injectable()
export class GiftConsultantService {
  private openai: OpenAI;
  private redis: Redis;
  private readonly logger = new Logger(GiftConsultantService.name);

  constructor(private configService: ConfigService) {
    // Lazy init OpenAI: app phải boot được dù chưa cấu hình AI
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey, timeout: 25000, maxRetries: 2 });
    } else {
      this.logger.warn('OPENAI_API_KEY chưa set — gift consultant sẽ trả lỗi tới khi cấu hình');
      this.openai = null as any;
    }
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      connectTimeout: 10000,
      maxRetriesPerRequest: 3,
    });
  }

  async *handleUserMessageStream(sessionId: string, userMessage: string): AsyncGenerator<StreamChunk> {
    const state = await this.getSession(sessionId);
    
    // 1. Reset Command
    if (['/start', 'bắt đầu', 'reset'].includes(userMessage.toLowerCase())) {
        const resetRes = await this.resetSession(sessionId);
        yield { type: 'text_delta', content: resetRes.text };
        yield { type: 'final_json', data: resetRes };
        return;
    }

    // 2. Heuristic Update
    this.preProcessMessage(state, userMessage);

    // 3. System Prompt "CHUYÊN GIA GỢI Ý CHI TIẾT"
    const systemPrompt = `
      Bạn là Chuyên gia Tư vấn Quà tặng cao cấp của LoveGifts.
      Phong cách: Tinh tế, sâu sắc, nhiệt tình.
      Dữ liệu khách: ${JSON.stringify(state.data)}

      NHIỆM VỤ:
      1. Nếu thiếu thông tin -> Hỏi khéo léo để lấy thêm (Người nhận, Dịp, Sở thích, Ngân sách).
      
      2. NẾU ĐÃ ĐỦ THÔNG TIN (Bước quan trọng nhất):
         - Đừng chỉ nói chung chung. Hãy ĐỀ XUẤT CỤ THỂ 6-10 món quà khác nhau ngay trong đoạn văn trả lời.
         - Sử dụng gạch đầu dòng hoặc đánh số để liệt kê rõ ràng.
         - Ví dụ: 
           "Dựa trên ý tưởng của bạn, mình nghĩ ra 6 món này cực hợp:
            1. Một thỏi son Mac màu Chili (quyến rũ).
            2. Nước hoa hương gỗ (ấm áp).
            3. Túi xách kẹp nách trendy...
            ..."
         - Giải thích ngắn gọn tại sao lại chọn danh sách này (lý do tâm lý/cảm xúc).
         - Cuối cùng nhắc về "cách tặng" (thư tay, gói quà).

      OUTPUT FORMAT:
      - Trả lời user (có danh sách 6-10 món).
      - Xuống dòng -> "|||JSON_START|||" -> JSON State -> "|||JSON_END|||"
    `;

    try {
        const stream = await this.openai.chat.completions.create({
            model: "gpt-4o-mini", 
            messages: [
                { role: "system", content: systemPrompt },
                ...state.history.slice(-6).map(h => ({ role: "user", content: h })) as any,
                { role: "user", content: userMessage }
            ],
            stream: true,
            temperature: 0.85, 
        }, { timeout: 25000 });

        // --- Logic Stream Buffer & JSON Parsing (Giữ nguyên) ---
        const DELIMITER = "|||JSON_START|||";
        let buffer = "";
        let yieldedIndex = 0;
        let isJsonMode = false;
        let jsonBuffer = "";

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (!content) continue;

            if (isJsonMode) {
                jsonBuffer += content;
                continue;
            }

            buffer += content;
            const delimiterIdx = buffer.indexOf(DELIMITER);

            if (delimiterIdx !== -1) {
                const safeText = buffer.substring(yieldedIndex, delimiterIdx);
                if (safeText) yield { type: 'text_delta', content: safeText };
                isJsonMode = true;
                jsonBuffer += buffer.substring(delimiterIdx);
            } else {
                const safeLength = buffer.length - DELIMITER.length;
                if (safeLength > yieldedIndex) {
                    const textToSend = buffer.substring(yieldedIndex, safeLength);
                    yield { type: 'text_delta', content: textToSend };
                    yieldedIndex += textToSend.length;
                }
            }
        }
        
        if (!isJsonMode && yieldedIndex < buffer.length) {
            yield { type: 'text_delta', content: buffer.substring(yieldedIndex) };
        }

        // Parse JSON & Update State
        try {
            const jsonString = jsonBuffer.replace("|||JSON_START|||", "").replace("|||JSON_END|||", "").trim();
            if (jsonString) {
                const startIdx = jsonString.indexOf('{');
                const endIdx = jsonString.lastIndexOf('}');
                if (startIdx >= 0 && endIdx >= 0) {
                    const extractedData = JSON.parse(jsonString.substring(startIdx, endIdx + 1));
                    if (extractedData.recipient) state.data.recipient = extractedData.recipient;
                    if (extractedData.occasion) state.data.occasion = extractedData.occasion;
                    if (extractedData.budget) state.data.budget = extractedData.budget;
                    if (extractedData.interests) state.data.interests = extractedData.interests;
                }
            }
        } catch (e) { this.logger.warn(`JSON Parse Error: ${e.message}`); }

        state.history.push(`User: ${userMessage}`);
        
        // Search Logic
        const isReadyToSearch = (state.data.recipient && state.data.occasion && state.data.budget);

        if (isReadyToSearch) {
             // [Quan trọng] Trả về 8 sản phẩm để hiển thị kèm theo lời tư vấn
             const products = await this.searchProducts(state.data); 
             yield { 
                 type: 'final_json', 
                 data: { products, options: ['Tìm thêm', 'Tư vấn lại'], isMultiSelect: false } 
             };
             state.step = ConsultationStep.COMPLETED;
        } else {
             const nextOptions = this.determineNextOptions(state.data);
             yield { 
                 type: 'final_json', 
                 data: { products: [], options: nextOptions, isMultiSelect: nextOptions === CONSULTATION_OPTIONS.PERSONALITIES } 
             };
        }
        
        await this.saveSession(sessionId, state);

    } catch (e) {
        this.logger.error(`Stream Error:`, e);
        yield { type: 'text_delta', content: "Mạng hơi lag xíu, bạn chờ mình chút nha!" };
    }
  }

  // --- Logic Heuristic (Giữ nguyên) ---
  private preProcessMessage(state: ConsultationState, message: string) {
      const lowerMsg = message.toLowerCase().trim();
      const matchedRelationship = CONSULTATION_OPTIONS.RELATIONSHIPS.find(r => r.toLowerCase() === lowerMsg);
      if (matchedRelationship) { state.data.recipient = matchedRelationship; return; }
      
      const matchedOccasion = CONSULTATION_OPTIONS.OCCASIONS.find(o => o.toLowerCase() === lowerMsg);
      if (matchedOccasion) { state.data.occasion = matchedOccasion; return; }
      
      const matchedBudget = CONSULTATION_OPTIONS.BUDGETS.find(b => b.toLowerCase() === lowerMsg);
      if (matchedBudget) { state.data.budget = matchedBudget; return; }

      const foundInterests = CONSULTATION_OPTIONS.PERSONALITIES.filter(p => lowerMsg.includes(p.toLowerCase()));
      if (foundInterests.length > 0) {
          state.data.interests = [...new Set([...(state.data.interests || []), ...foundInterests])];
      }
  }

  // --- Helpers (Giữ nguyên) ---
  async getSession(sessionId: string): Promise<ConsultationState> {
    try {
        const data = await this.redis.get(`chat_session:${sessionId}`);
        if (!data) return { step: ConsultationStep.INIT, data: {}, history: [] };
        return JSON.parse(data);
    } catch (e) {
        return { step: ConsultationStep.INIT, data: {}, history: [] };
    }
  }

  async saveSession(sessionId: string, state: ConsultationState) {
    try {
        await this.redis.set(`chat_session:${sessionId}`, JSON.stringify(state), 'EX', 3600);
    } catch (e) { this.logger.error(`Redis Save Error: ${e.message}`); }
  }

  async resetSession(sessionId: string) {
    const newState: ConsultationState = { step: ConsultationStep.ASK_RECIPIENT, data: {}, history: [] };
    await this.saveSession(sessionId, newState);
    return {
        text: "Chào bạn! Mình là LoveGifts Bot 🎁. Bạn muốn tìm quà tặng cho ai nhỉ?",
        products: [],
        options: CONSULTATION_OPTIONS.RELATIONSHIPS,
        isMultiSelect: false
    };
  }

  private determineNextOptions(data: any): string[] {
      if (!data.recipient) return CONSULTATION_OPTIONS.RELATIONSHIPS;
      if (!data.occasion) return CONSULTATION_OPTIONS.OCCASIONS;
      if (!data.interests || data.interests.length === 0) return CONSULTATION_OPTIONS.PERSONALITIES;
      if (!data.budget) return CONSULTATION_OPTIONS.BUDGETS;
      return [];
  }

  async searchProducts(criteria: any) {
    let results = MOCK_PRODUCTS_POOL;
    if (criteria.recipient) {
        const r = criteria.recipient.toLowerCase();
        if (r.includes('đối tác') || r.includes('sếp')) {
            results = results.filter(p => p.category === 'sang-trong' || p.price > 1000000);
        } else if (r.includes('người yêu') || r.includes('vợ')) {
             results = results.filter(p => ['lang-man', 'lam-dep', 'thoi-trang'].includes(p.category));
        } else if (r.includes('bố') || r.includes('mẹ')) {
             results = results.filter(p => p.category === 'suc-khoe');
        }
    }
    
    if (results.length < 4) {
        const remaining = MOCK_PRODUCTS_POOL.filter(p => !results.includes(p));
        results = [...results, ...remaining];
    }
    // Trả về tối đa 8 item
    return results.sort(() => 0.5 - Math.random()).slice(0, 8);
  }
}