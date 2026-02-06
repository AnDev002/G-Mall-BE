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
  async scanAndTagAllProducts(customRules?: TagRule[]) {
    this.logger.log('🚀 Bắt đầu quy trình Auto-Tag sản phẩm...');
    
    // Nếu không truyền rules, dùng rules mặc định (hoặc lấy từ DB)
    const activeRules = customRules || []; 

    if (activeRules.length === 0) {
        return { message: "Không có luật Tag nào được cung cấp." };
    }

    // 1. Lấy toàn bộ sản phẩm đang ACTIVE
    const products = await this.prisma.product.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, description: true, slug: true, systemTags: true }
    });

    let updatedCount = 0;
    const errors: string[] = [];

    // 2. Xử lý từng sản phẩm
    for (const product of products) {
      try {
        const textToScan = (product.name + ' ' + (product.description || '')).toLowerCase();
        
        // Parse tags hiện tại
        let currentTags: string[] = [];
        try {
          if (typeof product.systemTags === 'string') {
             currentTags = JSON.parse(product.systemTags);
          } else if (Array.isArray(product.systemTags)) {
             currentTags = product.systemTags as any;
          }
        } catch (e) {
          currentTags = [];
        }

        const tagSet = new Set(currentTags);
        const originalSize = tagSet.size;

        // --- CORE LOGIC: So khớp từ khóa ---
        activeRules.forEach(rule => {
          // Kiểm tra xem sản phẩm có chứa bất kỳ keyword nào của rule không
          const isMatch = rule.keywords.some(k => textToScan.includes(k.toLowerCase()));
          
          if (isMatch) {
             tagSet.add(rule.code);
          } else {
             // Tùy chọn: Có muốn XÓA tag nếu không còn khớp keyword không?
             // Nếu muốn cơ chế "đồng bộ hoàn toàn", hãy uncomment dòng dưới:
             // tagSet.delete(rule.code); 
          }
        });

        // Chỉ update DB nếu có thay đổi
        if (tagSet.size !== originalSize /* || logic check delete */) {
          const newTags = Array.from(tagSet);

          const updatedProduct = await this.prisma.product.update({
            where: { id: product.id },
            data: { 
                systemTags: JSON.stringify(newTags) as any 
            },
            include: {
                shop: { select: { id: true, name: true, avatar: true } },
                variants: true,
                category: true
            }
          });

          // Sync Redis & Search Engine
          await this.productCache.invalidateProduct(updatedProduct.id, updatedProduct.slug);
          await this.productRead.syncProductToRedis(updatedProduct);

          updatedCount++;
        }
      } catch (err: any) {
        errors.push(product.id);
      }
    }

    this.logger.log(`✅ Hoàn tất Auto-tag. Đã cập nhật: ${updatedCount}/${products.length} sản phẩm.`);
    
    return {
      totalScanned: products.length,
      updated: updatedCount,
      errors: errors.length,
      appliedRules: activeRules.length
    };
  }
}