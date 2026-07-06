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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var ImageSearchService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageSearchService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const axios_1 = __importDefault(require("axios"));
const prisma_service_1 = require("../../database/prisma/prisma.service");
const clip_client_service_1 = require("./clip-client.service");
const qdrant_client_service_1 = require("./qdrant-client.service");
const indexer_processor_1 = require("./indexer.processor");
let ImageSearchService = ImageSearchService_1 = class ImageSearchService {
    prisma;
    clip;
    qdrant;
    indexQueue;
    logger = new common_1.Logger(ImageSearchService_1.name);
    constructor(prisma, clip, qdrant, indexQueue) {
        this.prisma = prisma;
        this.clip = clip;
        this.qdrant = qdrant;
        this.indexQueue = indexQueue;
    }
    async enqueueIndex(productId) {
        await this.indexQueue.add('index', { productId }, {
            jobId: `index:${productId}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 2_000 },
            removeOnComplete: 100,
            removeOnFail: 50,
        });
    }
    async enqueueDelete(productId) {
        await this.qdrant.deletePoint(productId).catch((err) => this.logger.warn(`qdrant delete ${productId} ignored: ${err.message}`));
        await this.prisma.productEmbedding.deleteMany({ where: { productId } }).catch(() => undefined);
    }
    async searchByImageBuffer(buffer, limit = 20, minSimilarity = 0) {
        const vector = await this.callDependency(() => this.clip.embedImageBuffer(buffer));
        return this.runVectorSearch(vector, limit, minSimilarity);
    }
    async searchByText(text, limit = 20, minSimilarity = 0) {
        const vector = await this.callDependency(() => this.clip.embedText(text));
        return this.runVectorSearch(vector, limit, minSimilarity);
    }
    async runVectorSearch(vector, limit, minSimilarity) {
        const hits = await this.callDependency(() => this.qdrant.search(vector, limit, {
            must: [{ key: 'status', match: { value: 'ACTIVE' } }],
        }));
        if (!hits.length)
            return [];
        const ids = hits.map((h) => String(h.id));
        const products = await this.prisma.product.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true, slug: true, price: true, images: true, shopId: true },
        });
        const byId = new Map(products.map((p) => [p.id, p]));
        return hits
            .map((h) => {
            const p = byId.get(String(h.id));
            if (!p)
                return null;
            const similarity = clamp01(h.score);
            if (similarity < minSimilarity)
                return null;
            return {
                productId: p.id,
                similarity,
                name: p.name,
                price: Number(p.price),
                image: pickFirstImageUrl(p.images),
                shopId: p.shopId ?? null,
                slug: p.slug,
            };
        })
            .filter((h) => h !== null);
    }
    async stats() {
        const [pending, indexed, failed, skipped, qdrantCount] = await Promise.all([
            this.prisma.productEmbedding.count({ where: { status: 'PENDING' } }),
            this.prisma.productEmbedding.count({ where: { status: 'INDEXED' } }),
            this.prisma.productEmbedding.count({ where: { status: 'FAILED' } }),
            this.prisma.productEmbedding.count({ where: { status: 'SKIPPED' } }),
            this.callDependency(() => this.qdrant.count()),
        ]);
        return { pending, indexed, failed, skipped, qdrantCount };
    }
    async callDependency(fn) {
        try {
            return await fn();
        }
        catch (err) {
            if (isUpstreamUnavailable(err)) {
                this.logger.warn(`image-search dependency unavailable: ${err instanceof Error ? err.message : String(err)}`);
                throw new common_1.ServiceUnavailableException('Image search temporarily unavailable');
            }
            throw err;
        }
    }
};
exports.ImageSearchService = ImageSearchService;
exports.ImageSearchService = ImageSearchService = ImageSearchService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, bullmq_1.InjectQueue)(indexer_processor_1.PRODUCT_INDEX_QUEUE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        clip_client_service_1.ClipClientService,
        qdrant_client_service_1.QdrantClientService,
        bullmq_2.Queue])
], ImageSearchService);
function isUpstreamUnavailable(err) {
    if (!axios_1.default.isAxiosError(err))
        return false;
    if (!err.response)
        return true;
    const code = err.code;
    return code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'ENOTFOUND';
}
function pickFirstImageUrl(images) {
    if (Array.isArray(images)) {
        const first = images.find((u) => typeof u === 'string' && u.length > 0);
        return first ?? null;
    }
    return null;
}
function clamp01(x) {
    if (x < 0)
        return 0;
    if (x > 1)
        return 1;
    return x;
}
//# sourceMappingURL=image-search.service.js.map