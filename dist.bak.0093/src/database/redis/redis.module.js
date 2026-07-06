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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ioredis_1 = __importDefault(require("ioredis"));
const redis_service_1 = require("./redis.service");
const redis_constants_1 = require("./redis.constants");
let RedisModule = class RedisModule {
};
exports.RedisModule = RedisModule;
exports.RedisModule = RedisModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [config_1.ConfigModule],
        providers: [
            {
                provide: redis_constants_1.REDIS_CLIENT,
                useFactory: async (configService) => {
                    const host = configService.get('REDIS_HOST');
                    const port = Number(configService.get('REDIS_PORT'));
                    const password = configService.get('REDIS_PASSWORD');
                    const isLocal = host === 'localhost' || host === '127.0.0.1';
                    const client = new ioredis_1.default({
                        host,
                        port,
                        password: password || undefined,
                        tls: isLocal ? undefined : { rejectUnauthorized: false },
                        maxRetriesPerRequest: 3,
                    });
                    client.on('error', (err) => console.error('[REDIS_CLIENT]', err.message));
                    client.on('reconnecting', () => console.warn('[REDIS_CLIENT] reconnecting...'));
                    return client;
                },
                inject: [config_1.ConfigService],
            },
            redis_service_1.RedisService,
        ],
        exports: [redis_constants_1.REDIS_CLIENT, redis_service_1.RedisService],
    })
], RedisModule);
//# sourceMappingURL=redis.module.js.map