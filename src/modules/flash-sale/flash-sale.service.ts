// BE-3.7/modules/flash-sale/flash-sale.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateFlashSaleSessionDto } from './dto/create-flash-sale.dto';
import { UpdateFlashSaleSessionDto } from './dto/update-flash-sale.dto';
import { RegisterFlashSaleDto } from './dto/register-flash-sale.dto';
import { FlashSaleSession, Prisma, FlashSaleProductStatus, User } from '@prisma/client';

@Injectable()
export class FlashSaleService {
  constructor(private readonly prisma: PrismaService) {}

  // Helper để tính toán trạng thái thời gian
  private mapSessionStatus(session: FlashSaleSession) {
    const now = new Date();
    let timeStatus = 'UPCOMING';

    if (now >= session.startTime && now <= session.endTime) {
      timeStatus = 'ONGOING';
    } else if (now > session.endTime) {
      timeStatus = 'ENDED';
    }

    return {
      ...session,
      timeStatus, // Virtual field
    };
  }

  async getRegisteredProducts(sellerId: string, sessionId: string) {
    return this.prisma.flashSaleProduct.findMany({
      where: {
        sessionId: sessionId,
        product: {
          shopId: sellerId // Quan trọng: Chỉ lấy sản phẩm của shop này
        }
      },
      include: {
        product: true,        // Để lấy tên, ảnh
        variant: true, // Để lấy tên phân loại
      }
    });
  }

  async findAvailableSessionsForSeller() {
    const now = new Date();
    return this.prisma.flashSaleSession.findMany({
      where: {
        status: 'ENABLED',    // Quan trọng: Phải khớp chính xác string này
        endTime: { gt: now }, // Quan trọng: Session chưa kết thúc
      },
      orderBy: { startTime: 'asc' },
      include: {
        _count: { select: { products: true } }
      }
    });
  }

