import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { getPagination } from 'src/common/utils/pagination.util';
import { TrackingService } from '../tracking/tracking.service';
import { EventType } from '../tracking/dto/track-event.dto';
import { MailerService } from '@nestjs-modules/mailer';
import { Prisma, Role, ShopStatus } from '@prisma/client';
import { CreateUserDto } from './dto/admin-users.dto';
import * as bcrypt from 'bcrypt';

// Wiki 0086: marker đánh dấu shop bị khóa DO chủ sở hữu (user) bị ban, để khi unban user
// chỉ khôi phục đúng những shop này — KHÔNG vô tình "hồi sinh" shop đang bị BANNED vì vi phạm
// của chính nó (qua toggleBanShop). Không cần thêm cột schema: ta dùng prefix của banReason
// làm cờ phân biệt, vừa rẻ vừa không phá dữ liệu hiện có.
const OWNER_BAN_REASON_PREFIX = 'Tài khoản chủ sở hữu bị khóa: ';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ /g, '-')
    .replace(/[^\w-]+/g, '') + '-' + Date.now().toString().slice(-4);
}

@Injectable()
export class AdminUsersService {
  constructor(
    private prisma: PrismaService,
    private trackingService: TrackingService,
    private mailerService: MailerService,
  ) {}

  // =================================================================
  // 1. QUẢN LÝ SHOP (SELLERS) - Đã chuyển sang Model SHOP
  // =================================================================

