import { ConfigService } from '@nestjs/config';
import { ConsultationState } from './dto/gift-consultation.dto';
export interface StreamChunk {
    type: 'text_delta' | 'final_json';
    content?: string;
    data?: any;
}
export declare class GiftConsultantService {
    private configService;
    private openai;
    private redis;
    private readonly logger;
    constructor(configService: ConfigService);
    handleUserMessageStream(sessionId: string, userMessage: string): AsyncGenerator<StreamChunk>;
    private preProcessMessage;
    getSession(sessionId: string): Promise<ConsultationState>;
    saveSession(sessionId: string, state: ConsultationState): Promise<void>;
    resetSession(sessionId: string): Promise<{
        text: string;
        products: never[];
        options: string[];
        isMultiSelect: boolean;
    }>;
    private determineNextOptions;
    searchProducts(criteria: any): Promise<{
        id: number;
        name: string;
        price: number;
        image: string;
        rating: number;
        category: string;
    }[]>;
}
