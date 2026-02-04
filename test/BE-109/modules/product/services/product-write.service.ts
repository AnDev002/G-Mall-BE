// type: uploaded file
// fileName: Back-end/modules/product/services/product-write.service.ts

import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { ProductCacheService } from './product-cache.service';
import { DiscountType, Prisma, ProductStatus } from '@prisma/client';
import { UpdateProductDiscountDto, UpdateProductDto } from '../dto/update-product.dto';
import { ProductReadService } from './product-read.service';
@Injectable()
export class ProductWriteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productCache: ProductCacheService,
    private readonly productReadService: ProductReadService,
  ) {}

  // --- 1. Tạo sản phẩm (Updated for Shop Module) ---
  async create(userId: string, dto: CreateProductDto) {
    // [MỚI] Bước 1: Tìm Shop của User
    const shop = await this.prisma.shop.findUnique({
      where: { ownerId: userId }
    });

    if (!shop) {
      throw new ForbiddenException('Bạn chưa đăng ký Cửa hàng (Shop). Vui lòng đăng ký trước khi tạo sản phẩm.');
    }

    if (shop.status === 'BANNED' || shop.status === 'PENDING') {
       throw new ForbiddenException(`Shop của bạn đang ở trạng thái: ${shop.status}. Không thể đăng bán.`);
    }

    // 2. Tách các trường xử lý riêng
    const { 
        crossSellIds,
        tiers, 
        variations, 
        images, 
        price, 
        videos, sizeChart, brand, origin, weight, length, width, height, attributes, 
        brandId,
        categoryId, 
        systemTags,
        ...rest 
    } = dto;

    // Validate logic cơ bản
    if (tiers && tiers.length > 0 && (!variations || variations.length === 0)) {
       throw new BadRequestException('Phải thiết lập biến thể SKU khi có nhóm phân loại');
    }
    // 3. Gộp attributes
    let finalAttributes = attributes;
    try {
        const attrObj = typeof attributes === 'string' ? JSON.parse(attributes) : (attributes || {});
        Object.assign(attrObj, {
             videos, sizeChart, brand, origin, weight, 
             dimensions: { length, width, height },
             systemTags
        });
        finalAttributes = JSON.stringify(attrObj);
    } catch (e) {
        finalAttributes = JSON.stringify({ ...attributes, videos, sizeChart });
    }

    // Tính tổng tồn kho
    const totalStock = variations?.length 
        ? variations.reduce((sum, v) => sum + Number(v.stock), 0) 
        : Number(dto.stock || 0);

    const imageList = Array.isArray(images) ? images : [];

    return await this.prisma.$transaction(async (tx) => {
      // A. Tạo Product Parent
      const product = await tx.product.create({
        data: {
          ...rest,
          category: { connect: { id: categoryId } },
          shop: {
            connect: { id: shop.id } 
          },
          brandRel: brandId ? { connect: { id: brandId } } : undefined,
          price: new Prisma.Decimal(price || 0),
          stock: totalStock,
          slug: this.generateSlug(dto.name),
          images: imageList as any,
          attributes: finalAttributes,
          status: 'PENDING',
        },
      });

      // B. Cross-sell
      if (crossSellIds && crossSellIds.length > 0) {
          const uniqueIds = [...new Set(crossSellIds)]; 
          await tx.productCrossSell.createMany({
              data: uniqueIds.map(relId => ({
                  productId: product.id,
                  relatedProductId: relId
              }))
          });
      }

      // C. Xử lý phân loại (Tiers -> Options)
      if (tiers && tiers.length > 0) {
        for (let i = 0; i < tiers.length; i++) {
           const tierImages = tiers[i].images || [];
           
           if (tiers[i].options && tiers[i].options.length > 0) {
               await tx.productOption.create({
                   data: {
                       productId: product.id,
                       name: tiers[i].name,
                       position: i,
                       values: { 
                           create: tiers[i].options.map((val, idx) => ({ 
                               value: val,
                               image: tierImages[idx] || null,
                               position: idx
                           })) 
                       }
                   }
               });
           }
        }
        
        // D. Tạo Variants (SKU)
        if (variations && variations.length > 0) {
            await tx.productVariant.createMany({
                data: variations.map(v => ({
                    productId: product.id,
                    price: new Prisma.Decimal(v.price),
                    stock: Number(v.stock),
                    sku: v.sku,
                    image: v.imageUrl || null,
                    tierIndex: Array.isArray(v.tierIndex) ? v.tierIndex.join(',') : '', 
                }))
            });
        }
      } else {
         // E. Fallback: Tạo 1 variant mặc định
         await tx.productVariant.create({
            data: {
                productId: product.id,
                price: new Prisma.Decimal(price || 0),
                stock: Number(dto.stock || 0),
                sku: (rest as any).sku || '',
                tierIndex: '', 
            }
         });
      }

      return await tx.product.findUnique({
          where: { id: product.id },
          include: {
              options: { include: { values: true } },
              variants: true
          }
      });
    });
  }

  async updateProductTags(id: string, systemTags: string[]) {
    // 1. Kiểm tra sản phẩm có tồn tại không
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // 2. Cập nhật DB
    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: { systemTags },
      // Include các quan hệ cần thiết để hàm syncRedis không bị lỗi thiếu data
      include: {
        shop: { select: { id: true, name: true, avatar: true } }, 
        category: true
      }
    });

    // 3. Sync lại dữ liệu sang Redis (để Search tìm thấy tag mới ngay lập tức)
    // Lưu ý: Hàm syncProductToRedis bên ReadService cần object product đầy đủ thông tin
    await this.productReadService.syncProductToRedis(updatedProduct);

    return updatedProduct;
  }

  // --- 2. Approve (Giữ nguyên) ---
  async approveProduct(productId: string, status: 'ACTIVE' | 'REJECTED', reason?: string) {
    // 1. Cập nhật DB
    const updatedProduct = await this.prisma.product.update({
      where: { id: productId },
      data: {
        status: status,
        rejectReason: status === 'REJECTED' ? reason : null
      },
      // [QUAN TRỌNG] Include đủ thông tin để Sync sang Redis không bị lỗi (ảnh, shop, v.v.)
      include: {
        shop: { select: { id: true, name: true, avatar: true } },
        variants: true,
      }
    });

    // 2. Xóa Cache chi tiết (để khi click vào xem chi tiết sẽ load lại data mới)
    await this.productCache.invalidateProduct(productId);

    // [QUAN TRỌNG] 3. Nếu là ACTIVE, phải đồng bộ ngay sang Redis Search Index
    if (status === 'ACTIVE') {
        // Gọi hàm sync có sẵn bên ReadService
        await this.productReadService.syncProductToRedis(updatedProduct);
    } else if (status === 'REJECTED') {
        // Nếu từ chối, có thể xóa khỏi Index (nếu trước đó lỡ có) hoặc update status
        // Hàm syncProductToRedis cũng sẽ update status thành REJECTED trong Redis,
        // giúp bộ lọc @status:{ACTIVE} của FT.SEARCH tự động loại bỏ nó.
        await this.productReadService.syncProductToRedis(updatedProduct);
    }

    return updatedProduct;
  }

  async bulkApproveProducts(ids: string[], status: 'ACTIVE' | 'REJECTED', reason?: string) {
    if (!ids || ids.length === 0) return { count: 0 };

    // 1. Cập nhật DB
    // Lưu ý: updateMany không trả về record, nên ta phải update xong rồi query lại
    await this.prisma.product.updateMany({
      where: { id: { in: ids } },
      data: {
        status: status,
        rejectReason: status === 'REJECTED' ? reason : null
      }
    });

    // 2. Lấy danh sách các sản phẩm vừa update để sync Redis
    const products = await this.prisma.product.findMany({
        where: { id: { in: ids } },
        include: {
            shop: { select: { id: true, name: true, avatar: true } }
        }
    });

    // 3. Thực hiện Sync và Invalidate Cache song song
    await Promise.all(products.map(async (product) => {
        // Invalidate cache chi tiết
        await this.productCache.invalidateProduct(product.id);
        
        // Sync sang Redis Search
        await this.productReadService.syncProductToRedis(product);
    }));

    return { count: ids.length };
  }

  async delete(id: string) {
    // 1. Lấy thông tin sản phẩm TRƯỚC khi xóa (để lấy tên xóa cache suggestion)
    const product = await this.prisma.product.findUnique({ 
        where: { id },
        select: { id: true, name: true, slug: true } // Lấy slug để xóa cache detail
    });

    if (!product) {
      throw new NotFoundException('Sản phẩm không tồn tại');
    }

    // 2. Thực hiện xóa trong DB
    await this.prisma.$transaction(async (tx) => {
        await tx.productVariant.deleteMany({ where: { productId: id } });
        await tx.productOption.deleteMany({ where: { productId: id } });
        await tx.productCrossSell.deleteMany({ where: { productId: id } });
        await tx.product.delete({ where: { id } });
    });

    // 3. [FIX] Xóa Cache & Redis Index SAU KHI xóa DB thành công
    // A. Xóa khỏi RediSearch & Suggestion (để hết hiện ở trang chủ/admin)
    await this.productReadService.removeProductFromRedis(product.id, product.name);
    
    // B. Xóa Cache chi tiết (để link cũ vào sẽ 404 thay vì hiện data cũ)
    await this.productCache.invalidateProduct(product.id, product.slug);

    return { success: true, message: 'Deleted successfully' };
  }

  // --- 7. Bulk Delete (CẬP NHẬT) ---
  async bulkDelete(ids: string[]) {
      if (!ids || ids.length === 0) return { count: 0 };

      // 1. Lấy danh sách sản phẩm để xóa cache
      const productsToDelete = await this.prisma.product.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, slug: true }
      });

      // 2. Xóa trong DB
      await this.prisma.$transaction(async (tx) => {
          await tx.productVariant.deleteMany({ where: { productId: { in: ids } } });
          await tx.productOption.deleteMany({ where: { productId: { in: ids } } });
          await tx.productCrossSell.deleteMany({ where: { productId: { in: ids } } });
          await tx.product.deleteMany({ where: { id: { in: ids } } });
      });

      // 3. [FIX] Xóa Cache Loop
      // Dùng Promise.all để xóa song song cho nhanh
      await Promise.all(productsToDelete.map(async (p) => {
          // Xóa Index & Suggestion
          await this.productReadService.removeProductFromRedis(p.id, p.name);
          // Xóa Detail Cache
          await this.productCache.invalidateProduct(p.id, p.slug);
      }));

      return { count: ids.length };
  }

  // --- 3. Update (Updated for Shop Module) ---
  async update(id: string, userId: string, dto: UpdateProductDto) {
    // [MỚI] Tìm Shop trước
    const shop = await this.prisma.shop.findUnique({ where: { ownerId: userId } });
    if (!shop) throw new ForbiddenException('Bạn không có quyền quản lý sản phẩm này');

    // Kiểm tra Product có thuộc Shop này không
    const exists = await this.prisma.product.findFirst({
        where: { id, shopId: shop.id } // [MỚI] Check shopId
    });
    
    if (!exists) throw new NotFoundException('Sản phẩm không tồn tại hoặc không thuộc Shop của bạn');

    const { images, price, brandId, ...rest } = dto;
    
    const updateData: any = { ...rest };
    if (price) updateData.price = new Prisma.Decimal(price);
    if (brandId) {
        updateData.brandRel = { connect: { id: brandId } };
    }
    if (images) updateData.images = Array.isArray(images) ? images : [];

    const updated = await this.prisma.product.update({
      where: { id },
      data: updateData,
    });

    await this.productCache.invalidateProduct(id);
    return updated;
  }

  // --- 4. Search My Products (Updated) ---
  async searchMyProducts(userId: string, keyword: string, limit: number = 10) {
    // [MỚI] Lấy Shop ID
    const shop = await this.prisma.shop.findUnique({ where: { ownerId: userId } });
    if (!shop) return [];

    return this.prisma.product.findMany({
      where: {
        shopId: shop.id, // [MỚI] Filter by shopId
        name: { 
            contains: keyword ? keyword.trim() : '' 
        },
        status: 'ACTIVE',
      },
      take: limit,
      select: {
        id: true,
        name: true,
        price: true,
        images: true,
        stock: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updateDiscount(sellerId: string, productId: string, dto: UpdateProductDiscountDto) {
    // 1. Lấy sản phẩm hiện tại để check quyền và lấy giá gốc
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) throw new NotFoundException('Sản phẩm không tồn tại');
    
    // Check quyền: Phải đúng shop của seller đó
    const shop = await this.prisma.shop.findUnique({ where: { ownerId: sellerId } });
    if (!shop || product.shopId !== shop.id) {
        throw new ForbiddenException('Bạn không có quyền chỉnh sửa sản phẩm này');
    }

    // Nếu chưa có originalPrice, gán nó bằng price hiện tại
    let originalPrice = Number(product.originalPrice);
    if (originalPrice === 0) {
      originalPrice = Number(product.price);
    }

    // 2. Tính toán giá mới (finalPrice)
    let finalPrice = originalPrice;

    if (dto.isDiscountActive) {
      if (dto.discountType === DiscountType.PERCENT) {
        if (dto.discountValue > 100) throw new BadRequestException('Giảm giá không được quá 100%');
        finalPrice = originalPrice * (1 - dto.discountValue / 100);
      } else if (dto.discountType === DiscountType.AMOUNT) {
        if (dto.discountValue > originalPrice) throw new BadRequestException('Số tiền giảm không được lớn hơn giá gốc');
        finalPrice = originalPrice - dto.discountValue;
      }
    } else {
        // Nếu tắt giảm giá, quay về giá gốc
        finalPrice = originalPrice;
    }

    // Đảm bảo giá không âm
    if (finalPrice < 0) finalPrice = 0;

    // 3. Update vào DB
    const updatedProduct = await this.prisma.product.update({
      where: { id: productId },
      data: {
        originalPrice: originalPrice, 
        price: finalPrice,            // Giá bán thực tế (đã giảm)
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        discountStartDate: dto.discountStartDate ? new Date(dto.discountStartDate) : null,
        discountEndDate: dto.discountEndDate ? new Date(dto.discountEndDate) : null,
        isDiscountActive: dto.isDiscountActive,
      },
      // [QUAN TRỌNG] Include shop và variants để phục vụ việc Sync Redis bên dưới
      include: {
        shop: { select: { id: true, name: true, avatar: true } },
        variants: true, 
      }
    });

    // --- 4. XỬ LÝ CACHE & REDIS (MỚI BỔ SUNG) ---

    // A. Xóa Cache chi tiết (Product Detail)
    // Để khi khách hàng vào xem chi tiết, hệ thống buộc phải load lại giá mới từ DB
    await this.productCache.invalidateProduct(updatedProduct.id, updatedProduct.slug);

    // B. Đồng bộ sang Redis Search (Product Listing)
    // Để update lại giá bán (price) trong Index tìm kiếm. 
    // Giúp khách hàng filter theo khoảng giá hoặc sort giá thấp/cao sẽ thấy đúng giá sau giảm.
    await this.productReadService.syncProductToRedis(updatedProduct);

    return updatedProduct;
  }

  async deleteBySeller(userId: string, productId: string) {
    // 1. Tìm Shop của User
    const shop = await this.prisma.shop.findUnique({ where: { ownerId: userId } });
    if (!shop) {
      throw new ForbiddenException('Bạn không có quyền thực hiện hành động này.');
    }

    // 2. Tìm sản phẩm và đảm bảo nó thuộc về Shop này
    const product = await this.prisma.product.findFirst({
      where: { 
        id: productId,
        shopId: shop.id // [QUAN TRỌNG] Ràng buộc shopId
      },
      select: { id: true, name: true, slug: true } // Lấy slug để xóa cache
    });

    if (!product) {
      throw new NotFoundException('Sản phẩm không tồn tại hoặc không thuộc quyền quản lý của bạn.');
    }

    // 3. Thực hiện xóa trong DB (Transaction)
    await this.prisma.$transaction(async (tx) => {
        // Xóa các bảng quan hệ trước
        await tx.productVariant.deleteMany({ where: { productId: productId } });
        await tx.productOption.deleteMany({ where: { productId: productId } });
        await tx.productCrossSell.deleteMany({ where: { productId: productId } });
        
        // Xóa sản phẩm chính
        await tx.product.delete({ where: { id: productId } });
    });

    // 4. [XỬ LÝ CACHE REDIS]
    // A. Xóa khỏi RediSearch & Suggestion (để Search Bar không gợi ý sp đã xóa nữa)
    // Lưu ý: Hàm removeProductFromRedis cần được public bên ProductReadService
    await this.productReadService.removeProductFromRedis(product.id, product.name);
    
    // B. Xóa Cache chi tiết (để user truy cập link cũ sẽ thấy 404 thay vì cache cũ)
    await this.productCache.invalidateProduct(product.id, product.slug);

    return { success: true, message: 'Đã xóa sản phẩm thành công' };
  }
  // --- 5. Find All By Seller (Updated) ---
  async findAllBySeller(userId: string, status?: string) {
    // [MỚI] Lấy Shop ID
    const shop = await this.prisma.shop.findUnique({ where: { ownerId: userId } });
    if (!shop) throw new NotFoundException("Shop không tồn tại");

    const whereCondition: any = { shopId: shop.id }; // [MỚI] Filter by shopId

    if (status && status !== 'ALL') {
        whereCondition.status = status as ProductStatus;
    }

    return this.prisma.product.findMany({
      where: whereCondition,
      include: {
        _count: { select: { variants: true } }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllForAdmin() {
    return this.prisma.product.findMany({
      include: {
        shop: true, // [MỚI] Include Shop info instead of Seller user
      },
    });
  }

  // --- Helper ---
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ /g, '-')
      .replace(/[^\w-]+/g, '') +
      '-' +
      Date.now();
  }
}