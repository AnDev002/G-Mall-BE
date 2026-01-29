// Backend-2.2/modules/home-settings/home-settings.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class HomeSettingsService {
  constructor(private prisma: PrismaService) {}

  // 1. Client: Lấy layout hiển thị
  async getHomeLayout() {
    // Lấy cấu hình các section
    const sections = await this.prisma.homeSection.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });

    // Map qua từng section để fill data sản phẩm
    const enrichedSections = await Promise.all(sections.map(async (section: any) => {
      let products: any = [];

      // TH1: Chọn sản phẩm thủ công (Manual Selection)
      // Giả sử DB bạn lưu mảng ID vào field 'productIds' (Json hoặc Array String) trong HomeSection
      // Hoặc lưu trong config: section.config.productIds
      const manualIds = section.config?.productIds || [];
      
      if (manualIds.length > 0) {
        products = await this.prisma.product.findMany({
          where: { 
            id: { in: manualIds },
            isActive: true 
          },
          include: { variants: true }, // Lấy biến thể để hiện giá
          take: 12
        });
      } 
      // TH2: Lấy theo danh mục (Category Auto)
      else if (section.categoryId) {
        // Lấy sản phẩm thuộc category đó (hoặc con của nó - tuỳ logic query của bạn)
        products = await this.prisma.product.findMany({
          where: { 
            categoryId: section.categoryId,
            isActive: true
          },
          orderBy: { createdAt: 'desc' },
          include: { variants: true },
          take: 12
        });
      }

      return {
        ...section,
        products, // Trả về danh sách sản phẩm trực tiếp ở root của object section
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