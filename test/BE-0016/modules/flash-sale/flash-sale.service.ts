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

  // 2. Seller đăng ký sản phẩm vào Session (Auto Approve)
  async registerProducts(sellerId: string, dto: RegisterFlashSaleDto) {
    const { sessionId, items } = dto;
    console.log(`[DEBUG] Registering for Session: ${sessionId}, Seller: ${sellerId}`);

    const session = await this.prisma.flashSaleSession.findUnique({
      where: { id: sessionId }
    });
    if (!session) throw new NotFoundException('Session not found');

    const results: any[] = [];
    
    for (const item of items) {
      console.log(`[DEBUG] Processing Item: ${item.productId} (ID: ${item.variantId})`);

      let originalPrice = 0;
      let dbStock = 0;
      let isSimpleProduct = false;

      // --- BƯỚC 1: Tìm trong bảng ProductVariant (Cho sản phẩm có phân loại) ---
      const variant = await this.prisma.productVariant.findFirst({
        where: {
          id: item.variantId,
          product: { shopId: sellerId } 
        },
        include: { product: true }
      });

      if (variant) {
         console.log(`   -> Found Variant. Price: ${variant.price}`);
         originalPrice = Number(variant.price);
         dbStock = variant.stock;
      } else {
         // --- BƯỚC 2: Tìm trong bảng Product (Cho sản phẩm đơn giản) ---
         console.log(`   -> Variant not found. Checking Product table...`);
         const product = await this.prisma.product.findFirst({
            where: { 
              id: item.productId, 
              shopId: sellerId // Quan trọng: Check đúng chủ sở hữu
            }
         });
         
         if (!product) {
             console.log(`   -> SKIPPED: Product not found or not owned by seller.`);
             continue;
         }

         console.log(`   -> Found Product (Simple). Price: ${product.price}`);
         originalPrice = Number(product.price);
         dbStock = product.stock;
         isSimpleProduct = true;
      }

      // --- BƯỚC 3: Validate Giá ---
      // Lưu ý: item.promoPrice từ FE gửi lên có thể là string hoặc number, cần ép kiểu an toàn
      const promoPrice = Number(item.promoPrice);
      
      if (promoPrice >= originalPrice) {
         console.log(`   -> SKIPPED: Promo Price (${promoPrice}) >= Original Price (${originalPrice})`);
         continue; 
      }

      // --- BƯỚC 4: Lưu vào DB ---
      try {
        const record = await this.prisma.flashSaleProduct.upsert({
          where: {
            sessionId_variantId: { 
              sessionId,
              variantId: item.variantId // Với Simple Product, đây là productId
            }
          },
          update: {
            salePrice: promoPrice,
            stock: Number(item.promoStock),
            status: FlashSaleProductStatus.APPROVED, 
          },
          create: {
            sessionId,
            productId: item.productId,
            variantId: item.variantId, 
            originalPrice: originalPrice, // Quan trọng: Lưu giá gốc để hiển thị % giảm
            salePrice: promoPrice,
            stock: Number(item.promoStock),
            sold: 0,
            status: FlashSaleProductStatus.APPROVED,
          }
        });
        results.push(record);
        console.log(`   -> SUCCESS: Registered.`);
      } catch (error) {
        console.error(`   -> ERROR DB:`, error);
        // Nếu lỗi này xuất hiện, có thể do Foreign Key của bảng flashSaleProduct
        // yêu cầu variantId phải tồn tại trong bảng ProductVariant.
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