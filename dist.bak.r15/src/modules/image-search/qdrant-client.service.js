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
var QdrantClientService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QdrantClientService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = __importDefault(require("axios"));
let QdrantClientService = QdrantClientService_1 = class QdrantClientService {
    config;
    logger = new common_1.Logger(QdrantClientService_1.name);
    http;
    collection;
    vectorSize = 512;
    constructor(config) {
        this.config = config;
    }
    async onModuleInit() {
        const baseURL = this.config.get('QDRANT_URL') ?? 'http://localhost:6333';
        this.collection = this.config.get('QDRANT_COLLECTION') ?? 'products';
        const apiKey = this.config.get('QDRANT_API_KEY');
        this.http = axios_1.default.create({
            baseURL,
            timeout: 10_000,
            headers: apiKey ? { 'api-key': apiKey } : {},
        });
        this.logger.log(`qdrant URL: ${baseURL}, collection: ${this.collection}`);
        await this.ensureCollection();
    }
    async ensureCollection() {
        try {
            await this.http.get(`/collections/${this.collection}`);
            return;
        }
        catch (err) {
            if (err.response?.status !== 404) {
                this.logger.warn(`qdrant unreachable or unexpected error: ${err.message}`);
                return;
            }
        }
        await this.http.put(`/collections/${this.collection}`, {
            vectors: { size: this.vectorSize, distance: 'Cosine' },
        });
        this.logger.log(`created collection ${this.collection}`);
    }
    async upsert(points) {
        if (!points.length)
            return;
        await this.http.put(`/collections/${this.collection}/points?wait=true`, {
            points: points.map((p) => ({ id: p.id, vector: p.vector, payload: p.payload ?? {} })),
        });
    }
    async deletePoint(id) {
        await this.http.post(`/collections/${this.collection}/points/delete?wait=true`, {
            points: [id],
        });
    }
    async search(vector, limit = 20, filter) {
        const body = {
            vector,
            limit,
            with_payload: true,
        };
        if (filter)
            body.filter = filter;
        const { data } = await this.http.post(`/collections/${this.collection}/points/search`, body);
        return data.result ?? [];
    }
    async count() {
        try {
            const { data } = await this.http.post(`/collections/${this.collection}/points/count`, { exact: false });
            return data.result?.count ?? 0;
        }
        catch {
            return 0;
        }
    }
};
exports.QdrantClientService = QdrantClientService;
exports.QdrantClientService = QdrantClientService = QdrantClientService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], QdrantClientService);
//# sourceMappingURL=qdrant-client.service.js.map