  async getCurrentFlashSaleForBuyer() {
    const now = new Date();
    console.log("🕒 [FlashSale] Server Time (ISO):", now.toISOString());
    console.log("🕒 [FlashSale] Server Time (Local):", now.toLocaleString());

    // 1. Tìm Session đang diễn ra (Lấy rộng hơn một chút để debug)
    const activeSessions = await this.prisma.flashSaleSession.findMany({
      where: {
        status: 'ENABLED',
        // Bỏ bớt điều kiện thời gian chặt chẽ nếu cần test, nhưng logic đúng là phải có
        startTime: { lte: now }, 
        endTime: { gt: now },
      },
      orderBy: { endTime: 'asc' },
      include: {
        products: {
          where: {
            status: FlashSaleProductStatus.APPROVED,
            // ⚠️ MỞ COMMENT DÒNG DƯỚI NẾU MUỐN HIỆN CẢ HÀNG HẾT KHO ĐỂ TEST
            // stock: { gt: 0 },
          },
          // [FIX round15 #6 - wiki 0088] BỎ take:12 ở DB. Trước đây take:12 orderBy sold DESC chạy
          // TRƯỚC bộ lọc remaining>0 (JS) → nếu 12 SP bán-chạy-nhất đã hết suất flash (sold==stock) thì
          // query trả 12 row sold-out, JS lọc sạch → SP còn hàng (xếp sau) bị BỎ → feed trống oan.
          // Lấy hết APPROVED rồi lọc remaining>0 + cắt 12 ở JS.
          orderBy: { sold: 'desc' },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true,
                slug: true,
                rating: true,
                salesCount: true,
                status: true, // Lấy thêm status để debug
              }
            },
            variant: { 
               select: { id: true, sku: true }
            }
          }
        }
      }
    });

    console.log(`🔎 [FlashSale] Found ${activeSessions.length} active sessions via time query.`);

    // 2. Lọc thủ công để biết tại sao sản phẩm bị loại (Debug Logic)
    const validSession = activeSessions.find(s => {
        if (!s.products || s.products.length === 0) {
            console.log(`   ⚠️ Session ${s.id}: No products registered or approved.`);
            return false;
        }

        // Lọc lại các điều kiện kinh doanh ở tầng JS để log ra được lỗi
        const validProducts = s.products.filter(p => {
            const isProductActive = p.product.status === 'ACTIVE';
            // Wiki 0086: availability phải tính theo tồn flash sale còn lại = stock - sold,
            // KHÔNG dùng stock thuần (item đã bán hết sold == stock vẫn bị hiện là còn hàng).
            const remaining = p.stock - p.sold;
            const hasStock = remaining > 0;

            if (!isProductActive) console.log(`   ❌ Product ${p.productId} ignored: Parent Status is ${p.product.status}`);
            if (!hasStock) console.log(`   ❌ Product ${p.productId} ignored: Sold out (stock=${p.stock}, sold=${p.sold}, remaining=${remaining})`);

            return isProductActive && hasStock;
        });

        // Gán lại products đã lọc sạch, cắt 12 SP còn hàng (sau khi lọc remaining>0) — [FIX round15 #6]
        s.products = validProducts.slice(0, 12);
        return validProducts.length > 0;
    });

    if (!validSession) {
      console.log(`❌ [FlashSale] No valid session with active products found for Buyer.`);
      return null;
    }

    console.log(`✅ [FlashSale] Returning Session ${validSession.id} with ${validSession.products.length} products.`);

    // 3. Map dữ liệu
    const mappedSession = {
      ...this.mapSessionStatus(validSession),
      products: validSession.products.map((item: any) => ({
        ...item,
        // Wiki 0086: phơi bày remaining (stock - sold) để FE hiển thị tồn thực + đánh dấu sold-out
        remaining: item.stock - item.sold,
        isSoldOut: item.stock - item.sold <= 0,
        product: {
          ...item.product,
          thumbnail: item.product.images && item.product.images.length > 0 
            ? item.product.images[0] 
            : null
        }
      }))
    };

    return mappedSession;
  }

  // 2. Seller đăng ký sản phẩm vào Session (Auto Approve)
  async registerProducts(sellerId: string, dto: RegisterFlashSaleDto) {
    const { sessionId, items } = dto;
    console.log(`[DEBUG] Registering for Session: ${sessionId}, Seller: ${sellerId}`);

    const session = await this.prisma.flashSaleSession.findUnique({
      where: { id: sessionId }
    });
    if (!session) throw new NotFoundException('Session not found');

    // [FIX] Từ chối đăng ký vào session đã kết thúc hoặc bị vô hiệu hóa
    if (session.status !== 'ENABLED' || session.endTime <= new Date()) {
      throw new BadRequestException('Session is not available for registration (disabled or ended)');
    }

    const results: any[] = [];
    
    for (const item of items) {
      console.log(`[DEBUG] Processing Item: ${item.productId} (Sent VariantId: ${item.variantId})`);

      let originalPrice = 0;
      let dbStock = 0;
      
      // Biến này sẽ chứa ID chuẩn để lưu vào DB
      let finalVariantId = item.variantId; 

      // --- BƯỚC 1: Tìm Variant chính xác theo ID gửi lên ---
      const variant = await this.prisma.productVariant.findFirst({
        where: {
          id: item.variantId,
          productId: item.productId,
          product: { shopId: sellerId }
        },
        include: { product: true }
      });

      if (variant) {
         console.log(`   -> Found Variant Directly. Price: ${variant.price}`);
         originalPrice = Number(variant.price);
         dbStock = variant.stock;
         finalVariantId = variant.id;
      } else {
         // --- BƯỚC 2: Nếu không thấy Variant, kiểm tra Product ---
         console.log(`   -> Variant ID not found. Checking Product table...`);
         const product = await this.prisma.product.findFirst({
            where: { 
              id: item.productId, 
              shopId: sellerId 
            }
         });
         
         if (!product) {
             console.log(`   -> SKIPPED: Product not found or not owned by seller.`);
             continue;
         }

         // [FIX QUAN TRỌNG]: Tìm Default Variant của Product này
         // Vì bảng FlashSaleProduct yêu cầu variantId phải tồn tại trong bảng ProductVariant
         const defaultVariant = await this.prisma.productVariant.findFirst({
            where: { productId: product.id }
         });

         if (defaultVariant) {
            console.log(`   -> Found Default Variant for Product. ID: ${defaultVariant.id}`);
            finalVariantId = defaultVariant.id; // Sử dụng ID thật của variant
            originalPrice = Number(defaultVariant.price); // Hoặc lấy giá từ product tùy logic bạn muốn
            dbStock = defaultVariant.stock;
         } else {
            // Trường hợp Product thật sự không có dòng nào trong bảng ProductVariant (Hiếm gặp nếu schema chuẩn)
            console.log(`   -> WARN: Product has no variants in DB. Using Product Price.`);
            originalPrice = Number(product.price);
            dbStock = product.stock;
            // Lúc này finalVariantId vẫn là item.variantId (giống productId), có thể gây lỗi DB nếu có FK
         }
      }

      // --- BƯỚC 3: Validate Giá ---
      const promoPrice = Number(item.promoPrice);
      if (promoPrice >= originalPrice) {
         console.log(`   -> SKIPPED: Promo Price (${promoPrice}) >= Original Price (${originalPrice})`);
         continue;
      }

      // [FIX] Giới hạn promoStock không vượt quá tồn kho thật của variant/product
      const promoStock = Number(item.promoStock);
      if (promoStock > dbStock) {
         console.log(`   -> SKIPPED: Promo Stock (${promoStock}) > Available Stock (${dbStock})`);
         continue;
      }

      // --- BƯỚC 4: Lưu vào DB ---
      try {
        const record = await this.prisma.flashSaleProduct.upsert({
          where: {
            sessionId_variantId: { 
              sessionId,
              variantId: finalVariantId // Sử dụng ID chuẩn đã tìm được
            }
          },
          update: {
            salePrice: promoPrice,
            stock: promoStock,
            status: FlashSaleProductStatus.APPROVED,
          },
          create: {
            sessionId,
            productId: item.productId,
            variantId: finalVariantId, // Sử dụng ID chuẩn
            originalPrice: originalPrice,
            salePrice: promoPrice,
            stock: promoStock,
            sold: 0,
            status: FlashSaleProductStatus.APPROVED,
          }
        });
        results.push(record);
        console.log(`   -> SUCCESS: Registered.`);
      } catch (error) {
        console.error(`   -> ERROR DB for Item ${item.productId}:`, error);
      }
    }

    console.log(`[DEBUG] Completed. Total Registered: ${results.length}`);
    return { success: true, registeredCount: results.length };
  }

  

  async registerProductsToFlashSale(user: User, dto: RegisterFlashSaleDto) {
  const { sessionId, items } = dto;
  let registeredCount = 0;
  const errors = [];

  // 1. Validate Session
  const session = await this.prisma.flashSaleSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) throw new NotFoundException('Session not found');

  // 2. Loop & Process Items
  for (const item of items) {
    // --- DEBUG LOGGING ---
    console.log(`Processing Item: Product ${item.productId} - Variant ${item.variantId}`);

    // CHECK 1: Tìm ProductVariant
    // LƯU Ý: Nếu logic của bạn cho phép Simple Product (không có variant),
    // bạn phải xử lý case variantId === productId hoặc tìm default variant.
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: item.variantId }, // <--- Khả năng cao lỗi ở đây vì ID sai
      include: { product: true }
    });

    if (!variant) {
      console.error(`--> FAILED: Variant not found for ID ${item.variantId}`);
      continue; // Skip item này
    }

    // CHECK 2: Validate Seller Owner
    if (variant.product.sellerId !== user.id) {
       console.error(`--> FAILED: Seller ${user.id} does not own product`);
       continue;
    }

    // CHECK 3: Validate Stock/Price (nếu có)
    if (variant.stock <= 0) {
        console.error(`--> FAILED: Out of stock`);
        continue;
    }

    // Nếu qua hết các bài test -> Lưu vào DB
    // await this.prisma.flashSaleProduct.create({
    // data: {
    //   session: { 
    //     connect: { id: sessionId } 
    //   },
    //   // flashSaleSession: { connect: { id: sessionId } }, // Fix lỗi relation
    //   product: { connect: { id: item.productId } },
    //   // productVariant: { connect: { id: item.variantId } },
      
    //   // Bây giờ TypeScript sẽ hiểu 2 dòng này vì DTO đã có
    //   // flashSalePrice: item.price, // Lưu ý: check tên cột trong DB là price hay flashSalePrice
    //   // flashSaleStock: item.stock, // Lưu ý: check tên cột trong DB là stock hay quantity/flashSaleStock
    // }
    
  // });
    
    registeredCount++;
  }

  return {
    success: true,
    registeredCount,
    errors // Trả thêm errors để FE dễ debug
  };
}
  async createSession(dto: CreateFlashSaleSessionDto) {
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);

    if (end <= start) {
      throw new BadRequestException('EndTime must be greater than StartTime');
    }

    // Check trùng lịch (Overlap Check)
    // Logic: Session mới trùng nếu (StartA < EndB) AND (EndA > StartB)
    // Và status phải là ENABLED
    const overlapped = await this.prisma.flashSaleSession.findFirst({
      where: {
        status: 'ENABLED',
        AND: [
          { startTime: { lt: end } },
          { endTime: { gt: start } },
        ],
      },
    });

    if (overlapped) {
      throw new BadRequestException(
        `Time slot overlaps with existing session ID: ${overlapped.id}`,
      );
    }

    const session = await this.prisma.flashSaleSession.create({
      data: {
        startTime: start,
        endTime: end,
        status: dto.status || 'ENABLED',
      },
    });

    return this.mapSessionStatus(session);
  }

  async findAll(date?: string) {
    const whereCondition: Prisma.FlashSaleSessionWhereInput = {};

    if (date) {
      // Lọc các session diễn ra trong ngày được chọn
      const searchDate = new Date(date);
      const nextDay = new Date(searchDate);
      nextDay.setDate(searchDate.getDate() + 1);

      whereCondition.startTime = {
        gte: searchDate,
        lt: nextDay,
      };
    }

    const sessions = await this.prisma.flashSaleSession.findMany({
      where: whereCondition,
      orderBy: { startTime: 'desc' },
      include: {
        _count: {
          select: { products: true }, // Đếm số sản phẩm đã đăng ký
        },
      },
    });

    return sessions.map((s) => this.mapSessionStatus(s));
  }

  async update(id: string, dto: UpdateFlashSaleSessionDto) {
    const session = await this.prisma.flashSaleSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Flash Sale Session not found');

    const start = dto.startTime ? new Date(dto.startTime) : session.startTime;
    const end = dto.endTime ? new Date(dto.endTime) : session.endTime;

    if (end <= start) {
      throw new BadRequestException('EndTime must be greater than StartTime');
    }

    // Nếu có thay đổi thời gian, cần check overlap (loại trừ chính nó)
    if (dto.startTime || dto.endTime) {
      const overlapped = await this.prisma.flashSaleSession.findFirst({
        where: {
          id: { not: id }, // Loại trừ bản ghi hiện tại
          status: 'ENABLED',
          AND: [
            { startTime: { lt: end } },
            { endTime: { gt: start } },
          ],
        },
      });

      if (overlapped) {
        throw new BadRequestException('Time slot overlaps with another session');
      }
    }

    const updated = await this.prisma.flashSaleSession.update({
      where: { id },
      data: {
        startTime: dto.startTime ? new Date(dto.startTime) : undefined,
        endTime: dto.endTime ? new Date(dto.endTime) : undefined,
        status: dto.status,
      },
    });

    return this.mapSessionStatus(updated);
  }

  async remove(id: string) {
    const session = await this.prisma.flashSaleSession.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });

    if (!session) throw new NotFoundException('Session not found');

    const now = new Date();

    // Điều kiện 1: Đã diễn ra chưa?
    if (session.startTime <= now) {
       throw new BadRequestException('Cannot delete a session that has already started or ended.');
    }

    // Điều kiện 2: Có sản phẩm đăng ký chưa?
    if (session._count.products > 0) {
      throw new BadRequestException('Cannot delete session containing registered products. Remove products first.');
    }

    return this.prisma.flashSaleSession.delete({
      where: { id },
    });
  }
}