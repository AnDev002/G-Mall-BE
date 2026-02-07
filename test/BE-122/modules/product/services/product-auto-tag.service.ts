import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { ProductReadService } from './product-read.service';
import { ProductCacheService } from './product-cache.service';

// Định nghĩa kiểu dữ liệu cho luật tag
export interface TagRule {
  code: string;       // VD: 'recipient:baby'
  label: string;      // VD: 'Trẻ sơ sinh'
  keywords: string[]; // VD: ['sơ sinh', 'tã', 'bỉm', 'newborn']
}

@Injectable()
export class ProductAutoTagService {
  private readonly logger = new Logger(ProductAutoTagService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly productRead: ProductReadService,
    private readonly productCache: ProductCacheService
  ) {}

  /**
   * API Trigger quét sản phẩm theo danh sách luật (Rules) được gửi từ FE
   * Hoặc lấy từ SystemConfig trong DB nếu bạn lưu cấu hình ở đó.
   */
  async scanAndTagAllProducts(rules: { code: string, keywords: string[] }[]) {
  // 1. Lấy tất cả sản phẩm đang active
  const products = await this.prisma.product.findMany({ 
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, description: true, systemTags: true }
  });

  let updatedCount = 0;

  for (const product of products) {
      const searchText = (product.name + ' ' + (product.description || '')).toLowerCase();
      let currentTags = (product.systemTags as string[]) || [];
      const originalTags = [...currentTags];

      // 2. Loop qua rules để check
      for (const rule of rules) {
          const hasKeyword = rule.keywords.some(k => searchText.includes(k.toLowerCase()));
          
          if (hasKeyword) {
              if (!currentTags.includes(rule.code)) {
                  currentTags.push(rule.code);
              }
          } else {
              // (Optional) Nếu không còn chứa keyword, có thể gỡ tag cũ ra?
              // Tùy nghiệp vụ, ở đây ta chỉ thêm vào.
          }
      }

      // 3. Nếu tags thay đổi thì update DB
      if (JSON.stringify(originalTags) !== JSON.stringify(currentTags)) {
          await this.prisma.product.update({
              where: { id: product.id },
              data: { systemTags: currentTags } // Prisma tự handle JSON array mapping
          });
          updatedCount++;
      }
  }

  return { updatedCount };
}
}