import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma/prisma.service';
interface AiResponse {
    text: string;
    options: string[];
    searchSuggestions: Array<{
        label: string;
        query: string;
    }>;
    products: any[];
}
export declare class AiService implements OnModuleInit {
    private prisma;
    private configService;
    private openai;
    private readonly logger;
    private responseCache;
    private readonly GIFT_DICTIONARY;
    constructor(prisma: PrismaService, configService: ConfigService);
    onModuleInit(): Promise<void>;
    chat(prompt: string): Promise<string>;
    executeProductSearch(searchTerms: string[], minPrice?: number, maxPrice?: number): Promise<{
        id: string;
        image: string;
        title: string;
        price: number;
        rating: number;
        slug: string;
    }[]>;
    getAiResponse(userId: string, userMessage: string, historyMessages?: any[]): Promise<AiResponse>;
    private tryCallAi;
    private fallbackRuleBased;
}
export {};
