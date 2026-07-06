"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisIoAdapter = void 0;
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const compression_1 = __importDefault(require("compression"));
const platform_socket_io_1 = require("@nestjs/platform-socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const redis_1 = require("redis");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const prisma_exception_filter_1 = require("./common/filters/prisma-exception.filter");
class RedisIoAdapter extends platform_socket_io_1.IoAdapter {
    app;
    adapterConstructor;
    constructor(app) {
        super(app);
        this.app = app;
    }
    async connectToRedis() {
        const isLocal = process.env.REDIS_HOST === 'localhost' || process.env.REDIS_HOST === '127.0.0.1';
        const socketOptions = isLocal
            ? {
                tls: false,
                connectTimeout: 10000
            }
            : {
                tls: true,
                rejectUnauthorized: false,
                connectTimeout: 10000
            };
        const pubClient = (0, redis_1.createClient)({
            url: `redis://${process.env.REDIS_PASSWORD ? ':' + process.env.REDIS_PASSWORD + '@' : ''}${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
            socket: socketOptions,
        });
        const subClient = pubClient.duplicate();
        pubClient.on('error', (err) => console.error('Redis Pub Error:', err));
        subClient.on('error', (err) => console.error('Redis Sub Error:', err));
        await Promise.all([pubClient.connect(), subClient.connect()]);
        this.adapterConstructor = (0, redis_adapter_1.createAdapter)(pubClient, subClient);
    }
    createIOServer(port, options) {
        const server = super.createIOServer(port, options);
        server.adapter(this.adapterConstructor);
        return server;
    }
}
exports.RedisIoAdapter = RedisIoAdapter;
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.use((0, cookie_parser_1.default)());
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
    const corsOriginsEnv = process.env.CORS_ORIGINS?.trim();
    const corsOrigins = corsOriginsEnv
        ? corsOriginsEnv.split(',').map((s) => s.trim()).filter(Boolean)
        : ['http://localhost:3000'];
    app.enableCors({
        origin: (origin, callback) => {
            if (!origin)
                return callback(null, true);
            if (corsOrigins.includes(origin))
                return callback(null, true);
            return callback(new Error(`CORS blocked for origin: ${origin}`), false);
        },
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
        allowedHeaders: 'Content-Type, Accept, Authorization, x-device-id, user-agent, Cache-Control, Pragma, Expires',
        preflightContinue: false,
        optionsSuccessStatus: 204,
    });
    console.log(`✅ CORS whitelist: ${corsOrigins.join(', ')}`);
    app.use((0, compression_1.default)());
    const FIELD_NAMES_VN = {
        name: 'Tên',
        email: 'Email',
        password: 'Mật khẩu',
        phone: 'Số điện thoại',
        description: 'Mô tả',
        price: 'Giá',
        stock: 'Số lượng',
        categoryId: 'Ngành hàng',
        title: 'Tiêu đề',
        code: 'Mã',
        startDate: 'Ngày bắt đầu',
        endDate: 'Ngày kết thúc',
    };
    const fieldLabel = (raw) => FIELD_NAMES_VN[raw] || `Trường "${raw}"`;
    const translateConstraint = (key, raw, field) => {
        const label = fieldLabel(field);
        const map = {
            isNotEmpty: `${label} không được để trống`,
            isString: `${label} phải là chuỗi ký tự`,
            isEmail: `${label} không đúng định dạng email`,
            isInt: `${label} phải là số nguyên`,
            isNumber: `${label} phải là số`,
            isBoolean: `${label} phải là true/false`,
            isArray: `${label} phải là danh sách`,
            isDateString: `${label} phải là ngày hợp lệ`,
            isUrl: `${label} phải là URL hợp lệ`,
            arrayNotEmpty: `${label} không được rỗng`,
            isDefined: `${label} là bắt buộc`,
        };
        if (map[key])
            return map[key];
        const minLen = raw.match(/must be longer than or equal to (\d+) characters?/i);
        if (minLen)
            return `${label} phải có ít nhất ${minLen[1]} ký tự`;
        const maxLen = raw.match(/must be shorter than or equal to (\d+) characters?/i);
        if (maxLen)
            return `${label} không được dài quá ${maxLen[1]} ký tự`;
        const min = raw.match(/must not be less than (\d+)/i);
        if (min)
            return `${label} không được nhỏ hơn ${min[1]}`;
        const max = raw.match(/must not be greater than (\d+)/i);
        if (max)
            return `${label} không được lớn hơn ${max[1]}`;
        return raw;
    };
    const flattenErrors = (errs, parentField = '') => {
        const out = [];
        for (const e of errs) {
            const field = parentField ? `${parentField}.${e.property}` : e.property;
            if (e.constraints) {
                for (const [k, v] of Object.entries(e.constraints)) {
                    out.push(translateConstraint(k, v, e.property));
                }
            }
            if (e.children?.length)
                out.push(...flattenErrors(e.children, field));
        }
        return out;
    };
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        exceptionFactory: (errors) => {
            const messages = flattenErrors(errors);
            const joined = messages.length ? messages.join('; ') : 'Dữ liệu không hợp lệ';
            return new common_1.BadRequestException({
                statusCode: 400,
                message: joined,
                messages,
                error: 'Bad Request',
            });
        },
    }));
    app.useGlobalFilters(new prisma_exception_filter_1.PrismaExceptionFilter());
    const redisIoAdapter = new RedisIoAdapter(app);
    try {
        await redisIoAdapter.connectToRedis();
        app.useWebSocketAdapter(redisIoAdapter);
        console.log('✅ Redis Adapter for WebSocket connected successfully.');
    }
    catch (error) {
        console.error('❌ Failed to connect Redis Adapter:', error);
    }
    await app.listen(process.env.PORT ?? 3001);
    console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
//# sourceMappingURL=main.js.map