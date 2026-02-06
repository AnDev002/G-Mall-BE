import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { ProductReadService } from './product-read.service';
import { ProductCacheService } from './product-cache.service';
import { AUTO_TAG_RULES } from '../constants/tag-rules';

@Injectable()
export class ProductAutoTagService {
  private readonly logger = new Logger(ProductAutoTagService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly productRead: ProductReadService,
    private readonly productCache: ProductCacheService
  ) {}

  /**
   * Quét toàn bộ sản phẩm ACTIVE và cập nhật lại Tags
   */
  async scanAndTagAllProducts() {
    this.logger.log('🚀 Starting Auto-Tagging Process...');
    
    // 1. Lấy sản phẩm (BỎ isDeleted, chỉ lấy status ACTIVE)
    const products = await this.prisma.product.findMany({
      where: { 
          status: 'ACTIVE' // [ĐÃ SỬA] Chỉ lọc theo status
      },
      // Select đủ trường để sync qua Redis không bị lỗi thiếu data
      include: {
        shop: { select: { id: true, name: true, avatar: true } },
        variants: true,
        category: true
      }
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

        // Apply Rules
        AUTO_TAG_RULES.forEach(rule => {
          const isMatch = rule.keywords.some(k => textToScan.includes(k.toLowerCase()));
          if (isMatch) tagSet.add(rule.code);
        });

        // Chỉ update nếu có thay đổi
        if (tagSet.size !== originalSize) {
          const newTags = Array.from(tagSet);

          // A. Update Database
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

          // B. Sync Redis Cache & Search Index
          await this.productCache.invalidateProduct(updatedProduct.id, updatedProduct.slug);
          await this.productRead.syncProductToRedis(updatedProduct);

          updatedCount++;
        }
      } catch (err: any) {
        this.logger.error(`Failed to tag product ${product.id}: ${err.message}`);
        errors.push(product.id);
      }
    }

    this.logger.log(`✅ Auto-tagging finished. Updated: ${updatedCount}/${products.length} products.`);
    
    return {
      totalScanned: products.length,
      updated: updatedCount,
      errors: errors.length
    };
  }

  /**
   * Lấy thống kê số lượng sản phẩm theo từng Tag
   */
  async getTagStats() {
    // [ĐÃ SỬA] Bỏ isDeleted: false
    const products = await this.prisma.product.findMany({
      where: { status: 'ACTIVE' }, 
      select: { systemTags: true }
    });

    const counts: Record<string, number> = {};

    products.forEach(p => {
      try {
        const tags = typeof p.systemTags === 'string' ? JSON.parse(p.systemTags) : p.systemTags;
        if (Array.isArray(tags)) {
          tags.forEach((t: string) => {
            counts[t] = (counts[t] || 0) + 1;
          });
        }
      } catch {}
    });

    return AUTO_TAG_RULES.map(rule => ({
      ...rule,
      count: counts[rule.code] || 0
    })).sort((a, b) => b.count - a.count);
  }
}