import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export declare class ClipClientService implements OnModuleInit {
    private readonly config;
    private readonly logger;
    private http;
    constructor(config: ConfigService);
    onModuleInit(): void;
    embedImageBuffer(buffer: Buffer): Promise<number[]>;
    embedImageUrl(url: string): Promise<number[]>;
    embedText(text: string): Promise<number[]>;
    healthcheck(): Promise<boolean>;
}
