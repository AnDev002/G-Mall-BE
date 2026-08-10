// type: uploaded file
// fileName: Back-end/modules/product/controllers/admin-product.controller.ts

import { Controller, Get, UseGuards, Param, Delete, Patch, Body, Query, Header, Post } from '@nestjs/common'; // [GENIUS] Thêm Header
import { ProductWriteService } from '../services/product-write.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt.guard';
import { getPagination } from 'src/common/utils/pagination.util';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { ProductStatus } from '@prisma/client';
import { ProductReadService } from '../services/product-read.service';
import { CategoryService } from '../../category/category.service';
import { ProductAutoTagService, TagRule } from '../services/product-auto-tag.service';

@Controller('admin/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminProductController {
  constructor(private readonly productWriteService: ProductWriteService, private readonly prisma: PrismaService, private readonly productReadService: ProductReadService, private readonly categoryService: CategoryService, private readonly productAutoTagService: ProductAutoTagService) {}

  // Admin cần xem danh sách full (kể cả hàng ẩn/hết hàng) để quản lý
  @Get()
  // [GENIUS FIX] Thêm Header để chặn Cache tuyệt đối. Admin cần dữ liệu tươi 100%.
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async findAll(
  @Query('status') status: string, 
  @Query('page') page: string,
  @Query('limit') limit: string,
  @Query('search') search: string,
  @Query('categoryId') categoryId: string
) {
   const whereCondition: any = {};
   // Wiki 0074: clamp page/limit (page=-1 → skip âm → Prisma 500).
   const { page: pageNum, limit: limitNum, skip } = getPagination(page, limit, { defaultLimit: 20 });

   // 1. Filter theo status
   if (status && status !== 'ALL') {
       whereCondition.status = status as ProductStatus;
   }

   // 2. Filter theo Search
   if (search) {
       whereCondition.OR = [
           { name: { contains: search } }, 
           { slug: { contains: search } }, 
           { variants: { some: { sku: { contains: search } } } } 
       ];
   }

   // 3. Filter theo Category
   if (categoryId) {
      const allCategoryIds = await this.categoryService.getAllDescendantIds(categoryId);
      whereCondition.categoryId = { in: allCategoryIds };
   }

   // 4. Query DB & Pagination
   // [OPTIMIZATION] Dùng $transaction để đảm bảo tính nhất quán và performance tốt hơn chút
   const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
          where: whereCondition,
          include: { 
              shop: { select: { id: true, name: true, avatar: true } }, 
              brandRel: { select: { id: true, name: true } },
              category: { select: { id: true, name: true } },
              _count: { select: { variants: true } } 
          },
          orderBy: { createdAt: 'desc' }, // Mới nhất lên đầu để admin dễ thấy cái vừa sửa
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

  @Patch(':id/system-tags')
  @Roles(Role.ADMIN)
  async updateSystemTags(
  @Param('id') id: string,
  @Body() body: { systemTags: string[] }
  ) {
    // Bây giờ hàm này đã tồn tại, lỗi sẽ biến mất
    return this.productWriteService.updateProductTags(id, body.systemTags);
  }

  // 2. API Duyệt / Từ chối
  @Patch(':id/approval')
  @Roles(Role.ADMIN)
  async approveProduct(
      @Param('id') id: string, 
      @Body() body: { status: 'ACTIVE' | 'REJECTED', reason?: string }
  ) {
      return this.productWriteService.approveProduct(id, body.status, body.reason);
  }

  
  @Get('selector')
  async getProductSelector(@Query() query: any) {
      return this.productReadService.getAdminProductSelector(query);
  }
  // 2. API Tìm kiếm sản phẩm (có hỗ trợ filter shopId)
  // URL: GET /products/search?keyword=abc&shopId=...
  @Get('search')
  async search(@Query() query: any) {
    return this.productReadService.searchPublic(query);
  }

  @Delete('delete-all/cleanup')
  @Roles(Role.ADMIN)
  async deleteAllProducts() {
      return this.productWriteService.deleteAll();
  }
  
  @Get('search-for-blog')
  async searchForBlog(@Query('q') query: string) {
    if (!query) return [];
    return this.productReadService.searchProductsForAdmin(query);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async deleteProduct(@Param('id') id: string) {
      return this.productWriteService.delete(id);
  }

  @Post('auto-tag/scan')
    @Roles(Role.ADMIN)
    async triggerAutoTag(@Body() body: { rules: TagRule[] }) {
        return this.productAutoTagService.scanAndTagAllProducts(body.rules);
    }

  // 4. API Xoá nhiều sản phẩm
  @Delete('bulk/delete') // DELETE body có thể không hoạt động ở một số proxy, nhưng chuẩn REST vẫn cho phép
  @Roles(Role.ADMIN)
  async bulkDeleteProduct(@Body() body: { ids: string[] }) {
      return this.productWriteService.bulkDelete(body.ids);
  }

  /**
   * wiki 0103 — Lấy nhiều sản phẩm theo danh sách id.
   *
   * FE `ProductSelector` (dùng ở tạo voucher, cấu hình trang chủ, flash-sale của
   * seller) gọi endpoint này để hiện lại các sản phẩm ĐÃ CHỌN khi mở form sửa.
   * Trước đây endpoint KHÔNG tồn tại — comment trong FE tự ghi "dùng tạm endpoint
   * giả định" — nên gọi luôn 404, danh sách đã chọn hiện ra rỗng và admin dễ lưu
   * đè mất lựa chọn cũ.
   *
   * Trả về MẢNG THẲNG (không bọc `{data}`) — `apiClient` của FE trả nguyên body.
   * `shop` chỉ lấy id+name vì FE chỉ hiển thị tên shop.
   */
  @Post('get-by-ids')
  @Roles(Role.ADMIN)
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  async getByIds(@Body() body: { ids?: unknown }) {
    const raw = Array.isArray(body?.ids) ? body.ids : [];
    // Lọc phần tử không phải chuỗi để không đẩy giá trị lạ xuống Prisma (=> 500),
    // bỏ trùng, và chặn trên 200 id cho một lần gọi.
    const ids = [...new Set(raw.filter((v): v is string => typeof v === 'string' && v.length > 0))]
      .slice(0, 200);
    if (ids.length === 0) return [];

    const rows = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        price: true,
        images: true,
        status: true,
        stock: true,
        shop: { select: { id: true, name: true } },
      },
    });

    // `price` là Prisma Decimal → JSON.stringify ra CHUỖI ("123456"), không phải số.
    // Mọi endpoint sản phẩm khác đều đã `Number(...)` (vd findOnePublic); giữ đồng nhất,
    // nếu không FE hiển thị giá mất dấu phân cách và mọi phép tính thành nối chuỗi.
    return rows.map((p) => ({ ...p, price: Number(p.price) }));
  }
  
  @Get(':id')
  // [GENIUS FIX] Chi tiết cũng không nên cache khi admin đang edit/duyệt
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  async findOne(@Param('id') id: string) {
    return this.prisma.product.findUnique({
        where: { id },
        include: { 
            shop: true,
            // wiki 0095 B2: order theo position để admin thấy đúng thứ tự phân loại
            // seller đã set, và khớp variants[].tierIndex khi duyệt sản phẩm.
            options: { include: { values: { orderBy: { position: 'asc' } } }, orderBy: { position: 'asc' } },
            variants: true,
            category: true
        }
    });
  }
}