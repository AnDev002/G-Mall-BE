"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var ClipClientService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClipClientService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = __importDefault(require("axios"));
let ClipClientService = ClipClientService_1 = class ClipClientService {
    config;
    logger = new common_1.Logger(ClipClientService_1.name);
    http;
    constructor(config) {
        this.config = config;
    }
    onModuleInit() {
        const baseURL = this.config.get('CLIP_SERVICE_URL') ?? 'http://localhost:8000';
        this.http = axios_1.default.create({
            baseURL,
            timeout: 15_000,
            headers: { 'Content-Type': 'application/json' },
        });
        this.logger.log(`clip-service URL: ${baseURL}`);
    }
    async embedImageBuffer(buffer) {
        const { data } = await this.http.post('/embed', {
            image_b64: buffer.toString('base64'),
        });
        return data.embedding;
    }
    async embedImageUrl(url) {
        const { data } = await this.http.post('/embed', {
            image_url: url,
        });
        return data.embedding;
    }
    async embedText(text) {
        const { data } = await this.http.post('/embed', { text });
        return data.embedding;
    }
    async healthcheck() {
        try {
            const { data } = await this.http.get('/health');
            return data.status === 'ok' && data.loaded;
        }
        catch {
            return false;
        }
    }
};
exports.ClipClientService = ClipClientService;
exports.ClipClientService = ClipClientService = ClipClientService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ClipClientService);
//# sourceMappingURL=clip-client.service.js.map