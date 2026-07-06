"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const app_module_1 = require("../src/app.module");
const image_search_service_1 = require("../src/modules/image-search/image-search.service");
const prisma_service_1 = require("../src/database/prisma/prisma.service");
async function main() {
    const args = process.argv.slice(2);
    const includeAll = args.includes('--status') && args[args.indexOf('--status') + 1] === 'ALL';
    const logger = new common_1.Logger('reindex');
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, { logger: ['error', 'warn', 'log'] });
    const prisma = app.get(prisma_service_1.PrismaService);
    const imageSearch = app.get(image_search_service_1.ImageSearchService);
    const where = includeAll ? {} : { status: client_1.ProductStatus.ACTIVE };
    const products = await prisma.product.findMany({
        where,
        select: { id: true },
    });
    logger.log(`enqueuing ${products.length} products (status=${includeAll ? 'ALL' : 'ACTIVE'})`);
    let count = 0;
    for (const p of products) {
        await imageSearch.enqueueIndex(p.id);
        count++;
        if (count % 500 === 0)
            logger.log(`...${count}/${products.length}`);
    }
    logger.log(`done: ${count} jobs enqueued`);
    await app.close();
    process.exit(0);
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=reindex-all-products.js.map