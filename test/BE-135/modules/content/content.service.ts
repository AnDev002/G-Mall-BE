import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateBannerDto, SaveConfigDto } from './dto/content.dto';

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);
  constructor(private prisma: PrismaService) {}

  // --- Public ---
  async getBanners(location?: string) {
    return this.prisma.banner.findMany({
      where: { 
        isActive: true, 
        ...(location ? { location } : {}) 
      },
      orderBy: { order: 'asc' },
    });
  }

  async getConfig(key: string) {
    const config = await this.prisma.systemConfig.findUnique({ where: { key } });
    // [FIX] Logic đọc: Nếu là chuỗi thì parse, nếu là object thì giữ nguyên
    if (config?.value) {
        try {
            return typeof config.value === 'string' ? JSON.parse(config.value) : config.value;
        } catch (e) {
            return config.value; // Fallback nếu parse lỗi
        }
    }
    return null;
  }

  // --- Admin ---
  async getAllBannersAdmin() {
    return this.prisma.banner.findMany({
      orderBy: [{ location: 'asc' }, { order: 'asc' }],
    });
  }

  async createBanner(data: CreateBannerDto) {
    // Tự động gán order cuối cùng + 1
    if (data.order === undefined) {
      const lastItem = await this.prisma.banner.findFirst({
        where: { location: data.location },
        orderBy: { order: 'desc' }
      });
      data.order = lastItem ? lastItem.order + 1 : 0;
    }
    return this.prisma.banner.create({ data });
  }

  async updateBanner(id: string, data: Partial<CreateBannerDto>) {
    return this.prisma.banner.update({
      where: { id },
      data,
    });
  }

  async deleteBanner(id: string) {
    return this.prisma.banner.delete({ where: { id } });
  }

  async reorderBanners(payload: { id: string; order: number }[] | { items: { id: string; order: number }[] }) {
    // Xử lý trường hợp FE gửi mảng hoặc object
    const items = Array.isArray(payload) ? payload : payload.items;
    
    // Dùng transaction để update hàng loạt an toàn
    return this.prisma.$transaction(
      items.map((item) =>
        this.prisma.banner.update({
          where: { id: item.id },
          data: { order: item.order },
        })
      )
    );
  }

  async saveConfig(dto: SaveConfigDto) {
    this.logger.log(`🔥 [SAVE CONFIG] Key: ${dto.key}`);
    
    // 1. Xử lý Value: Buộc chuyển thành String JSON để lưu vào DB (nếu DB là Text)
    let valueToSave = dto.value;

    // Nếu dữ liệu gửi lên là Object/Array, ta ép thành chuỗi JSON
    // Điều này đảm bảo khi reload trang, hàm getConfig bên trên có thể JSON.parse lại được.
    if (typeof dto.value === 'object' && dto.value !== null) {
        valueToSave = JSON.stringify(dto.value);
    }

    this.logger.log(`   -> Saving Value Length: ${valueToSave?.length || 0}`);

    try {
        const result = await this.prisma.systemConfig.upsert({
            where: { key: dto.key },
            create: {
                key: dto.key,
                value: valueToSave,
                description: `Config created/updated via Admin at ${new Date().toISOString()}`
            },
            update: {
                value: valueToSave,
                // Cập nhật thời gian update nếu có field updatedAt
            }
        });
        this.logger.log(`✅ [SAVE SUCCESS] Config saved for ${dto.key}`);
        return result;
    } catch (error) {
        this.logger.error(`❌ [SAVE ERROR] Failed to save config ${dto.key}`, error);
        throw error;
    }
  }
}