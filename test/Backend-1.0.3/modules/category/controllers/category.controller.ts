import { Controller, Get, Query } from '@nestjs/common';
import { CategoryService } from '../category.service';

@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  async getCategories(@Query('parentId') parentId?: string) {
    // Nếu client gửi string "null" hoặc undefined, xử lý về null thực
    const pId = parentId === 'null' || !parentId ? undefined : parentId;
    return this.categoryService.getCategories(pId);
  }

  @Get('search')
  async search(@Query('q') q: string) {
    return this.categoryService.searchCategories(q);
  }
}