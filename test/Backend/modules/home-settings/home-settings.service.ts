// Backend-2.2/modules/home-settings/home-settings.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CategoryService } from '../category/category.service';

@Injectable()
export class HomeSettingsService {
  constructor(private prisma: PrismaService, private categoryService: CategoryService) {}


  private async getProductsByCategory(categoryId: string, limit: number = 6) {
    if (!categoryId) return [];
    
    // Lấy cả danh mục con
    const descendantIds = await this.categoryService.getAllDescendantIds(categoryId);
    const categoryIds = [...descendantIds, categoryId];

    return this.prisma.product.findMany({
      where: { 
        categoryId: { in: categoryIds },
        status: 'ACTIVE'
      },
      orderBy: { createdAt: 'desc' },
      include: { 
        variants: true,
        category: true
      },
      take: limit // Giới hạn số lượng (với 2 cột thì chỉ cần hiển thị ít hơn)
    });
  }

  private async getDataForColumn(columnConfig: any, limit: number = 30) {
    if (!columnConfig) return [];

    // CASE 1: Lấy thủ công (Manual)
    if (columnConfig.sourceType === 'MANUAL' && Array.isArray(columnConfig.productIds) && columnConfig.productIds.length > 0) {
      return this.prisma.product.findMany({
        where: { 
          id: { in: columnConfig.productIds }, 
          status: 'ACTIVE' 
        },
        include: { 
          variants: true, 
          category: true 
        },
        take: limit // Lấy tối đa theo limit (30) để frontend random
      });
    }

    // CASE 2: Lấy theo danh mục (Category) - Mặc định
    return this.getProductsByCategory(columnConfig.categoryId, limit);
  }
  
  // 1. Client: Lấy layout hiển thị
  async getHomeLayout() {
    const sections = await this.prisma.homeSection.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: { category: true }
    });

    const enrichedSections = await Promise.all(sections.map(async (section: any) => {
      let products: any = [];
      const config = section.config || {};
      
      // === FIX: XỬ LÝ RIÊNG CHO KHỐI 2 CỘT (SPLIT) ===
      if (section.type === 'CATEGORY_TWO_ROW') {
        // [QUAN TRỌNG] Tăng limit lên 30 để Frontend có dữ liệu mà shuffle (random)
        const fetchLimit = 30; 

        // Lấy dữ liệu song song cho cả trái và phải dựa trên config từng bên
        const [leftProducts, rightProducts] = await Promise.all([
          this.getDataForColumn(config.left, fetchLimit),
          this.getDataForColumn(config.right, fetchLimit)
        ]);

        // Gán ngược lại vào config
        if (config.left) config.left.products = leftProducts;
        if (config.right) config.right.products = rightProducts;

        return { ...section, config }; 
      }
      
      // === LOGIC CŨ CHO KHỐI DANH MỤC ĐƠN ===
      const sourceType = config.sourceType || 'CATEGORY';

      if (sourceType === 'MANUAL' && config.productIds?.length > 0) {
        products = await this.prisma.product.findMany({
          where: { id: { in: config.productIds }, status: 'ACTIVE' },
          include: { variants: true, category: true },
          take: 12
        });
      } else if (section.categoryId) {
        products = await this.getProductsByCategory(section.categoryId, 12);
      }

      return {
        ...section,
        products,
      };
    }));

    return enrichedSections;
  }

  // 2. Admin: Lấy danh sách quản lý
  async getAllSections() {
    return this.prisma.homeSection.findMany({ orderBy: { order: 'asc' } });
  }

  // Helper để làm sạch dữ liệu (Fix lỗi P2003)
  private cleanInput(data: any) {
    return {
      title: data.title || 'Untitled Section',
      type: data.type,
      isActive: data.isActive !== undefined ? data.isActive : true,
      categoryId: (data.categoryId && data.categoryId.length > 0) ? data.categoryId : null,
      
      // Lưu config: Giữ nguyên cấu trúc nested (left/right) từ frontend gửi lên
      config: {
        ...(data.config || {}),
        // Các trường top-level (dành cho khối đơn)
        productIds: data.productIds || [], 
        sourceType: data.sourceType || 'CATEGORY'
      }
    };
  }

  // 3. Admin: Tạo mới
  async createSection(data: any) {
    const lastItem = await this.prisma.homeSection.findFirst({ orderBy: { order: 'desc' } });
    const newOrder = lastItem ? lastItem.order + 1 : 0;
    
    // Gọi hàm cleanInput
    const cleanData = this.cleanInput(data);

    return this.prisma.homeSection.create({
      data: {
        ...cleanData,
        order: newOrder,
      },
    });
  }

  // 4. Admin: Cập nhật
  async updateSection(id: string, data: any) {
    const cleanData = this.cleanInput(data);
    return this.prisma.homeSection.update({
      where: { id },
      data: cleanData,
    });
  }

  async deleteSection(id: string) {
    return this.prisma.homeSection.delete({ where: { id } });
  }

  async reorderSections(ids: string[]) {
    return this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.homeSection.update({
          where: { id },
          data: { order: index },
        })
      )
    );
  }
}