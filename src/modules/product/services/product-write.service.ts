// type: uploaded file
// fileName: Back-end/modules/product/services/product-write.service.ts

import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { ProductCacheService } from './product-cache.service';
import { DiscountType, Prisma, ProductStatus } from '@prisma/client';
import { UpdateProductAffiliateDto, UpdateProductDiscountDto, UpdateProductDto } from '../dto/update-product.dto';
import { ProductReadService } from './product-read.service';
import { ImageSearchService } from '../../image-search/image-search.service'; // wiki 0052
import { SystemSettingService } from '../../../common/services/system-setting.service'; // wiki 0105
@Injectable()
export class ProductWriteService {
  private readonly logger = new Logger(ProductWriteService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly productCache: ProductCacheService,
    private readonly productReadService: ProductReadService,
    private readonly imageSearch: ImageSearchService, // wiki 0052
    private readonly systemSetting: SystemSettingService, // wiki 0105
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
          // wiki 0108: PHAI ghi ca `seller` chu khong chi `shop`.
          //
          // Truoc day cho nay chi `shop.connect`, nen `Product.sellerId` de NULL. Ma
          // `dashboard.service.getSellerStats()` loc MOI truy van theo
          // `product.is.sellerId` (doanh thu, so don, so san pham, hang sap het) — nen
          // nguoi ban nhin thay 0đ doanh thu VINH VIEN du tien da vao vi that.
          // Do duoc tren prod truoc khi sua: 687/912 san pham thieu sellerId, 13 shop
          // bi anh huong, 56 don DELIVERED lien quan. `userId` o day chinh la chu shop
          // (`shop` duoc tim bang `ownerId: userId` o dau ham) nen day la dung nguoi.
          seller: {
            connect: { id: userId }
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
              // wiki 0095 B2: values orderBy position để response create khớp tierIndex.
              options: { include: { values: { orderBy: { position: 'asc' } } }, orderBy: { position: 'asc' } },
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

    // [round14 FIX M1] Re-enqueue image-search index để Qdrant payload.status không bị stale
    // (ACTIVE phải hiện trong search, REJECTED phải biến mất). Fire-and-forget.
    this.safeEnqueueIndex(productId);

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

        // [round14 FIX M1] Re-enqueue image-search index để Qdrant payload.status không bị stale.
        this.safeEnqueueIndex(product.id);
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

      // [round14 FIX M3] Sau khi hard-delete commit, xoá luôn vector trong Qdrant
      // tránh ghost vectors (mirror safeEnqueueIndex, fire-and-forget).
      for (const p of productsToDelete) {
        this.imageSearch.enqueueDelete(p.id).catch(() => undefined);
      }

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
        syncVariants, // wiki 0095 B3: cờ điều khiển, KHÔNG phải cột Product
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
    // KHÔNG ghi `brand` như một cột: `Product` KHÔNG có cột `brand` (chỉ có `brandId` +
    // quan hệ `brandRel`). Dòng cũ `updateData.brand = brand` khiến Prisma ném
    // "Unknown argument brand" → PrismaExceptionFilter đổi thành 400 "Dữ liệu đầu vào
    // không hợp lệ" → seller KHÔNG BAO GIỜ sửa được sản phẩm, vì AddProductPage luôn
    // gửi `brand: brand || 'No Brand'` trong mọi lần bấm Cập nhật.
    //
    // Tên hãng vốn đã được lưu đúng chỗ ở khối gộp `attributes` ngay bên dưới — giống
    // hệt cách `create()` làm. Nên dòng cũ vừa thừa vừa gây chết.
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

    // wiki 0095 B3: TRƯỚC ĐÂY tiers/variations bị destructure ra rồi VỨT ĐI —
    // seller sửa phân loại xong bấm "Cập nhật" thì phân loại không bao giờ được
    // lưu ("ko lưu được" trong report của khách). Giờ đồng bộ lại thật sự.
    //
    // Chỉ chạy khi client gửi cờ `syncVariants` (FE bản đã fix prefill mới gửi).
    // Lý do: client CŨ luôn gửi `tiers: []` vì form không prefill được — nếu BE
    // cứ thấy `tiers` là sync thì một lần bấm Lưu từ bản FE cũ sẽ XOÁ SẠCH SKU
    // của sản phẩm. Cờ opt-in giúp BE deploy trước FE vẫn an toàn tuyệt đối.
    //
    // Chạy TRƯỚC product.update: sync có thể từ chối (thiếu SKU, variant đang
    // chạy Flash Sale) và phải fail SỚM. Nếu update tên/giá trước rồi sync mới
    // ném lỗi thì seller nhận 400 nhưng sản phẩm đã đổi một nửa — không cách nào
    // biết phần nào đã lưu.
    if (dto.syncVariants === true) {
      const totalStock = await this.syncTiersAndVariants(id, tiers ?? [], variations ?? []);
      // Tồn kho cha do sync tính (tổng tồn các SKU) là nguồn đúng — không để
      // giá trị `stock` FE gửi kèm ghi đè ngược lại.
      updateData.stock = totalStock;
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

  /**
   * wiki 0095 B3 — Đồng bộ lại nhóm phân loại (ProductOption/Value) + biến thể
   * (ProductVariant) khi seller sửa sản phẩm.
   *
   * Vì sao KHÔNG "xoá sạch rồi tạo lại":
   *  - `FlashSaleProduct.variantId` là quan hệ BẮT BUỘC (Restrict) → xoá variant
   *    đang chạy flash sale sẽ ném lỗi FK khó hiểu giữa transaction.
   *  - `OrderItem.variantId` trỏ tới variant để hoàn tồn kho khi huỷ đơn
   *    (wiki 0083). Đổi ID mỗi lần sửa = mất đường hoàn kho của đơn đang bay.
   *  - Đổi ID còn làm giỏ hàng / link flash sale của user trỏ vào hư không.
   *
   * Nên: đối chiếu theo TỔ HỢP GIÁ TRỊ ("Đen | 512GB") chứ không theo tierIndex
   * thô. tierIndex chỉ là chỉ số, seller đảo thứ tự option là nó đổi nghĩa;
   * tổ hợp giá trị mới là danh tính thật của một SKU. Nhờ vậy đảo thứ tự option
   * vẫn giữ nguyên ID variant, chỉ ghi lại tierIndex mới.
   *
   * @returns tổng tồn kho các SKU sau khi đồng bộ (để caller ghi vào Product.stock)
   */
  private async syncTiersAndVariants(
    productId: string,
    tiers: { name: string; options: string[]; images?: string[] }[],
    variations: { price: number; stock: number; sku?: string; imageUrl?: string; tierIndex: number[] }[],
  ): Promise<number> {
    // Cùng ràng buộc như create(): có nhóm phân loại thì bắt buộc có SKU.
    if (tiers.length > 0 && variations.length === 0) {
      throw new BadRequestException('Phải thiết lập biến thể SKU khi có nhóm phân loại');
    }

    const existing = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        options: {
          include: { values: { orderBy: { position: 'asc' } } },
          orderBy: { position: 'asc' },
        },
        variants: true,
      },
    });
    if (!existing) throw new NotFoundException('Sản phẩm không tồn tại');

    /** "0,1" + bảng option cũ  →  "Đen | 512GB". Dùng làm khoá đối chiếu. */
    const comboOf = (
      tierIndex: number[],
      groups: { values: { value: string }[] }[],
    ): string =>
      tierIndex
        .map((valueIdx, groupIdx) => groups[groupIdx]?.values[valueIdx]?.value ?? `#${valueIdx}`)
        .join(' | ');

    const parseTierIndex = (raw: unknown): number[] => {
      if (Array.isArray(raw)) return raw as number[];
      if (typeof raw === 'string' && raw.length > 0) {
        return raw.split(',').map((n) => parseInt(n, 10)).filter((n) => !Number.isNaN(n));
      }
      return [];
    };

    // Variant cũ theo combo. Sản phẩm không phân loại có tierIndex '' → combo ''.
    const oldByCombo = new Map<string, (typeof existing.variants)[number]>();
    for (const v of existing.variants) {
      const combo = comboOf(parseTierIndex(v.tierIndex), existing.options);
      if (!oldByCombo.has(combo)) oldByCombo.set(combo, v);
    }

    // Không phân loại → quy về đúng 1 SKU mặc định (combo '').
    const newTargets =
      tiers.length > 0
        ? variations.map((v) => ({
            combo: comboOf(v.tierIndex, tiers.map((t) => ({ values: t.options.map((o) => ({ value: o })) }))),
            tierIndex: v.tierIndex.join(','),
            price: Number(v.price),
            stock: Number(v.stock),
            sku: v.sku ?? '',
            image: v.imageUrl || null,
          }))
        : [{
            combo: '',
            tierIndex: '',
            price: Number(existing.price),
            stock: Number(existing.stock ?? 0),
            sku: '',
            image: null as string | null,
          }];

    const keepCombos = new Set(newTargets.map((t) => t.combo));
    const toDelete = existing.variants.filter(
      (v) => !keepCombos.has(comboOf(parseTierIndex(v.tierIndex), existing.options)),
    );

    // Chặn TRƯỚC transaction: variant đang nằm trong flash sale không xoá được
    // (FK Restrict). Báo rõ để seller tự gỡ khỏi flash sale, thay vì để Prisma
    // ném lỗi P2003 khó hiểu.
    if (toDelete.length > 0) {
      const locked = await this.prisma.flashSaleProduct.findMany({
        where: { variantId: { in: toDelete.map((v) => v.id) } },
        select: { variantId: true },
      });
      if (locked.length > 0) {
        const lockedIds = new Set(locked.map((l) => l.variantId));
        const names = toDelete
          .filter((v) => lockedIds.has(v.id))
          .map((v) => comboOf(parseTierIndex(v.tierIndex), existing.options) || v.sku || v.id)
          .join(', ');
        throw new BadRequestException(
          `Không thể xoá phân loại đang chạy Flash Sale: ${names}. ` +
            `Vui lòng gỡ khỏi chương trình Flash Sale trước khi sửa.`,
        );
      }
    }

    const totalStock = newTargets.reduce((sum, t) => sum + t.stock, 0);

    await this.prisma.$transaction(async (tx) => {
      // 1. Dựng lại nhóm phân loại. Xoá thẳng được vì không bảng nào tham chiếu
      //    ProductOptionValue (cascade từ ProductOption).
      await tx.productOption.deleteMany({ where: { productId } });
      for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i];
        if (!tier.options?.length) continue;
        const images = tier.images || [];
        await tx.productOption.create({
          data: {
            productId,
            name: tier.name,
            position: i,
            values: {
              create: tier.options.map((val, idx) => ({
                value: val,
                image: images[idx] || null,
                position: idx, // khớp với tierIndex của variant
              })),
            },
          },
        });
      }

      // 2. Giữ ID cho SKU còn tồn tại, tạo mới cho SKU vừa thêm.
      for (const target of newTargets) {
        const old = oldByCombo.get(target.combo);
        if (old) {
          await tx.productVariant.update({
            where: { id: old.id },
            data: {
              price: new Prisma.Decimal(target.price),
              stock: target.stock,
              sku: target.sku,
              tierIndex: target.tierIndex,
              // Ảnh riêng của SKU: chỉ ghi đè khi FE thực sự gửi ảnh mới.
              ...(target.image !== null ? { image: target.image } : {}),
            },
          });
        } else {
          await tx.productVariant.create({
            data: {
              productId,
              price: new Prisma.Decimal(target.price),
              stock: target.stock,
              sku: target.sku,
              image: target.image,
              tierIndex: target.tierIndex,
            },
          });
        }
      }

      // 3. Dọn SKU seller đã bỏ.
      if (toDelete.length > 0) {
        await tx.productVariant.deleteMany({ where: { id: { in: toDelete.map((v) => v.id) } } });
      }

      // 4. Tồn kho cha = tổng tồn các SKU (giống create()).
      //    Vẫn ghi trong transaction này để nếu caller lỗi sau đó thì DB vẫn
      //    nhất quán; caller ghi lại lần nữa cùng giá trị là vô hại.
      await tx.product.update({ where: { id: productId }, data: { stock: totalStock } });
    });

    this.logger.log(
      `[syncVariants] product=${productId} tiers=${tiers.length} sku=${newTargets.length} xoá=${toDelete.length}`,
    );
    return totalStock;
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
        // wiki 0095 B3: values PHẢI orderBy position. Thiếu dòng này thì form sửa
        // nhận option theo thứ tự uuid, lệch khỏi variants[].tierIndex → ma trận
        // SKU prefill sai giá/tồn.
        options: { include: { values: { orderBy: { position: 'asc' } } }, orderBy: { position: 'asc' } },
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

  /**
   * wiki 0105 — bật/tắt affiliate + đặt % hoa hồng cho một sản phẩm của chính seller.
   *
   * Mặc định MỌI sản phẩm đều TẮT: hoa hồng TRỪ VÀO DOANH THU CỦA CHÍNH SELLER khi đơn
   * giao thành công, nên không ai được bị trừ tiền ngoài ý muốn. Đánh đổi đã biết trước:
   * ngày ra mắt danh sách sản phẩm affiliate sẽ trống cho tới khi seller vào bật.
   *
   * Trần % đọc từ SystemSetting chứ không viết cứng — nó là chốt chặn để (phí sàn +
   * hoa hồng) không nuốt hết doanh thu seller, và ban điều hành phải chỉnh được mà
   * không cần deploy lại.
   */
  async updateAffiliate(sellerId: string, productId: string, dto: UpdateProductAffiliateDto) {
    // Kiểm quyền theo SHOP, cùng khuôn với updateDiscount bên dưới: sản phẩm thuộc về
    // shop, và một user chỉ sở hữu một shop.
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, shopId: true },
    });
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại');

    const shop = await this.prisma.shop.findUnique({ where: { ownerId: sellerId } });
    if (!shop || product.shopId !== shop.id) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa sản phẩm này');
    }

    if (!dto.enabled) {
      // Tắt thì GIỮ NGUYÊN affiliateRate: bật lại không phải nhập lại từ đầu.
      const off = await this.prisma.product.update({
        where: { id: productId },
        data: { affiliateEnabled: false },
        select: { id: true, affiliateEnabled: true, affiliateRate: true },
      });
      await this.productCache.invalidateProduct(productId).catch(() => {});
      return {
        id: off.id,
        affiliateEnabled: off.affiliateEnabled,
        affiliateRate: off.affiliateRate === null ? null : Number(off.affiliateRate),
      };
    }

    if (dto.rate === undefined || dto.rate === null) {
      throw new BadRequestException('Cần đặt % hoa hồng khi bật tiếp thị liên kết.');
    }
    if (!Number.isFinite(dto.rate) || dto.rate <= 0) {
      throw new BadRequestException('% hoa hồng phải lớn hơn 0.');
    }

    const maxRate = await this.systemSetting.getNumber('AFFILIATE_MAX_RATE', 0.3);
    if (dto.rate > maxRate) {
      throw new BadRequestException(`% hoa hồng tối đa là ${(maxRate * 100).toFixed(0)}%.`);
    }

    const on = await this.prisma.product.update({
      where: { id: productId },
      data: { affiliateEnabled: true, affiliateRate: new Prisma.Decimal(dto.rate) },
      select: { id: true, affiliateEnabled: true, affiliateRate: true },
    });
    await this.productCache.invalidateProduct(productId).catch(() => {});
    return {
      id: on.id,
      affiliateEnabled: on.affiliateEnabled,
      affiliateRate: Number(on.affiliateRate),
    };
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

    // --- VALIDATE TOÀN BỘ TRƯỚC KHI GHI (atomic) ---
    // Wiki 0082 fix: validate ALL variant discountValues up front nên một biến thể
    // lỗi không để lại ghi dở dang. Tính sẵn payload để dùng trong transaction.
    type VariantDiscountUpdate = { id: string; price: number; originalPrice: number; discountValue: number };
    const variantUpdates: VariantDiscountUpdate[] = [];

    if (dto.isDiscountActive && dto.variants && dto.variants.length > 0) {
        for (const vDto of dto.variants) {
            const currentVariant = product.variants.find(v => v.id === vDto.id);
            if (!currentVariant) continue;

            // Fix: bắt buộc discountValue là số hữu hạn (chặn NaN/undefined) khi bật discount.
            const discountPercent = Number(vDto.discountValue);
            if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
                throw new BadRequestException('Phần trăm giảm giá của biến thể phải trong khoảng 0–100');
            }

            // [CHUẨN] Logic y hệt Product cha:
            // Nếu chưa có originalPrice thì lấy price hiện tại làm gốc.
            // Nếu đã có originalPrice thì GIỮ NGUYÊN nó làm gốc.
            const vOriginalPrice = Number(currentVariant.originalPrice ?? currentVariant.price);
            const vNewPrice = Math.round(vOriginalPrice * (1 - discountPercent / 100));

            variantUpdates.push({
                id: vDto.id,
                price: vNewPrice,
                originalPrice: vOriginalPrice,
                discountValue: discountPercent,
            });
        }
    }

    // Wiki 0086 (#18): chỉ đụng tới discount khi caller CHỦ ĐỊNH gửi `isDiscountActive`.
    // whitelist:true + @IsOptional() ⇒ field thiếu = undefined (KHÔNG bị ép thành false).
    // Nếu undefined nghĩa là FE không nhắc gì tới discount ⇒ giữ nguyên trạng thái cũ của
    // cha lẫn variants, tránh reset variants ngoài ý muốn.
    const touchDiscount = dto.isDiscountActive !== undefined;

    // --- LOGIC XỬ LÝ PRODUCT CHA ---
    // Lưu ý: Nếu có variants, giá Product cha nên là giá Min của variants
    let originalPrice = Number(product.originalPrice ?? product.price);
    let finalPrice = originalPrice;
    // Wiki 0086 (#17): theo dõi discountValue sẽ ghi cho cha — khi tắt discount phải reset về 0.
    let parentDiscountValue = Number(product.discountValue ?? 0);
    // % giảm của cha dùng để propagate xuống các variant KHÔNG có trong payload (#16).
    let parentDiscountPercent = 0;

    if (dto.isDiscountActive) {
         // Wiki 0082: chặn discount ngoài [0,100] → giá âm (defense-in-depth cùng @Max(100) ở DTO).
         // Fix: !Number.isFinite cũng loại NaN/undefined.
         const dv = Number(dto.discountValue);
         if (!Number.isFinite(dv) || dv < 0 || dv > 100) {
            throw new BadRequestException('Phần trăm giảm giá phải trong khoảng 0–100');
         }
         finalPrice = Math.round(originalPrice * (1 - dv / 100));
         parentDiscountValue = dv;
         parentDiscountPercent = dv;
    } else if (touchDiscount) {
         // Tắt discount (isDiscountActive=false): trả giá cha về gốc.
         finalPrice = originalPrice;
         // Wiki 0086 (#17): reset discountValue=0 để cha không còn "mang" % giảm cũ.
         parentDiscountValue = 0;
    }

    // --- GHI ATOMIC: tất cả variant + product cha trong 1 transaction ---
    // Mọi validate đã chạy ở trên nên transaction không thể fail giữa chừng vì giá trị xấu,
    // và nếu DB lỗi giữa chừng thì rollback toàn bộ — không để ghi dở dang.
    // Wiki 0086 (#16): ID các variant đã có trong payload — phần còn lại sẽ được
    // propagate % giảm của cha để không bị STALE (cha giảm, variant giữ giá cũ).
    const payloadVariantIds = new Set(variantUpdates.map((vu) => vu.id));

    const updatedProduct = await this.prisma.$transaction(async (tx) => {
      if (dto.isDiscountActive) {
        // Cập nhật từng variant theo payload đã tính sẵn.
        for (const vu of variantUpdates) {
          await tx.productVariant.update({
            where: { id: vu.id },
            data: {
              price: vu.price,
              originalPrice: vu.originalPrice,
              discountValue: vu.discountValue,
            },
          });
        }

        // Wiki 0086 (#16): các variant KHÔNG nằm trong payload (thiếu/partial) phải được
        // áp lại % giảm của cha trên CHÍNH giá gốc của variant đó — không wipe dữ liệu,
        // chỉ tính lại price hiệu lực để nhất quán với discount của cha.
        for (const v of product.variants) {
          if (payloadVariantIds.has(v.id)) continue;
          const vOriginalPrice = Number(v.originalPrice ?? v.price);
          const vNewPrice = Math.round(vOriginalPrice * (1 - parentDiscountPercent / 100));
          await tx.productVariant.update({
            where: { id: v.id },
            data: {
              price: vNewPrice,
              originalPrice: vOriginalPrice,
              discountValue: parentDiscountPercent,
            },
          });
        }
      } else if (touchDiscount && product.variants.length > 0) {
        // Wiki 0086 (#18): chỉ reset variants khi caller CHỦ ĐỊNH tắt discount
        // (isDiscountActive=false). Nếu field absent (undefined) thì bỏ qua nhánh này,
        // variants được giữ nguyên.
        for (const v of product.variants) {
          await tx.productVariant.update({
            where: { id: v.id },
            data: {
              discountValue: 0,
              price: v.originalPrice ?? v.price,
            },
          });
        }
      }

      // Update Product cha trong cùng transaction.
      // Wiki 0086 (#18): nếu caller không gửi isDiscountActive thì KHÔNG đổi các field
      // discount của cha (giữ nguyên giá/cờ cũ), chỉ cập nhật khi có chủ định.
      const parentData: Prisma.ProductUpdateInput = touchDiscount
        ? {
            originalPrice,
            price: finalPrice,
            // Wiki 0086 (#17): khi tắt discount, parentDiscountValue đã được set = 0 ở trên.
            discountValue: parentDiscountValue,
            discountStartDate: dto.discountStartDate ? new Date(dto.discountStartDate) : null,
            discountEndDate: dto.discountEndDate ? new Date(dto.discountEndDate) : null,
            isDiscountActive: dto.isDiscountActive,
            discountType: 'PERCENT', // Ép cứng theo yêu cầu
          }
        : {};

      return tx.product.update({
        where: { id: productId },
        data: parentData,
        include: { variants: true, shop: true },
      });
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
      // [round14 FIX M11] mode:'insensitive' lỗi 500 trên MySQL; collation đã case-insensitive.
      baseWhere.name = { contains: search };
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