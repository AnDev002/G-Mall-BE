import { Module } from '@nestjs/common';
import { ProductReadService } from './services/product-read.service';
import { ProductWriteService } from './services/product-write.service';
import { ProductCacheService } from './services/product-cache.service';
import { SellerProductController } from './controllers/seller-product.controller';
import { StoreProductController } from './controllers/store-product.controller';
import { AdminProductController } from './controllers/admin-product.controller'; // Import mới
import { CategoryModule } from '../category/category.module';
import { ProductAutoTagService } from './services/product-auto-tag.service';
import { ImageSearchModule } from '../image-search/image-search.module'; // wiki 0052
import { SystemSettingModule } from '../../common/services/system-setting.module'; // wiki 0105

@Module({
  imports: [
    CategoryModule, // [FIX] Thêm dòng này để ProductReadService dùng được CategoryService
    ImageSearchModule, // wiki 0052: auto-index sau create/update SP
    SystemSettingModule, // wiki 0105: đọc trần % hoa hồng AFFILIATE_MAX_RATE
  ],
  controllers: [
    StoreProductController,  // Cho Khách hàng (Buyer)
    SellerProductController, // Cho Người bán (Seller)
    AdminProductController,  // Cho Quản trị viên (Admin)
  ],
  providers: [
    ProductReadService,
    ProductWriteService,
    ProductCacheService,
    ProductAutoTagService
  ],
  exports: [
    ProductReadService,
    ProductWriteService,
    ProductCacheService
  ],
})
export class ProductModule {}