  async getSellers(params: { page?: number; limit?: number; search?: string }) {
    const { search } = params;
    // Wiki 0074: clamp page/limit (page=-1 → skip âm → Prisma 500).
    const { page, limit, skip } = getPagination(params.page, params.limit);

    // Điều kiện lọc cho Shop
    const where: Prisma.ShopWhereInput = {
      // Lấy tất cả shop (Trừ shop đang chờ duyệt nếu muốn tách riêng trang approval)
      // status: { not: ShopStatus.PENDING } 
    };

    if (search) {
      where.OR = [
        { name: { contains: search } }, // Tên Shop
        { owner: { email: { contains: search } } }, // Email chủ shop
        { owner: { name: { contains: search } } }, // Tên chủ shop
      ];
    }

    // [QUERY CHÍNH] Lấy danh sách Shop từ bảng Shop
    const [shops, total] = await Promise.all([
      this.prisma.shop.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          owner: { // Include thông tin chủ shop để hiển thị
            select: { 
              id: true, 
              email: true, 
              name: true, 
              phone: true, 
              avatar: true, 
              walletBalance: true // Ví tiền vẫn nằm ở User
            }
          },
          _count: { select: { products: true } } // Đếm sản phẩm
        },
      }),
      this.prisma.shop.count({ where }),
    ]);

    // Tính toán doanh thu (Revenue) dựa trên bảng OrderItem -> Product -> Shop
    const data = await Promise.all(shops.map(async (shop) => {
      // Tính tổng tiền từ các đơn hàng đã giao thành công (DELIVERED)
      // Logic: OrderItem liên kết với Product, Product liên kết với Shop
      const revenueStats = await this.prisma.orderItem.findMany({
        where: {
          product: { shopId: shop.id }, // [QUAN TRỌNG] Filter theo shopId
          order: { status: 'DELIVERED' }
        },
        select: { price: true, quantity: true }
      });

      const totalRevenue = revenueStats.reduce((sum, item) => {
        return sum + (Number(item.price) * item.quantity);
      }, 0);

      // Đếm số đơn hàng thành công
      const totalOrders = await this.prisma.order.count({
        where: {
          status: 'DELIVERED',
          items: { some: { product: { shopId: shop.id } } }
        }
      });

      // Map dữ liệu phẳng ra để Frontend dễ dùng (giống cấu trúc cũ)
      return {
        id: shop.id,                 // ID của Shop
        shopName: shop.name,         // Tên Shop
        avatar: shop.avatar || shop.owner.avatar,
        createdAt: shop.createdAt,
        status: shop.status,         // ACTIVE, BANNED, PENDING...
        isBanned: shop.status === 'BANNED',
        
        // Thông tin Owner
        ownerId: shop.owner.id,
        name: shop.owner.name,       // Tên chủ shop
        email: shop.owner.email,
        phone: shop.owner.phone,
        walletBalance: shop.owner.walletBalance,

        // Chỉ số
        totalRevenue,
        totalOrders,
        totalProducts: shop._count.products,
        rating: shop.rating || 0
      };
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // #57 — chi tiết shop cho admin. Bao gồm: thông tin shop, owner,
  // 5 sản phẩm gần nhất, tổng GMV, tổng đơn hàng, rating.
  async getSellerDetail(shopId: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            avatar: true,
            createdAt: true,
            walletBalance: true,
            isBanned: true,
            isVerified: true,
          },
        },
        _count: { select: { products: true } },
        products: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            images: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!shop) throw new NotFoundException('Cửa hàng không tồn tại');

    // GMV: tổng doanh thu các order DELIVERED của shop
    const revenueAgg = await this.prisma.orderItem.findMany({
      where: { product: { shopId }, order: { status: 'DELIVERED' } },
      select: { price: true, quantity: true },
    });
    const totalRevenue = revenueAgg.reduce(
      (sum, it) => sum + Number(it.price) * (it.quantity || 1),
      0,
    );

    const totalOrders = await this.prisma.order.count({
      where: { status: 'DELIVERED', items: { some: { product: { shopId } } } },
    });

    return {
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      status: shop.status,
      avatar: shop.avatar,
      coverImage: shop.coverImage,
      description: shop.description,
      pickupAddress: shop.pickupAddress,
      rating: shop.rating || 0,
      createdAt: shop.createdAt,
      owner: shop.owner,
      productCount: shop._count.products,
      recentProducts: shop.products,
      totalRevenue,
      totalOrders,
      isBanned: shop.status === 'BANNED' || !!shop.owner.isBanned,
    };
  }

  // --- [UPDATE] Hàm Khóa/Mở khóa Shop (Thao tác trên Shop Model) ---
  async toggleBanShop(adminId: string, shopId: string, isBanned: boolean, reason?: string) {
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new NotFoundException('Cửa hàng không tồn tại');

    // Cập nhật trạng thái Shop
    await this.prisma.shop.update({
      where: { id: shopId },
      data: { 
        status: isBanned ? ShopStatus.BANNED : ShopStatus.ACTIVE,
        banReason: isBanned ? reason : null 
      }
    });

    // Tracking
    await this.trackingService.trackEvent(adminId, 'admin-action', {
      type: isBanned ? EventType.BAN_SHOP : EventType.UNBAN_SHOP,
      targetId: shopId,
      metadata: { reason, shopName: shop.name }
    });

    return { 
      success: true, 
      message: isBanned ? `Đã khóa shop ${shop.name}` : `Đã mở khóa shop ${shop.name}` 
    };
  }

  // --- [UPDATE] Lấy danh sách Shop chờ duyệt ---
  async getPendingShops(page: number = 1, limit: number = 10) {
    console.log(`🔍 [DEBUG] getPendingShops called with page=${page}, limit=${limit}`); // <--- LOG 1
    // Wiki 0074: clamp page/limit (page=-1 → skip âm → Prisma 500).
    const _pg = getPagination(page, limit);
    page = _pg.page; limit = _pg.limit;
    const skip = _pg.skip;
    
    // Kiểm tra xem có bao nhiêu shop đang pending trong DB
    const pendingCount = await this.prisma.shop.count({ where: { status: 'PENDING' } });
    console.log(`📊 [DEBUG] Total PENDING shops found in DB: ${pendingCount}`); // <--- LOG 2

    const [shops, total] = await Promise.all([
      this.prisma.shop.findMany({
        where: { status: 'PENDING' },
        include: {
          owner: { select: { email: true, name: true, phone: true } }
        },
        // [FIX] Prisma mặc định select hết các trường scalar (bao gồm các link ảnh),
        // nhưng nếu bạn đã từng dùng select cụ thể thì phải thêm các trường license vào.
        // Ở đây dùng findMany mặc định là OK.
        orderBy: { createdAt: 'asc' }, 
        skip,
        take: limit,
      }),
      this.prisma.shop.count({ where: { status: 'PENDING' } }),
    ]);

    console.log(`✅ [DEBUG] Returning ${shops.length} shops to Controller`); // <--- LOG 3

    return {
      data: shops,
      meta: { total, page, lastPage: Math.ceil(total / limit) }
    };
  }

  async approveShopUpdate(adminId: string, shopId: string) {
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop || !shop.pendingDetails) throw new BadRequestException("Không có thông tin chờ duyệt");

    const pending: any = shop.pendingDetails;
    
    // Merge pending data vào data chính thức
    const updateData: any = {
        pendingDetails: Prisma.DbNull, // Xóa pending
    };
    
    if (pending.businessLicenseFront) updateData.businessLicenseFront = pending.businessLicenseFront;
    if (pending.businessLicenseBack) updateData.businessLicenseBack = pending.businessLicenseBack;
    if (pending.salesLicense) updateData.salesLicense = pending.salesLicense;
    if (pending.trademarkCert) updateData.trademarkCert = pending.trademarkCert;
    if (pending.distributorCert) updateData.distributorCert = pending.distributorCert;

    await this.prisma.shop.update({
        where: { id: shopId },
        data: updateData
    });

    return { message: "Đã duyệt cập nhật thông tin shop" };
  }
  
  // --- [UPDATE] Duyệt Shop ---
  async approveShop(adminId: string, shopId: string) {
    // Include owner để lấy email gửi thông báo
    const shop = await this.prisma.shop.findUnique({ 
        where: { id: shopId },
        include: { owner: true } 
    });

    if (!shop) throw new NotFoundException('Shop không tồn tại');
    if (shop.status === 'ACTIVE') throw new BadRequestException('Shop này đã được duyệt rồi');
    // Chỉ duyệt khi shop đang ở trạng thái PENDING — tránh "hồi sinh" shop đã bị REJECTED/BANNED.
    if (shop.status !== ShopStatus.PENDING) throw new BadRequestException('Chỉ có thể duyệt shop đang chờ duyệt (PENDING)');

    // 1. Cập nhật trạng thái Shop -> ACTIVE
    await this.prisma.shop.update({
      where: { id: shopId },
      data: { status: ShopStatus.ACTIVE },
    });

    // 2. Cập nhật Role cho User -> SELLER (nếu chưa phải)
    // Để họ có quyền truy cập vào các API seller.
    // Chỉ nâng cấp BUYER/PENDING_SELLER lên SELLER — KHÔNG hạ cấp ADMIN.
    if (shop.owner.role === Role.BUYER || shop.owner.role === Role.PENDING_SELLER) {
        await this.prisma.user.update({
            where: { id: shop.ownerId },
            data: { role: Role.SELLER, isVerified: true }
        });
    }
    if(shop.owner.email)
    {
      // 3. Gửi Email thông báo
      try {
          await this.mailerService.sendMail({
              to: shop.owner.email,
              subject: 'Chúc mừng! Cửa hàng của bạn đã được duyệt trên GMall',
              html: `
                  <h3>Xin chào ${shop.owner.name},</h3>
                  <p>Cửa hàng <b>${shop.name}</b> của bạn đã được phê duyệt.</p>
                  <p>Bạn có thể bắt đầu đăng bán sản phẩm ngay bây giờ.</p>
              `,
          });
      } catch (error) {
          console.error("Lỗi gửi mail approve shop:", error.message);
      }
    }

    // 4. Tracking
    await this.trackingService.trackEvent(adminId, 'admin-action', {
      type: EventType.APPROVE_SELLER, // Hoặc tạo thêm EventType.APPROVE_SHOP
      targetId: shopId,
      metadata: { adminId, action: 'Approve Shop', timestamp: new Date() }
    });

    return { message: 'Đã phê duyệt Shop thành công' };
  }

  async getShopUpdateRequests(page: number = 1, limit: number = 10) {
    // Wiki 0074: clamp page/limit (page=-1 → skip âm → Prisma 500).
    const _pg = getPagination(page, limit);
    page = _pg.page; limit = _pg.limit;
    const skip = _pg.skip;
    
    // [FIX 1] Cách viết chuẩn để tìm trường JSON không phải là NULL trong Prisma
    const whereCondition: Prisma.ShopWhereInput = {
        pendingDetails: {
            not: Prisma.DbNull
        }
    };

    const [shops, total] = await Promise.all([
        this.prisma.shop.findMany({
            where: whereCondition,
            select: {
                id: true,
                name: true,
                // [FIX 2] Xóa dòng 'email: true,' ở đây vì Shop không có email
                owner: {
                    select: {
                        email: true, // Lấy email từ bảng Owner (User)
                        name: true,
                        phone: true,
                    }
                },
                avatar: true,
                pendingDetails: true,
                updatedAt: true,
            },
            skip,
            take: limit,
            orderBy: { updatedAt: 'desc' }
        }),
        this.prisma.shop.count({ where: whereCondition }),
    ]);

    return {
        data: shops,
        total,
        page,
        lastPage: Math.ceil(total / limit),
    };
  }

  // --- [UPDATE] Từ chối Shop ---
  async rejectShop(adminId: string, shopId: string, reason?: string) {
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new NotFoundException('Shop không tồn tại');

    // Cập nhật trạng thái -> REJECTED
    await this.prisma.shop.update({ 
        where: { id: shopId }, 
        data: { 
            status: ShopStatus.REJECTED,
            banReason: reason
        } 
    });

    await this.trackingService.trackEvent(adminId, 'admin-action', {
      type: EventType.REJECT_SELLER,
      targetId: shopId,
      metadata: { reason }
    });

    return { message: 'Đã từ chối yêu cầu mở Shop' };
  }

  // =================================================================
  // 2. QUẢN LÝ USER (Người dùng thường)
  // =================================================================

  async getAllUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    minPoints?: number;
    maxPoints?: number;
    industryId?: string; // Lọc theo ngành hàng chuyên của Seller
  }) {
    const {
        search,
        role,
        minPoints,
        maxPoints,
        industryId
    } = params;
    // Wiki 0074: clamp page/limit (page=-1 → skip âm → Prisma 500).
    const { page, limit, skip } = getPagination(params.page, params.limit);
    const where: Prisma.UserWhereInput = {};

    // 1. Filter Role
    if (role && role !== 'ALL') {
      where.role = role as Role;
    }

    // 2. Filter Search (Fulltext optimized or simple contains)
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { username: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    // 3. Filter Points (Dựa trên quan hệ 1-1 với PointWallet)
    if (minPoints !== undefined || maxPoints !== undefined) {
      where.pointWallet = {
        balance: {
          gte: minPoints ? Number(minPoints) : undefined,
          lte: maxPoints ? Number(maxPoints) : undefined,
        },
      };
    }

    // 4. Filter Industry (Ngành hàng chuyên) - LOGIC PHỨC TẠP
    // Sử dụng "Two-phase query" để đảm bảo hiệu năng cao:
    // Bước A: Tìm IDs của những User sở hữu Shop có ngành hàng chủ đạo là industryId bằng Raw SQL
    // Bước B: Đưa danh sách IDs đó vào điều kiện 'where' chính
    if (industryId) {
        // A. Lấy thống kê số lượng sản phẩm theo từng Category của tất cả các Shop đang hoạt động
        // Kết quả trả về dạng: [{ shopId: 'shop1', categoryId: 'catA', _count: { _all: 10 } }, ...]
        const categoryStats = await this.prisma.product.groupBy({
            by: ['shopId', 'categoryId'],
            where: {
                status: 'ACTIVE',
                shopId: { not: null }
            },
            _count: {
                _all: true // Đếm số lượng sản phẩm
            }
        });

        // B. Tìm Category chủ đạo (nhiều sản phẩm nhất) cho từng Shop
        const shopDominantMap = new Map<string, string>(); // Lưu: shopId -> dominantCategoryId
        const shopMaxCountMap = new Map<string, number>(); // Lưu: shopId -> maxCount hiện tại

        for (const stat of categoryStats) {
            const sId = stat.shopId;
            const cId = stat.categoryId;
            const count = stat._count._all;

            if (!sId || !cId) continue;

            // Kiểm tra xem category này có nhiều sản phẩm hơn category đang giữ Top không
            const currentMax = shopMaxCountMap.get(sId) || 0;
            if (count > currentMax) {
                shopMaxCountMap.set(sId, count);
                shopDominantMap.set(sId, cId);
            }
        }

        // C. Lọc ra các ShopID có dominant category trùng với industryId đầu vào
        const targetShopIds: string[] = [];
        shopDominantMap.forEach((dominantCatId, shopId) => {
            if (dominantCatId === industryId) {
                targetShopIds.push(shopId);
            }
        });

        // Nếu không tìm thấy shop nào phù hợp, trả về rỗng ngay
        if (targetShopIds.length === 0) {
             return {
                data: [],
                meta: { total: 0, page: Number(page), limit: Number(limit), totalPages: 0 },
            };
        }

        // D. Tìm OwnerID (User ID) tương ứng với các Shop tìm được
        const matchingShops = await this.prisma.shop.findMany({
            where: { id: { in: targetShopIds } },
            select: { ownerId: true }
        });
        
        const ownerIds = matchingShops.map(s => s.ownerId);

        // E. Áp dụng vào điều kiện lọc chính
        where.id = { in: ownerIds };
        where.role = 'SELLER'; 
    }

    // [MAIN QUERY] Thực hiện query chính với Prisma
    // Sử dụng Promise.all để chạy count và findMany song song
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          phone: true,
          role: true,
          avatar: true,
          isVerified: true,
          isBanned: true,
          banReason: true,
          createdAt: true,
          // Lấy thông tin Ví
          pointWallet: {
            select: { balance: true }
          },
          // Lấy thông tin Shop cơ bản
          shop: {
            select: { 
                id: true, 
                name: true, 
                status: true,
                categoryId: true, // Lấy ID danh mục
                category: {       // Join sang bảng Category để lấy tên
                    select: { name: true }
                }
            }
          }
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    // [POST-PROCESSING] Tính toán ngành hàng chuyên cho từng user (nếu chưa lọc industry)
    // Để hiển thị ra Frontend cho đẹp.
    // Lưu ý: Nếu list dài, việc này có thể làm chậm. Ta chỉ làm nhẹ nhàng.
    const enrichedUsers = await Promise.all(users.map(async (u) => {
        let dominantCategoryName: string | null = null;
        
        if (u.role === 'SELLER' && u.shop) {
             // Ưu tiên 1: Lấy từ sản phẩm (Logic cũ)
             const topCat = await this.prisma.product.groupBy({
                 by: ['categoryId'],
                 where: { shopId: u.shop.id, status: 'ACTIVE' },
                 _count: { categoryId: true },
                 orderBy: { _count: { categoryId: 'desc' } },
                 take: 1
             });

             if (topCat.length > 0 && topCat[0].categoryId) {
                 const catInfo = await this.prisma.category.findUnique({
                     where: { id: topCat[0].categoryId },
                     select: { name: true }
                 });
                 dominantCategoryName = catInfo?.name || null;
             } 
             // Ưu tiên 2: [SỬA] Nếu chưa có sản phẩm, lấy từ danh mục đăng ký (đã select ở Bước 1)
             else if ((u.shop as any).category) {
                 dominantCategoryName = (u.shop as any).category.name;
             }
        }

        return {
            ...u,
            pointBalance: u.pointWallet?.balance || 0,
            dominantIndustry: dominantCategoryName 
        };
    }));

    return {
      data: enrichedUsers,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createUser(adminId: string, dto: CreateUserDto) {
    // 1. Validate cơ bản: Phải có Email hoặc Username
    if (!dto.email && !dto.username) {
      throw new BadRequestException('Phải cung cấp ít nhất Email hoặc Username');
    }

    // 2. Validate riêng cho Seller
    if (dto.role === 'SELLER' && !dto.shopName) {
        throw new BadRequestException('Vui lòng nhập Tên Cửa Hàng cho tài khoản Người bán');
    }

    // 3. Check trùng lặp User (Email hoặc Username)
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          dto.email ? { email: dto.email } : {},
          dto.username ? { username: dto.username } : {}
        ]
      }
    });

    if (existingUser) {
      throw new ConflictException('Email hoặc Username đã tồn tại trong hệ thống');
    }

    // 4. Hash Password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // 5. Chuẩn bị dữ liệu Slug nếu là Seller
    let shopSlug = '';
    if (dto.role === 'SELLER' && dto.shopName) {
        shopSlug = generateSlug(dto.shopName);
        // Kiểm tra xem Slug này có bị trùng trong bảng Shop không (dù xác suất thấp do có timestamp)
        const existingShop = await this.prisma.shop.findUnique({
            where: { slug: shopSlug }
        });
        if (existingShop) {
            // Regenerate lại nếu xui xẻo trùng
            shopSlug = generateSlug(dto.shopName) + '-' + Math.floor(Math.random() * 100);
        }
    }

    // 6. Transaction: Tạo User -> (Nếu Seller) Tạo Shop
    const result = await this.prisma.$transaction(async (prisma) => {
        // A. Tạo User
        const newUser = await prisma.user.create({
            data: {
                name: dto.name,
                email: dto.email || null, // Xử lý trường hợp không gửi email
                // Logic tạo username tự động nếu không có
                username: dto.username || (dto.email ? dto.email.split('@')[0] + Math.floor(Math.random() * 1000) : `user${Date.now()}`),
                password: hashedPassword,
                role: dto.role || Role.BUYER, // Dùng Enum Role chuẩn của Prisma
                isVerified: true,
                phone: dto.phone || null,
                
                // [LƯU Ý] Chỉ thêm dòng này nếu trong schema.prisma bảng User CÓ trường shopName. 
                // Nếu không thì xóa dòng dưới đi (vì shopName đã lưu ở bảng Shop rồi).
                shopName: dto.role === 'SELLER' ? dto.shopName : null, 

                cart: { create: {} },
                pointWallet: { create: { balance: 0 } }
            }
        });

        // B. Nếu là Seller -> Tạo Shop
        if (dto.role === 'SELLER' && dto.shopName) {
            await prisma.shop.create({
                data: {
                    name: dto.shopName,
                    slug: shopSlug,
                    description: `Cửa hàng chính thức của ${dto.name}`,
                    ownerId: newUser.id,
                    status: ShopStatus.ACTIVE,
                    rating: 0,
                    totalSales: 0,
                    pickupAddress: "Đang cập nhật",
                    lat: 0, 
                    lng: 0
                }
            });
        }
        
        return newUser;
    });

    // 7. Tracking
    await this.trackingService.trackEvent(adminId, 'admin-action', {
      type: EventType.CREATE_USER, // Đảm bảo EventType.CREATE_USER đã tồn tại trong enum
      targetId: result.id,
      metadata: { 
          role: dto.role, 
          email: result.email,
          shopName: dto.shopName 
      }
    });

    // Loại bỏ password trước khi trả về
    const { password, ...userSafe } = result;
    return userSafe;
  }

  async toggleBanUser(adminId: string, userId: string, isBanned: boolean, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Người dùng không tồn tại');

    // Không cho phép khóa Admin khác (để an toàn)
    if (user.role === 'ADMIN' && isBanned) {
      throw new BadRequestException('Không thể khóa tài khoản Admin');
    }

    // Update trạng thái
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: isBanned,
        banReason: isBanned ? reason : null // Nếu mở khóa thì xóa lý do
      }
    });

    // Nếu khóa User -> Cần xem xét khóa luôn Shop của họ (nếu có)
    // Wiki 0086: CHỈ khóa-theo-chủ những shop đang ACTIVE. Shop đã ở trạng thái khác
    // (BANNED vì vi phạm riêng, REJECTED, PENDING...) KHÔNG bị đè banReason — giữ nguyên
    // lý do/trạng thái gốc, tránh việc unban sau này khôi phục nhầm.
    if (isBanned && user.role === 'SELLER') {
       await this.prisma.shop.updateMany({
         where: { ownerId: userId, status: ShopStatus.ACTIVE },
         data: { status: ShopStatus.BANNED, banReason: OWNER_BAN_REASON_PREFIX + (reason || 'tài khoản chủ sở hữu bị khóa') }
       });
    }

    // Nếu mở khóa User là SELLER -> Khôi phục lại Shop về ACTIVE (đảo ngược logic ban ở trên)
    // Wiki 0086 (bug #19): CHỈ khôi phục những shop bị khóa DO chủ bị ban (banReason mang
    // prefix marker). Shop bị BANNED vì vi phạm của CHÍNH NÓ (qua toggleBanShop) phải được
    // giữ nguyên, để admin chủ động mở khóa shop bằng toggleBanShop nếu thấy phù hợp.
    if (!isBanned && user.role === 'SELLER') {
       await this.prisma.shop.updateMany({
         where: {
           ownerId: userId,
           status: ShopStatus.BANNED,
           banReason: { startsWith: OWNER_BAN_REASON_PREFIX },
         },
         data: { status: ShopStatus.ACTIVE, banReason: null }
       });
    }

    // Tracking
    await this.trackingService.trackEvent(adminId, 'admin-action', {
      type: isBanned ? EventType.BAN_USER : EventType.UNBAN_USER, // Cần thêm vào Enum EventType
      targetId: userId,
      metadata: { reason, email: user.email }
    });

    return {
      success: true,
      message: isBanned 
        ? `Đã khóa tài khoản ${user.name}` 
        : `Đã mở khóa tài khoản ${user.name}`,
      user: { id: updatedUser.id, isBanned: updatedUser.isBanned }
    };
  }
  async deleteUser(adminId: string, userId: string) {
    // 1. Kiểm tra User và các quan hệ 1-1 quan trọng
    const user = await this.prisma.user.findUnique({ 
        where: { id: userId },
        include: { 
            shop: true,
            pointWallet: true,
            dailyCheckIn: true,
            cart: true
        } 
    });
    
    if (!user) throw new NotFoundException('Người dùng không tồn tại');
    if (user.role === 'ADMIN') throw new BadRequestException('Không thể xóa Admin');

    // 2. Thực hiện xóa toàn bộ dữ liệu liên quan trong một Transaction
    await this.prisma.$transaction(async (tx) => {
        
        // --- NHÓM 1: DỮ LIỆU CỬA HÀNG (Nếu là Seller) ---
        if (user.shop) {
            const shopId = user.shop.id;
            const shopProductIds = (await tx.product.findMany({ where: { shopId }, select: { id: true } })).map(p => p.id);
            // Wiki 0086: ProductReview.productId mặc định RESTRICT → review của BUYER KHÁC trên sản
            // phẩm của shop chặn xóa product. Trước đây chỉ xóa review theo userId (của seller) →
            // xóa seller-có-sản-phẩm-được-người-khác-đánh-giá FAIL (FK). Xóa review theo productId.
            // (CartItem.productId=Cascade, OrderItem.productId=SetNull → KHÔNG chặn, bỏ qua.)
            if (shopProductIds.length) {
                await tx.flashSaleProduct.deleteMany({ where: { productId: { in: shopProductIds } } });
                await tx.productVariant.deleteMany({ where: { productId: { in: shopProductIds } } });
                await tx.productReview.deleteMany({ where: { productId: { in: shopProductIds } } });
            }
            await tx.product.deleteMany({ where: { shopId: shopId } });
            await tx.shopCategory.deleteMany({ where: { shopId: shopId } });
            await tx.voucher.deleteMany({ where: { shopId: shopId } });
            // ShopReview.shopId RESTRICT → review của buyer khác chặn xóa shop → xóa trước.
            await tx.shopReview.deleteMany({ where: { shopId: shopId } });
            await tx.shop.delete({ where: { id: shopId } });
        }

        // --- NHÓM 2: DỮ LIỆU GIAO DỊCH & TÀI CHÍNH ---
        // Wiki 0086: Donation.userId RESTRICT chặn xóa user đã quyên góp. Set NULL (ẩn danh) thay vì
        // xóa, để GIỮ tổng tiền quỹ charity đúng (tiền đã quyên thật, không trừ khỏi fund).
        await tx.donation.updateMany({ where: { userId: userId }, data: { userId: null } });
        await tx.payoutRequest.deleteMany({ where: { userId: userId } });
        await tx.walletTransaction.deleteMany({ where: { userId: userId } });
        await tx.pointTransaction.deleteMany({ where: { userId: userId } });
        await tx.pointHistory.deleteMany({ where: { userId: userId } });
        if (user.pointWallet) await tx.pointWallet.delete({ where: { userId: userId } });
        if (user.dailyCheckIn) await tx.dailyCheckIn.delete({ where: { userId: userId } });

        // --- NHÓM 3: TƯƠNG TÁC & CÁ NHÂN HÓA ---
        await tx.address.deleteMany({ where: { userId: userId } });
        await tx.userVoucher.deleteMany({ where: { userId: userId } });
        // Wiki 0082: review/complaint của user (FK userId + orderId, KHÔNG cascade) phải xóa TRƯỚC
        // order/user — nếu không sẽ vướng FK constraint → xóa user luôn FAIL với buyer thật (đã review).
        await tx.productReview.deleteMany({ where: { userId: userId } });
        await tx.shopReview.deleteMany({ where: { userId: userId } });
        await tx.complaint.deleteMany({ where: { userId: userId } });
        await tx.orderItem.deleteMany({ where: { order: { userId: userId } } }); // Xóa items trước
        await tx.order.deleteMany({ where: { userId: userId } });
        
        // Xóa giỏ hàng
        await tx.cartItem.deleteMany({ where: { cartId: user.cart?.id } });
        if (user.cart) await tx.cart.delete({ where: { userId: userId } });

        // --- NHÓM 4: GIAO TIẾP & MẠNG XÃ HỘI ---
        // Xóa tin nhắn gửi đi
        await tx.message.deleteMany({ where: { senderId: userId } });
        // Xóa quan hệ bạn bè (Friendship đã có onDelete: Cascade ở schema nên có thể bỏ qua hoặc xóa tay cho chắc)
        await tx.friendship.deleteMany({ 
            where: { OR: [{ senderId: userId }, { receiverId: userId }] } 
        });

        // --- NHÓM 5: NỘI DUNG ---
        await tx.blogPost.deleteMany({ where: { authorId: userId } });
        await tx.analyticsLog.deleteMany({ where: { userId: userId } });

        // 3. CUỐI CÙNG: XÓA USER
        await tx.user.delete({ where: { id: userId } });
    });

    // 4. Tracking
    await this.trackingService.trackEvent(adminId, 'admin-action', {
      type: EventType.DELETE_USER,
      targetId: userId,
      metadata: { email: user.email, action: 'Hard Delete' }
    });

    return { success: true, message: `Hệ thống đã dọn dẹp sạch sẽ dữ liệu của ${user.email}` };
  }
}