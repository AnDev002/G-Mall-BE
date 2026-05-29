/**
 * One-shot backfill: enqueue an index job for every ACTIVE product.
 *
 * Usage:
 *   npx ts-node scripts/reindex-all-products.ts
 *   npx ts-node scripts/reindex-all-products.ts --status ALL  # also include PENDING/INACTIVE
 *
 * Idempotent: the BullMQ jobId is `index:<productId>` so duplicate enqueues
 * collapse. The processor's hash check then short-circuits if the image
 * is unchanged since last index.
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { ImageSearchService } from '../src/modules/image-search/image-search.service';
import { PrismaService } from '../src/database/prisma/prisma.service';

async function main() {
  const args = process.argv.slice(2);
  const includeAll = args.includes('--status') && args[args.indexOf('--status') + 1] === 'ALL';

  const logger = new Logger('reindex');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });

  const prisma = app.get(PrismaService);
  const imageSearch = app.get(ImageSearchService);

  const where = includeAll ? {} : { status: ProductStatus.ACTIVE };
  const products = await prisma.product.findMany({
    where,
    select: { id: true },
  });

  logger.log(`enqueuing ${products.length} products (status=${includeAll ? 'ALL' : 'ACTIVE'})`);

  let count = 0;
  for (const p of products) {
    await imageSearch.enqueueIndex(p.id);
    count++;
    if (count % 500 === 0) logger.log(`...${count}/${products.length}`);
  }

  logger.log(`done: ${count} jobs enqueued`);
  await app.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
