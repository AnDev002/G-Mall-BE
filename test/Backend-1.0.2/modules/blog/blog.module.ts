import { Module } from '@nestjs/common';
import { BlogService } from './blog.service';
import { BlogController } from './blog.controller';
import { DatabaseModule } from '../../database/database.module';
import { BlogCategoryService } from './blog-category.service';
import { BlogCategoryController } from './blog-category.controller';
import { PublicBlogController } from './blog.public.controller';

@Module({
  imports: [DatabaseModule], // Ensures PrismaService is available
  controllers: [BlogController, BlogCategoryController, PublicBlogController],
  providers: [BlogService, BlogCategoryService],
  exports: [BlogService], // Export if other modules need to read blogs
})
export class BlogModule {}