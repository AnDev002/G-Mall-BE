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
var ProductAutoTagService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductAutoTagService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const product_read_service_1 = require("./product-read.service");
const product_cache_service_1 = require("./product-cache.service");
function removeAccents(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
let ProductAutoTagService = ProductAutoTagService_1 = class ProductAutoTagService {
    prisma;
    productRead;
    productCache;
    logger = new common_1.Logger(ProductAutoTagService_1.name);
    constructor(prisma, productRead, productCache) {
        this.prisma = prisma;
        this.productRead = productRead;
        this.productCache = productCache;
    }
    async scanAndTagAllProducts(rules) {
        const products = await this.prisma.product.findMany({
            where: { status: 'ACTIVE' },
            include: { variants: true }
        });
        let updatedCount = 0;
        for (const product of products) {
            const rawText = (product.name + ' ' + (product.description || ''));
            const normalizedText = removeAccents(rawText);
            let currentTags = product.systemTags || [];
            const originalTags = [...currentTags];
            for (const rule of rules) {
                const hasKeyword = rule.keywords.some(k => normalizedText.includes(removeAccents(k)) ||
                    rawText.toLowerCase().includes(k.toLowerCase()));
                if (hasKeyword) {
                    if (!currentTags.includes(rule.code)) {
                        currentTags.push(rule.code);
                    }
                }
            }
            if (JSON.stringify(originalTags) !== JSON.stringify(currentTags)) {
                const updatedProduct = await this.prisma.product.update({
                    where: { id: product.id },
                    data: { systemTags: currentTags },
                    include: { variants: true, category: true }
                });
                await this.productRead.syncProductToRedis(updatedProduct);
                updatedCount++;
                this.logger.log(`Auto-tagged & Synced: ${product.name} -> Tags: ${currentTags.join(', ')}`);
            }
        }
        return { updatedCount };
    }
};
exports.ProductAutoTagService = ProductAutoTagService;
exports.ProductAutoTagService = ProductAutoTagService = ProductAutoTagService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        product_read_service_1.ProductReadService,
        product_cache_service_1.ProductCacheService])
], ProductAutoTagService);
//# sourceMappingURL=product-auto-tag.service.js.map