// type: uploaded file
// fileName: Back-end/modules/product/services/product-write.service.ts

import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { ProductCacheService } from './product-cache.service';
import { DiscountType, Prisma, ProductStatus } from '@prisma/client';
import { UpdateProductDiscountDto, UpdateProductDto } from '../dto/update-product.dto';
import { ProductReadService } from './product-read.service';
import { ImageSearchService } from '../../image-search/image-search.service'; // wiki 0052
@Injectable()
export class ProductWriteService {
  private readonly logger = new Logger(ProductWriteService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly productCache: ProductCacheService,
    private readonly productReadService: ProductReadService,
    private readonly imageSearch: ImageSearchService, // wiki 0052
  ) {}

  // wiki 0052: enqueue index job — fire and forget, never block product save.
  // Failure here means the product is missing from image search until next
  // reindex cycle; it does NOT corrupt the product itself.
  private safeEnqueueIndex(productId: string): void {
    this.imageSearch.enqueueIndex(productId).catch((err) =>
      this.logger.warn(`image-search enqueue ${productId} failed: ${err.message}`),
    );
  }

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
        shortDesc, // Spec [0018]: phải tách để convert class -> plain Json
        ...rest
    } = dto;

    // Spec [0018]: Prisma Json column từ chối class instance (thiếu index signature).
    // Spread sang plain object để TS hợp lệ và Prisma serialize đúng.
    const shortDescJson = shortDesc ? { ...shortDesc } : undefined;

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

    const result = await this.prisma.$transaction(async (tx) => {
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
          ...(shortDescJson ? { shortDesc: shortDescJson as any } : {}),
          // FE truyền `status: 'DRAFT'` khi bấm "Lưu nháp"; default 'PENDING'
          // khi seller submit để duyệt. Audit Seller #18 wiki 0061.
          status: (dto.status === 'DRAFT' ? 'DRAFT' : 'PENDING'),
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

      const finalProduct = await tx.product.findUnique({
          where: { id: product.id },
          include: {
              options: { include: { values: true } },
              variants: true
          }
      });
      return finalProduct;
    });

    // wiki 0052: trigger image-search indexing AFTER transaction commits.
    // Failure here cannot roll back the saved product — by design fire-and-forget.
    if (result?.id) this.safeEnqueueIndex(result.id);
    return result;
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

  async delete(id: string) { return this.bulkDelete([id]); }

  // --- 7. Bulk Delete (CẬP NHẬT) ---
  async bulkDelete(ids: string[]) {
      if (!ids || ids.length === 0) return { count: 0 };
      const productsToDelete = await this.prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, slug: true } });

      await this.prisma.$transaction(async (tx) => {
          // 1. [QUAN TRỌNG] Xoá các bảng KHÔNG CÓ CASCADE
          // Bảng FlashSaleProduct (khoá ngoại variantId không cascade)
          await this.safeDelete(tx, 'flashSaleProduct', { productId: { in: ids } });
          
          // Bảng ProductReview (khoá ngoại productId không cascade)
          await this.safeDelete(tx, 'productReview', { productId: { in: ids } });

          // 2. [TỐI ƯU] Xoá thủ công CartItem để giảm tải cho DB (dù có cascade)
          await this.safeDelete(tx, 'cartItem', { productId: { in: ids } });

          // Lưu ý: OrderItem có onDelete: SetNull nên không cần xoá, nó sẽ tự update thành null.

          // 3. Xoá Product (Sẽ tự động cascade xoá ProductVariant, ProductOption, CrossSell)
          await tx.product.deleteMany({ where: { id: { in: ids } } });

      }, { maxWait: 10000, timeout: 20000 });

      this.clearCacheBackground(productsToDelete);
      return { count: ids.length, message: `Đã xoá ${ids.length} sản phẩm` };
  }
  private async clearCacheBackground(products: { id: string, name: string, slug: string }[]) {
      Promise.all(products.map(async (p) => {
          try {
             await this.productReadService.removeProductFromRedis(p.id, p.name);
             await this.productCache.invalidateProduct(p.id, p.slug);
          } catch(e) {}
      })).then(() => this.logger.log(`Cleaned cache for ${products.length} items`));
  }
  async deleteAll() {
    const allProducts = await this.prisma.product.findMany({ select: { id: true, name: true, slug: true } });
    if (allProducts.length === 0) return { count: 0, message: 'Hệ thống trống.' };
    
    this.logger.warn(`Đang xoá toàn bộ ${allProducts.length} sản phẩm...`);

    await this.prisma.$transaction(async (tx) => {
        // 1. Dọn dẹp bảng phụ (Blocking Tables)
        await this.safeDelete(tx, 'flashSaleProduct', {}); // Xoá hết flash sale items
        await this.safeDelete(tx, 'productReview', {});    // Xoá hết review
        
        // 2. Dọn dẹp giỏ hàng
        await this.safeDelete(tx, 'cartItem', {});

        // 3. Xoá Product (Cascade lo phần còn lại: Variants, Options...)
        await tx.product.deleteMany({});
        
    }, { timeout: 60000 }); // Tăng timeout cho tác vụ nặng

    this.clearCacheBackground(allProducts);
    return { count: allProducts.length, message: 'Đã xoá sạch toàn bộ hệ thống!' };
  }
  private async safeDelete(tx: any, modelName: string, where: any) {
    try {
        if (tx[modelName]) {
            await tx[modelName].deleteMany({ where });
        }
    } catch (e) {
        // Bỏ qua lỗi nếu model không tồn tại hoặc sai tên
        // this.logger.debug(`Skipped delete for ${modelName}: ${e.message}`);
    }
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

    // Spec [0018]: PATCH có thể nhận lại đủ payload từ FE (vì chia sẻ AddProductPage).
    // Phải strip các field không nằm trên Product model: tiers/variations/crossSellIds/
    // systemTags/categoryId (xử lý connect riêng). attributes/videos/sizeChart vẫn giữ
    // như create cho consistency.
    const {
        images, price, brandId,
        tiers, variations, crossSellIds, systemTags,
        categoryId,
        videos, sizeChart, brand, origin, weight, length: lenDim, width, height,
        attributes,
        shortDesc,
        ...rest
    } = dto as any;

    const updateData: any = { ...rest };
    if (shortDesc !== undefined) updateData.shortDesc = shortDesc ? { ...shortDesc } : null;
    if (price !== undefined) updateData.price = new Prisma.Decimal(price);
    if (brandId !== undefined) {
        updateData.brandRel = { connect: { id: brandId } };
    }
    if (brand !== undefined) updateData.brand = brand;
    if (images !== undefined) updateData.images = Array.isArray(images) ? images : [];
    if (categoryId !== undefined) updateData.category = { connect: { id: categoryId } };

    // Re-merge attributes giống create() để giữ dimensions/videos/sizeChart đồng nhất.
    if (attributes !== undefined || videos !== undefined || sizeChart !== undefined ||
        weight !== undefined || lenDim !== undefined || width !== undefined || height !== undefined ||
        origin !== undefined || systemTags !== undefined) {
        try {
            const attrObj = typeof attributes === 'string' ? JSON.parse(attributes) : (attributes || {});
            Object.assign(attrObj, {
                ...(videos !== undefined ? { videos } : {}),
                ...(sizeChart !== undefined ? { sizeChart } : {}),
                ...(brand !== undefined ? { brand } : {}),
                ...(origin !== undefined ? { origin } : {}),
                ...(weight !== undefined ? { weight } : {}),
                ...(lenDim !== undefined || width !== undefined || height !== undefined
                    ? { dimensions: { length: lenDim, width, height } }
                    : {}),
                ...(systemTags !== undefined ? { systemTags } : {}),
            });
            updateData.attributes = JSON.stringify(attrObj);
        } catch {
            // attributes không phải JSON hợp lệ -> bỏ qua, chỉ update field flat khác
        }
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: updateData,
    });

    // Spec [0018]: nếu FE gửi crossSellIds -> đồng bộ lại bảng nối ProductCrossSell.
    if (crossSellIds !== undefined) {
        await this.prisma.productCrossSell.deleteMany({ where: { productId: id } });
        const uniqueIds = [...new Set(crossSellIds)].filter((rid: string) => rid && rid !== id);
        if (uniqueIds.length > 0) {
            await this.prisma.productCrossSell.createMany({
                data: uniqueIds.map((relId: string) => ({ productId: id, relatedProductId: relId })),
            });
        }
    }

    await this.productCache.invalidateProduct(id);

    // wiki 0052: re-index nếu images đổi (hash check trong processor sẽ skip nếu giống cũ).
    if (images !== undefined) this.safeEnqueueIndex(id);

    return updated;
  }

  // --- 3b. Lấy 1 sản phẩm để CHỈNH SỬA (wiki 0068 A1) ---
  // Bug: FE AddProductPage gọi GET /products/:id (route không tồn tại) -> 404 ->
  // toast "Không tải được dữ liệu sản phẩm để chỉnh sửa". Trước đây seller KHÔNG có
  // endpoint đọc 1 SP của mình (chỉ có list + my-products search).
  // Fix: endpoint owner-scoped, trả raw + FLATTEN attributes (videos/dimensions/
  // origin/brand/sizeChart) về top-level đúng shape mà form prefill đọc, kèm
  // crossSellProducts để prefill "mua kèm".
  async findOneForEdit(userId: string, productId: string) {
    const shop = await this.prisma.shop.findUnique({ where: { ownerId: userId } });
    if (!shop) throw new ForbiddenException('Bạn không có quyền quản lý sản phẩm này');

    const product = await this.prisma.product.findFirst({
      where: { id: productId, shopId: shop.id },
      include: {
        options: { include: { values: true }, orderBy: { position: 'asc' } },
        variants: true,
        crossSells: { select: { relatedProductId: true } },
      },
    });
    if (!product) {
      throw new NotFoundException('Sản phẩm không tồn tại hoặc không thuộc Shop của bạn');
    }

    let attrs: any = {};
    try {
      attrs = typeof product.attributes === 'string'
        ? JSON.parse(product.attributes)
        : (product.attributes || {});
    } catch {
      attrs = {};
    }
    const dims = attrs.dimensions || {};

    return {
      ...product,
      price: Number(product.price),
      originalPrice: product.originalPrice != null ? Number(product.originalPrice) : null,
      // Flatten attributes -> field top-level form prefill đang đọc
      brand: attrs.brand ?? '',
      origin: attrs.origin ?? '',
      videos: Array.isArray(attrs.videos) ? attrs.videos : [],
      sizeChart: attrs.sizeChart ?? null,
      length: Number(dims.length ?? 0),
      width: Number(dims.width ?? 0),
      height: Number(dims.height ?? 0),
      crossSellProducts: product.crossSells.map((cs) => ({ id: cs.relatedProductId })),
    };
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
    // 1. Lấy sản phẩm và variants
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { variants: true } 
    });

    if (!product) throw new NotFoundException('Sản phẩm không tồn tại');
    
    // Check quyền
    const shop = await this.prisma.shop.findUnique({ where: { ownerId: sellerId } });
    if (!shop || product.shopId !== shop.id) {
        throw new ForbiddenException('Bạn không có quyền chỉnh sửa sản phẩm này');
    }

    // --- LOGIC XỬ LÝ BIẾN THỂ (VARIANTS) ---
    // Chỉ chạy khi user gửi danh sách variations (Cài đặt riêng)
    if (dto.isDiscountActive && dto.variants && dto.variants.length > 0) {
        
        const updates = dto.variants.map(async (vDto) => {
            const currentVariant = product.variants.find(v => v.id === vDto.id);
            if (!currentVariant) return;

            // [CHUẨN] Logic y hệt Product cha:
            // Nếu chưa có originalPrice thì lấy price hiện tại làm gốc.
            // Nếu đã có originalPrice thì GIỮ NGUYÊN nó làm gốc.
            const vOriginalPrice = Number(currentVariant.originalPrice ?? currentVariant.price);
            
            // Tính giá bán mới (price)
            const discountPercent = vDto.discountValue;
            if (discountPercent > 100) throw new BadRequestException('Giảm giá không quá 100%');
            
            const vNewPrice = Math.round(vOriginalPrice * (1 - discountPercent / 100));

            return this.prisma.productVariant.update({
                where: { id: vDto.id },
                data: {
                    price: vNewPrice,           // Cập nhật giá bán
                    originalPrice: vOriginalPrice, // Neo giá gốc
                    discountValue: discountPercent // Lưu % giảm
                }
            });
        });

        await Promise.all(updates);
    } 
    
    // --- LOGIC XỬ LÝ PRODUCT CHA (Giữ nguyên của bạn) ---
    // ... (Code xử lý finalPrice cho product cha như cũ) ...
    // Lưu ý: Nếu có variants, giá Product cha nên là giá Min của variants
    
    let originalPrice = Number(product.originalPrice ?? product.price);
    let finalPrice = originalPrice;
    
    if (dto.isDiscountActive) {
         // Wiki 0082: chặn discount ngoài [0,100] → giá âm (defense-in-depth cùng @Max(100) ở DTO).
         const dv = Number(dto.discountValue);
         if (!Number.isFinite(dv) || dv < 0 || dv > 100) {
            throw new BadRequestException('Phần trăm giảm giá phải trong khoảng 0–100');
         }
         finalPrice = Math.round(originalPrice * (1 - dv / 100));
    } else {
         finalPrice = originalPrice;
         // Nếu tắt discount -> Reset cả variants về giá gốc
         if (product.variants.length > 0) {
             await this.prisma.productVariant.updateMany({
                 where: { productId },
                 data: { 
                    discountValue: 0 
                    // Lưu ý: Prisma updateMany không set được price = originalPrice
                    // Nếu muốn reset giá variant chính xác, cần loop update
                 }
             });
             // Loop reset giá variant (Optional nhưng Recommended)
             await Promise.all(product.variants.map(v => 
                 this.prisma.productVariant.update({
                     where: { id: v.id },
                     data: { price: v.originalPrice ?? v.price }
                 })
             ));
         }
    }

    // Update Product
    const updatedProduct = await this.prisma.product.update({
      where: { id: productId },
      data: {
        originalPrice, 
        price: finalPrice,
        discountValue: dto.discountValue,
        discountStartDate: dto.discountStartDate ? new Date(dto.discountStartDate) : null,
        discountEndDate: dto.discountEndDate ? new Date(dto.discountEndDate) : null,
        isDiscountActive: dto.isDiscountActive,
        discountType: 'PERCENT' // Ép cứng theo yêu cầu
      },
      include: { variants: true, shop: true }
    });

    // Sync Redis
    await this.productCache.invalidateProduct(updatedProduct.id, updatedProduct.slug);
    await this.productReadService.syncProductToRedis(updatedProduct);

    return updatedProduct;
  }

  async deleteBySeller(userId: string, productId: string) {
    const shop = await this.prisma.shop.findUnique({ where: { ownerId: userId } });
    if (!shop) throw new ForbiddenException('Lỗi quyền');
    const product = await this.prisma.product.findFirst({ where: { id: productId, shopId: shop.id } });
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại');
    return this.bulkDelete([productId]);
  }
  // --- 5. Find All By Seller (search + sort + counts) ---
  async findAllBySeller(
    userId: string,
    status?: string,
    opts?: { page?: number; limit?: number; search?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' },
  ) {
    const shop = await this.prisma.shop.findUnique({ where: { ownerId: userId } });
    if (!shop) throw new NotFoundException("Shop không tồn tại");

    const page = Math.max(1, Number(opts?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(opts?.limit) || 10));
    const search = opts?.search?.trim();
    const sortBy = ['createdAt', 'price', 'updatedAt'].includes(opts?.sortBy || '') ? opts!.sortBy! : 'createdAt';
    const sortOrder: 'asc' | 'desc' = opts?.sortOrder === 'asc' ? 'asc' : 'desc';

    const baseWhere: any = { shopId: shop.id };
    if (search) {
      baseWhere.name = { contains: search, mode: 'insensitive' };
    }

    const statusWhere: any = { ...baseWhere };
    if (status && status !== 'ALL') {
      statusWhere.status = status as ProductStatus;
    }

    // counts theo status để FE hiển thị badge ("Chờ duyệt (3)", ...) —
    // audit Seller #7 báo badge luôn 0.
    const [data, total, statusGroup] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where: statusWhere,
        include: { _count: { select: { variants: true } } },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where: statusWhere }),
      this.prisma.product.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
    ]);

    const counts: Record<string, number> = Object.fromEntries(
      statusGroup.map((g: any) => [g.status, g._count?._all ?? 0]),
    );

    return { data, meta: { total, page, limit, counts } };
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