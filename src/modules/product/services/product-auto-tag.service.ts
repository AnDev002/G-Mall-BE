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
function removeAccents(str: string) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
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
      const products = await this.prisma.product.findMany({ 
          where: { status: 'ACTIVE' },
          select: { id: true, name: true, description: true, systemTags: true }
      });

      let updatedCount = 0;

      for (const product of products) {
          // Tạo chuỗi text để search: gộp tên và mô tả, bỏ dấu
          const rawText = (product.name + ' ' + (product.description || ''));
          const normalizedText = removeAccents(rawText); 
          
          let currentTags = (product.systemTags as string[]) || [];
          const originalTags = [...currentTags];

          for (const rule of rules) {
              // Check xem text sản phẩm có chứa keyword nào không
              const hasKeyword = rule.keywords.some(k => 
                  normalizedText.includes(removeAccents(k)) || // So sánh không dấu (mạnh hơn)
                  rawText.toLowerCase().includes(k.toLowerCase()) // So sánh có dấu (chính xác)
              );
              
              if (hasKeyword) {
                  if (!currentTags.includes(rule.code)) {
                      currentTags.push(rule.code);
                  }
              }
          }

          if (JSON.stringify(originalTags) !== JSON.stringify(currentTags)) {
              await this.prisma.product.update({
                  where: { id: product.id },
                  data: { systemTags: currentTags }
              });
              updatedCount++;
          }
      }

      return { updatedCount };
  }
}