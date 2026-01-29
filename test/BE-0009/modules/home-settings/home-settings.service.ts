// Backend-2.2/modules/home-settings/home-settings.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CategoryService } from '../category/category.service';

@Injectable()
export class HomeSettingsService {
  constructor(private prisma: PrismaService, private categoryService: CategoryService) {}

  // 1. Client: Lấy layout hiển thị
  async getHomeLayout() {
    const sections = await this.prisma.homeSection.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: {
        category: true
      }
    });

    const enrichedSections = await Promise.all(sections.map(async (section: any) => {
      let products: any = [];
      const config = section.config || {};
      
      const sourceType = config.sourceType || 'CATEGORY';

      // TH1: Chọn sản phẩm thủ công
      if (sourceType === 'MANUAL' && config.productIds?.length > 0) {
        products = await this.prisma.product.findMany({
          where: { 
            id: { in: config.productIds },
            status: 'ACTIVE'
          },
          include: { 
            variants: true,
            // [ĐÃ SỬA] Xóa 'images: true' vì đây là field, Prisma tự động lấy về
            category: true 
          },
          take: 12
        });
      } 
      // TH2: Lấy theo danh mục
      else if (section.categoryId) {
        const descendantIds = await this.categoryService.getAllDescendantIds(section.categoryId);
        const categoryIds = [...descendantIds, section.categoryId];

        products = await this.prisma.product.findMany({
          where: { 
            categoryId: { in: categoryIds },
            status: 'ACTIVE'
          },
          orderBy: { createdAt: 'desc' },
          include: { 
            variants: true,
            // [ĐÃ SỬA] Xóa 'images: true'
            category: true
          },
          take: 12
        });
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
      
      // Lưu config bao gồm cả productIds nếu chọn thủ công
      config: {
        ...(data.config || {}),
        productIds: data.productIds || [], // Mảng ID sản phẩm chọn tay
        sourceType: data.sourceType || 'CATEGORY' // 'CATEGORY' | 'MANUAL'
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