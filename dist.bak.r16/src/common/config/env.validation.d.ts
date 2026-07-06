declare enum NodeEnv {
    Development = "development",
    Production = "production",
    Test = "test"
}
export declare class EnvVars {
    NODE_ENV?: NodeEnv;
    PORT?: number;
    DATABASE_URL: string;
    JWT_SECRET: string;
    REDIS_HOST: string;
    REDIS_PORT: number;
    REDIS_PASSWORD?: string;
    JWT_EXPIRATION_TIME?: string;
    CORS_ORIGINS?: string;
    FE_URL?: string;
    MAIL_HOST?: string;
    MAIL_USER?: string;
    MAIL_PASS?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    GOOGLE_CALLBACK_URL?: string;
    FACEBOOK_APP_ID?: string;
    FACEBOOK_APP_SECRET?: string;
    FACEBOOK_CALLBACK_URL?: string;
    CLIP_SERVICE_URL?: string;
    QDRANT_URL?: string;
    QDRANT_API_KEY?: string;
    QDRANT_COLLECTION?: string;
}
export declare function validateEnv(config: Record<string, unknown>): EnvVars;
export {};
