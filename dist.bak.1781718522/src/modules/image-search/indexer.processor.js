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
var IndexerProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndexerProcessor = exports.PRODUCT_INDEX_QUEUE = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const crypto_1 = require("crypto");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const clip_client_service_1 = require("./clip-client.service");
const qdrant_client_service_1 = require("./qdrant-client.service");
exports.PRODUCT_INDEX_QUEUE = 'product_index_queue';
let IndexerProcessor = IndexerProcessor_1 = class IndexerProcessor extends bullmq_1.WorkerHost {
    prisma;
    clip;
    qdrant;
    logger = new common_1.Logger(IndexerProcessor_1.name);
    constructor(prisma, clip, qdrant) {
        super();
        this.prisma = prisma;
        this.clip = clip;
        this.qdrant = qdrant;
    }
    async process(job) {
        const { productId } = job.data;
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
            select: { id: true, images: true, shopId: true, categoryId: true, status: true },
        });
        if (!product) {
            this.logger.warn(`product ${productId} not found, deleting from index`);
            await this.safeRemoveFromIndex(productId);
            return { status: 'NOT_FOUND' };
        }
        const firstImageUrl = pickFirstImageUrl(product.images);
        if (!firstImageUrl) {
            await this.markEmbedding(productId, 'SKIPPED', null, 'no image on product');
            return { status: 'SKIPPED' };
        }
        if (!isAllowedImageUrl(firstImageUrl)) {
            await this.markEmbedding(productId, 'SKIPPED', null, 'image url rejected');
            return { status: 'SKIPPED' };
        }
        let buffer;
        try {
            const res = await axios_1.default.get(firstImageUrl, {
                responseType: 'arraybuffer',
                timeout: 10_000,
                maxRedirects: 0,
            });
            buffer = Buffer.from(res.data);
        }
        catch (err) {
            await this.markEmbedding(productId, 'FAILED', null, 'image fetch failed');
            throw err;
        }
        const hash = (0, crypto_1.createHash)('sha256').update(buffer).digest('hex');
        const existing = await this.prisma.productEmbedding.findUnique({ where: { productId } });
        if (existing?.imageHash === hash && existing.status === 'INDEXED') {
            this.logger.debug(`product ${productId} unchanged, skip re-encode`);
            return { status: 'UNCHANGED' };
        }
        let vector;
        try {
            vector = await this.clip.embedImageBuffer(buffer);
        }
        catch (err) {
            await this.markEmbedding(productId, 'FAILED', hash, `clip: ${err.message}`);
            throw err;
        }
        try {
            await this.qdrant.upsert([
                {
                    id: productId,
                    vector,
                    payload: {
                        shopId: product.shopId ?? null,
                        categoryId: product.categoryId ?? null,
                        status: product.status,
                    },
                },
            ]);
        }
        catch (err) {
            await this.markEmbedding(productId, 'FAILED', hash, `qdrant: ${err.message}`);
            throw err;
        }
        await this.markEmbedding(productId, 'INDEXED', hash, null);
        return { status: 'INDEXED' };
    }
    async safeRemoveFromIndex(productId) {
        try {
            await this.qdrant.deletePoint(productId);
        }
        catch (err) {
            this.logger.warn(`qdrant delete ${productId} failed: ${err.message}`);
        }
        await this.prisma.productEmbedding.deleteMany({ where: { productId } });
    }
    async markEmbedding(productId, status, imageHash, errorMsg) {
        const indexedAt = status === 'INDEXED' ? new Date() : null;
        await this.prisma.productEmbedding.upsert({
            where: { productId },
            create: { productId, status, imageHash, errorMsg, indexedAt },
            update: { status, imageHash, errorMsg, indexedAt },
        });
    }
};
exports.IndexerProcessor = IndexerProcessor;
exports.IndexerProcessor = IndexerProcessor = IndexerProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(exports.PRODUCT_INDEX_QUEUE, { concurrency: 3 }),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        clip_client_service_1.ClipClientService,
        qdrant_client_service_1.QdrantClientService])
], IndexerProcessor);
function pickFirstImageUrl(images) {
    if (Array.isArray(images)) {
        const first = images.find((u) => typeof u === 'string' && u.length > 0);
        return first ?? null;
    }
    return null;
}
function isAllowedImageUrl(raw) {
    let url;
    try {
        url = new URL(raw);
    }
    catch {
        return false;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
        return false;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
    if (!host)
        return false;
    if (host === 'localhost' || host.endsWith('.localhost'))
        return false;
    const _isV4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    const _isV6 = host.includes(':');
    if (!_isV4 && !_isV6 && !host.includes('.'))
        return false;
    if (host === '::1' || host === '::')
        return false;
    if (/^f[cd][0-9a-f]{2}:/i.test(host))
        return false;
    if (/^fe[89ab][0-9a-f]:/i.test(host))
        return false;
    if (host.startsWith('::ffff:'))
        return false;
    const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (m) {
        const o = m.slice(1).map(Number);
        if (o.some((n) => n > 255))
            return false;
        const [a, b] = o;
        if (a === 127)
            return false;
        if (a === 10)
            return false;
        if (a === 172 && b >= 16 && b <= 31)
            return false;
        if (a === 192 && b === 168)
            return false;
        if (a === 169 && b === 254)
            return false;
        if (a === 0)
            return false;
    }
    return true;
}
//# sourceMappingURL=indexer.processor.js.map