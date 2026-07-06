import Redis from 'ioredis';
export declare class RedisService {
    private readonly client;
    constructor(client: Redis);
    getClient(): Redis;
    get(key: string): Promise<string | null>;
    set(key: string, value: string, ttl?: number): Promise<"OK">;
    del(key: string): Promise<number>;
    delByPattern(pattern: string): Promise<number>;
    setNX(key: string, value: string, ttl: number): Promise<boolean>;
}
