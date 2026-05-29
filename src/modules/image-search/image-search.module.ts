import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from 'src/database/database.module';
import { ImageSearchController } from './image-search.controller';
import { ImageSearchService } from './image-search.service';
import { ClipClientService } from './clip-client.service';
import { QdrantClientService } from './qdrant-client.service';
import { IndexerProcessor, PRODUCT_INDEX_QUEUE } from './indexer.processor';

/**
 * Image search module (wiki 0052).
 *
 * Exports ImageSearchService so ProductWriteService can call .enqueueIndex()
 * after create/update without depending on Bull directly.
 *
 * JwtAuthGuard for the /stats endpoint is class-imported directly; the
 * passport JWT strategy is registered globally by AuthModule, so we don't
 * need to import AuthModule here.
 */
@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({ name: PRODUCT_INDEX_QUEUE }),
  ],
  controllers: [ImageSearchController],
  providers: [ImageSearchService, ClipClientService, QdrantClientService, IndexerProcessor],
  exports: [ImageSearchService],
})
export class ImageSearchModule {}
