// File: BE-4.3/modules/blog/blog-category.controller.ts

import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { BlogCategoryService } from './blog-category.service';
// [FIX] Sửa lại đường dẫn import chính xác
import { JwtAuthGuard } from '../auth/guards/jwt.guard'; // auth ngang hàng blog trong modules
import { RolesGuard } from '../../common/guards/roles.guard'; // common nằm ngoài modules
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('admin/blog-categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class BlogCategoryController {
  constructor(private readonly service: BlogCategoryService) {}

  @Post()
  create(@Body() data: { name: string; parentId?: string }) {
    return this.service.create(data);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  // Wiki 0068 C10: lưu thứ tự kéo thả danh mục blog. Đặt trước @Delete(':id')
  // (khác method nên không xung đột, nhưng để gần các route tĩnh cho rõ).
  @Patch('reorder')
  reorder(@Body() body: { items: { id: string; sortOrder: number }[] }) {
    return this.service.reorder(body?.items || []);
  }

  // Wiki 0068 C10: cập nhật danh mục (đặt SAU 'reorder' để route tĩnh không bị
  // ':id' nuốt). FE updateCategory gọi endpoint này.
  @Patch(':id')
  update(@Param('id') id: string, @Body() data: { name?: string; parentId?: string }) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}