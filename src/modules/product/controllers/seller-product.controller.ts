// BE--1/modules/product/controllers/seller-product.controller.ts
import { Controller, Get, Post, Body, UseGuards, Request, Patch, Param, Query, ParseIntPipe, Delete } from '@nestjs/common';
import { ProductWriteService } from '../services/product-write.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductAffiliateDto, UpdateProductDiscountDto, UpdateProductDto } from '../dto/update-product.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { User } from 'src/common/decorators/user.decorator';
interface UserEntity {
  id: string;
  email: string;
  role: Role;
}
@Controller('seller/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SELLER)
export class SellerProductController {
  constructor(private readonly productWriteService: ProductWriteService) {}

  @Post()
  create(@Request() req, @Body() dto: CreateProductDto) {
    // FIX: Sử dụng req.user.id thay vì req.user.userId
    return this.productWriteService.create(req.user.id, dto);
  }
  
  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() dto: UpdateProductDto) {
    // FIX: Sử dụng req.user.id
    return this.productWriteService.update(id, req.user.id, dto);
  }

  @Get('my-products')
  searchMyProducts(
    @Request() req,
    @Query('search') search: string,
    @Query('limit') limit: string, // Query params thường là string
  ) {
    const limitNum = limit ? parseInt(limit) : 10;
    return this.productWriteService.searchMyProducts(req.user.id, search, limitNum);
  }
  @Patch(':id/discount')
  async updateDiscount(
    @User() user: UserEntity,
    @Param('id') id: string,
    @Body() dto: UpdateProductDiscountDto,
  ) {
    return this.productWriteService.updateDiscount(user.id, id, dto);
  }

  // wiki 0105 — bật/tắt affiliate + đặt % hoa hồng cho sản phẩm của chính mình.
  // Đặt cạnh :id/discount và TRƯỚC @Get(':id') để route tĩnh không bị ':id' nuốt.
  @Patch(':id/affiliate')
  async updateAffiliate(
    @User() user: UserEntity,
    @Param('id') id: string,
    @Body() dto: UpdateProductAffiliateDto,
  ) {
    return this.productWriteService.updateAffiliate(user.id, id, dto);
  }

  @Delete(':id')
  async delete(@Request() req, @Param('id') id: string) {
    // Truyền userId vào service để check quyền sở hữu trước khi xóa
    return this.productWriteService.deleteBySeller(req.user.id, id);
  }

  @Get()
  getMyProducts(
      @Request() req,
      @Query('status') status: string,
      @Query('page') page?: string,
      @Query('limit') limit?: string,
      @Query('search') search?: string,
      @Query('sortBy') sortBy?: string,
      @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.productWriteService.findAllBySeller(req.user.id, status, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      sortBy,
      sortOrder,
    });
  }

  // Wiki 0068 A1: đọc 1 SP của chính seller để prefill form chỉnh sửa.
  // Đặt sau @Get('my-products') để route tĩnh không bị ':id' nuốt.
  @Get(':id')
  findOneForEdit(@Request() req, @Param('id') id: string) {
    return this.productWriteService.findOneForEdit(req.user.id, id);
  }
}