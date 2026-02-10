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
    private readonly productRead: ProductReadService, // Đã inject sẵn, rất tốt
    private readonly productCache: ProductCacheService
  ) {}

  async scanAndTagAllProducts(rules: { code: string, keywords: string[] }[]) {
      // [OPTIMIZE]: Lấy thêm các trường cần thiết để sync Redis luôn (price, slug, images...)
      // để đỡ phải query lại DB trong hàm sync
      const products = await this.prisma.product.findMany({ 
          where: { status: 'ACTIVE' },
          // Chọn đủ trường để sync lại Redis
          include: { variants: true } 
      });

      let updatedCount = 0;

      for (const product of products) {
          const rawText = (product.name + ' ' + (product.description || ''));
          const normalizedText = removeAccents(rawText); 
          
          let currentTags = (product.systemTags as string[]) || [];
          const originalTags = [...currentTags];

          for (const rule of rules) {
              const hasKeyword = rule.keywords.some(k => 
                  normalizedText.includes(removeAccents(k)) || 
                  rawText.toLowerCase().includes(k.toLowerCase()) 
              );
              
              if (hasKeyword) {
                  if (!currentTags.includes(rule.code)) {
                      currentTags.push(rule.code);
                  }
              }
          }

          // Nếu có thay đổi Tag -> Update DB -> Update Redis
          if (JSON.stringify(originalTags) !== JSON.stringify(currentTags)) {
              
              // 1. Update DB
              const updatedProduct = await this.prisma.product.update({
                  where: { id: product.id },
                  data: { systemTags: currentTags },
                  // Include lại để đảm bảo dữ liệu đầy đủ nhất
                  include: { variants: true, category: true }
              });
              
              // 2. [FIX QUAN TRỌNG] Sync ngay sang Redis
              await this.productRead.syncProductToRedis(updatedProduct);
              
              updatedCount++;
              this.logger.log(`Auto-tagged & Synced: ${product.name} -> Tags: ${currentTags.join(', ')}`);
          }
      }

      return { updatedCount };
  }
}