import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export interface QdrantPoint {
    id: string;
    vector: number[];
    payload?: Record<string, unknown>;
}
export interface QdrantSearchHit {
    id: string;
    score: number;
    payload?: Record<string, unknown>;
}
export declare class QdrantClientService implements OnModuleInit {
    private readonly config;
    private readonly logger;
    private http;
    private collection;
    private readonly vectorSize;
    constructor(config: ConfigService);
    onModuleInit(): Promise<void>;
    private ensureCollection;
    upsert(points: QdrantPoint[]): Promise<void>;
    deletePoint(id: string): Promise<void>;
    search(vector: number[], limit?: number, filter?: Record<string, unknown>): Promise<QdrantSearchHit[]>;
    count(): Promise<number>;
}
