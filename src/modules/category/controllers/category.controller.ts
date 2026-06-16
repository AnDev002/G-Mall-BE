import { Body, Controller, Delete, Get, Param, ParseArrayPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CategoryService } from '../category.service';
import { Public } from 'src/common/decorators/public.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Role } from '@prisma/client';
import { UpdateCategoryOrderDto } from '../dto/update-category-order.dto';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { UpdateCategoryBatchItemDto } from '../dto/update-category-batch.dto';

// Wiki 0039 BUG-CAT-1: trước đây controller không có @UseGuards → ai cũng POST/PATCH/DELETE
// được. Đặt @UseGuards ở class level (JwtAuthGuard tôn trọng @Public) nhưng KHÔNG đặt
// @Roles ở class level — RolesGuard không tôn trọng @Public và sẽ chặn cả route public.
// Thay vào đó @Roles(ADMIN) đặt per-method trên các route mutation.
@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Public()
  @Get()
  async getCategories(@Query('parentId') parentId?: string) {
    // Nếu client gửi string "null" hoặc undefined, xử lý về null thực
    const pId = parentId === 'null' || !parentId ? undefined : parentId;
    return this.categoryService.getCategories(pId);
  }

  @Public()
  @Get('search')
  async search(@Query('q') q: string) {
    return this.categoryService.searchCategories(q);
  }

  @Public()
  @Get('tree')
  async getCategoryTree() {
    return this.categoryService.getCategoryTree();
  }

  @Post()
  @Roles(Role.ADMIN)
  // Fix B-NEW-5 (wiki 0029): dùng CreateCategoryDto thay `any` để
  // ValidationPipe reject empty body 400 thay vì 500 crash ở generateSlug.
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoryService.create(createCategoryDto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  // Wiki 0082 fix-3: thay `any` bằng UpdateCategoryDto để ValidationPipe enforce
  // type + whitelist (strip field rác trước khi xuống prisma.update).
  update(@Param('id') id: string, @Body() updateCategoryDto: UpdateCategoryDto) {
    return this.categoryService.update(id, updateCategoryDto);
  }

  @Post('update-order')
  @Roles(Role.ADMIN)
  async updateOrder(@Body() dto: UpdateCategoryOrderDto) {
    return this.categoryService.updateOrder(dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.categoryService.remove(id);
  }

  @Post('batch-update')
  @Roles(Role.ADMIN)
  // Wiki 0082 fix-3: ParseArrayPipe (có sẵn @nestjs/common) validate từng phần tử
  // mảng top-level theo UpdateCategoryBatchItemDto → id bắt buộc, type sai bị 400.
  async updateBatch(
    @Body(new ParseArrayPipe({ items: UpdateCategoryBatchItemDto }))
    items: UpdateCategoryBatchItemDto[],
  ) {
      return this.categoryService.updateBatch(items);
  }

  @Public()
  @Get(':id/breadcrumbs')
  async getBreadcrumbs(@Param('id') id: string) {
    return this.categoryService.getBreadcrumbs(id);
  }

  // Wiki 0082 fix-1: endpoint này mutate TOÀN BỘ bảng category (loop update slug)
  // nhưng trước đây là @Public() @Get → bất kỳ ai cũng trigger full-table write.
  // Chuyển sang @Post + gate ADMIN (khớp các mutation khác). Bỏ @Public().
  @Post('fix-all-slugs')
  @Roles(Role.ADMIN)
  async fixAllSlugs() {
    // Gọi hàm logic từ Service (đúng chuẩn NestJS)
    return this.categoryService.fixAllSlugs();
  }
}