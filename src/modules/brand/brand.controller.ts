import {
  Controller, Get, Post, Body, Put, Param, Delete, Query, ParseIntPipe, Patch, UseGuards
} from '@nestjs/common';
import { BrandService } from './brand.service';
import { BrandCrawlerService } from './brand-crawler.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';

@Controller()
export class BrandController {
  constructor(
    private readonly brandService: BrandService,
    private readonly brandCrawler: BrandCrawlerService,
  ) {}

  // Spec [0018]: Crawl brand từ URL Shopee/Tiki — seller-only.
  // Đặt ở /brands/crawl để dễ nhớ; auth check qua JwtAuthGuard chung của app.
  @UseGuards(JwtAuthGuard)
  @Post('brands/crawl')
  async crawlBrand(@Body() dto: { url: string }) {
    return this.brandCrawler.crawlByUrl(dto?.url);
  }

  // --- Public/Seller Routes (Prefix: /brands) ---
  @Get('brands')
  @Public() // Accessible by Sellers & Public
  async getActiveBrands() {
    return this.brandService.findAllActive();
  }

  // --- Admin Routes (Prefix: /admin/brands) ---
  @Get('admin/brands')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getBrandsAdmin(
      @Query('search') search: string,
      @Query('page') page: string,
      @Query('limit') limit: string
  ) {
    // Default page=1, limit=10 nếu missing — tránh Number(undefined)=NaN làm Prisma 500.
    const pageNum = page ? Number(page) : 1;
    const limitNum = limit ? Number(limit) : 10;
    return this.brandService.findAllAdmin({
        search,
        page: Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1,
        limit: Number.isFinite(limitNum) && limitNum > 0 ? limitNum : 10,
    });
  }

  @Post('admin/brands')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async create(@Body() dto: CreateBrandDto) {
    return this.brandService.create(dto);
  }

  @Put('admin/brands/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBrandDto) {
    return this.brandService.update(id, dto);
  }

  @Patch('admin/brands/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async toggleStatus(@Param('id', ParseIntPipe) id: number) {
      return this.brandService.toggleStatus(id);
  }

  @Delete('admin/brands/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.brandService.delete(id);
  }
}