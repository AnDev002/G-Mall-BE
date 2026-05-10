import { Module } from '@nestjs/common';
import { BrandService } from './brand.service';
import { BrandController } from './brand.controller';
import { BrandCrawlerService } from './brand-crawler.service';
import { DatabaseModule } from '../../database/database.module';
import { CategoryService } from '../category/category.service';

@Module({
  imports: [DatabaseModule],
  controllers: [BrandController],
  providers: [BrandService, BrandCrawlerService, CategoryService],
  exports: [BrandService, BrandCrawlerService],
})
export class BrandModule {}