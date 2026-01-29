import { Controller, Get, UseGuards, Param, Delete, Patch, Body, Query } from '@nestjs/common';
import { ProductWriteService } from '../services/product-write.service'; // Dùng Write Service
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { ProductStatus } from '@prisma/client';
import { ProductReadService } from '../services/product-read.service';
import { CategoryService } from '../../category/category.service';

@Controller('admin/products') // Prefix riêng cho Admin
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN) // Chỉ Admin mới vào được
export class AdminProductController {
  constructor(private readonly productWriteService: ProductWriteService, private readonly prisma: PrismaService, private readonly productReadService: ProductReadService, private readonly categoryService: CategoryService) {}

  // Admin cần xem danh sách full (kể cả hàng ẩn/hết hàng) để quản lý
  @Get()
  async findAll(
    @Query('status') status: string, 
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('search') search: string,
    @Query('categoryId') categoryId: string
 ) {
     const whereCondition: any = {};
     const pageNum = Number(page) || 1;
     const limitNum = Number(limit) || 20;
     const skip = (pageNum - 1) * limitNum;
    console.log('Admin Filter Params:', { status, search, categoryId });
     // 1. Filter theo status
     if (status && status !== 'ALL') {
         whereCondition.status = status as ProductStatus;
     }

     // 2. Filter theo Search
     if (search) {
         whereCondition.OR = [
             { name: { contains: search } }, // MySQL default case-insensitive (hoặc thêm mode: 'insensitive' nếu dùng Postgres)
             { sku: { contains: search } }
         ];
     }

     // 3. [THÊM] Filter theo Category (Đệ quy)
     if (categoryId) {
        // Lấy tất cả ID con cháu của category được chọn
        const allCategoryIds = await this.categoryService.getAllDescendantIds(categoryId);
        whereCondition.categoryId = { in: allCategoryIds };
     }

     // 4. Query DB & Pagination
     // Cần dùng transaction hoặc Promise.all để lấy cả data và tổng count
     const [products, total] = await Promise.all([
        this.prisma.product.findMany({
            where: whereCondition,
            include: { 
                shop: { select: { id: true, name: true, avatar: true } }, 
                brandRel: { select: { id: true, name: true } },
                category: { select: { id: true, name: true } }, // [THÊM] Lấy tên danh mục để hiển thị nếu cần
                _count: { select: { variants: true } } 
            },
            orderBy: { createdAt: 'desc' },
            take: limitNum,
            skip: skip
        }),
        this.prisma.product.count({ where: whereCondition })
     ]);

     return {
         data: products,
         meta: {
             total,
             page: pageNum,
             totalPages: Math.ceil(total / limitNum)
         }
     };
  }

  @Patch('bulk-approval')
  @Roles(Role.ADMIN)
  async bulkApprove(
    @Body() body: { ids: string[], status: 'ACTIVE' | 'REJECTED', reason?: string }
  ) {
    return this.productWriteService.bulkApproveProducts(body.ids, body.status, body.reason);
  }

  // 2. API Duyệt / Từ chối (Đã xóa hàm trùng lặp)
  @Patch(':id/approval')
  @Roles(Role.ADMIN)
  async approveProduct(
      @Param('id') id: string, 
      @Body() body: { status: 'ACTIVE' | 'REJECTED', reason?: string }
  ) {
      return this.productWriteService.approveProduct(id, body.status, body.reason);
  }
  
  @Get('search-for-blog')
  async searchForBlog(@Query('q') query: string) {
    if (!query) return [];
    return this.productReadService.searchProductsForAdmin(query);
  }
  
  // Admin xem chi tiết để duyệt/kiểm tra
  // Lưu ý: WriteService thường query trực tiếp DB Master, đảm bảo dữ liệu mới nhất
  @Get(':id')
  async findOne(@Param('id') id: string) {
    // Return chi tiết kèm thông tin Shop
    return this.prisma.product.findUnique({
        where: { id },
        include: { 
            shop: true,
            options: { include: { values: true } },
            variants: true,
            category: true
        }
    });
  }

  // Ví dụ: Admin xóa sản phẩm vi phạm
  /*
  @Delete(':id')
  delete(@Param('id') id: string) {
     return this.productWriteService.softDelete(id);
  }
  */
}