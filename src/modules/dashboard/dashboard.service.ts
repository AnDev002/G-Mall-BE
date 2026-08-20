import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service'; // Kiểm tra lại path này nếu cần
// [round14 FIX L2] dùng ShopStatus đếm shop ACTIVE (bỏ Role không còn dùng)
// wiki 0111: thêm Prisma (cần `Prisma.DbNull` cho cột JSON) + các enum trạng thái chờ duyệt.
import {
  OrderStatus,
  ShopStatus,
  Prisma,
  AffiliateAccountStatus,
  ProductStatus,
  PayoutStatus,
} from '@prisma/client';
import moment from 'moment';
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    // 1. SỬA: Dùng OrderStatus.DELIVERED thay vì COMPLETED
    const revenueAgg = await this.prisma.order.aggregate({
      _sum: {
        totalAmount: true,
      },
      where: {
        status: OrderStatus.DELIVERED, 
      },
    });

    const totalOrders = await this.prisma.order.count();

    // wiki 0108: giao diện quản trị gắn nhãn "Đơn hàng mới" cho `totalOrders`, nhưng đó
    // là ĐẾM TẤT CẢ đơn từ trước tới nay (đo trên prod: 262, trong khi 30 ngày gần nhất
    // chỉ có 17). Một con số đứng yên hàng tháng dưới cái tên "mới" thì vô dụng — tệ hơn
    // là gây hiểu nhầm. Trả thêm số đơn 30 ngày gần nhất để giao diện hiển thị đúng thứ
    // nó đang hứa; `totalOrders` vẫn giữ nguyên cho chỗ nào cần tổng.
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const newOrders30d = await this.prisma.order.count({
      where: { createdAt: { gte: new Date(Date.now() - THIRTY_DAYS_MS) } },
    });

    const totalUsers = await this.prisma.user.count();

    // [round14 FIX L2] Đếm Shop thực sự ACTIVE (loại shop banned/pending và seller chưa có shop).
    const activeShops = await this.prisma.shop.count({
      where: { status: ShopStatus.ACTIVE },
    });

    return {
      totalRevenue: Number(revenueAgg._sum.totalAmount) || 0, // Convert Decimal to Number để FE dễ đọc
      totalOrders,
      newOrders30d,
      totalUsers,
      activeShops,
    };
  }

  /**
   * wiki 0111 — đếm việc đang chờ admin xử lý, cho badge trên menu quản trị.
   *
   * Vì sao cần: các màn duyệt nằm rải trong những nhóm menu ĐANG ĐÓNG, nên admin không
   * nhìn thấy việc mới trừ khi tự mở từng nhóm ra xem. Đo trên prod ngày 20/08: một hồ sơ
   * tiếp thị của người thật nằm chờ 2 ngày, không ai biết. Con số ở đây là để việc tự tìm
   * đến admin, thay vì admin phải đi tìm việc.
   *
   * Một endpoint gộp thay vì để giao diện gọi 6 API: menu hiện ở MỌI trang quản trị, sáu
   * lượt gọi mỗi lần đổi trang là lãng phí thấy rõ. Tất cả đều là `count` không join, chạy
   * song song.
   *
   * Về index: năm cột `status` đều có index (`Product.status` được thêm ở wiki 0111 — trước
   * đó bảng lớn nhất hệ thống lại là bảng duy nhất thiếu, xem `prisma/manual/0111-*.sql`).
   * Riêng `shopUpdates` lọc trên cột JSON `pendingDetails` thì KHÔNG index được; chấp nhận
   * quét bảng Shop vì bảng này nhỏ hơn hai bậc so với Product (85 dòng trên prod, 20/08).
   *
   * Số ở đây phải KHỚP với số dòng mà trang tương ứng hiển thị khi mở ra — badge nói "3"
   * mà bấm vào thấy 5 dòng thì còn tệ hơn không có badge. Nên mỗi phép đếm dưới đây sao y
   * điều kiện lọc mặc định của chính trang đó.
   */
  async getPendingCounts() {
    const [
      affiliateAccounts,
      sellerApprovals,
      shopUpdates,
      productApprovals,
      payouts,
      complaints,
    ] = await Promise.all([
      // /admin/affiliate — tab hồ sơ, lọc mặc định "Chờ duyệt"
      this.prisma.affiliateAccount.count({
        where: { status: AffiliateAccountStatus.PENDING },
      }),
      // /admin/users/approvals — GET /admin/users/pending-shops
      this.prisma.shop.count({ where: { status: ShopStatus.PENDING } }),
      // GET /admin/users/shop-updates — shop đã hoạt động nhưng gửi yêu cầu sửa hồ sơ.
      // Cột JSON: phải dùng `Prisma.DbNull`, `{ not: null }` không cùng ngữ nghĩa.
      // KHÔNG lọc thêm status: giữ đúng điều kiện của trang danh sách để hai con số khớp
      // nhau, chấp nhận việc một shop vừa PENDING vừa có pendingDetails được tính ở cả hai.
      this.prisma.shop.count({ where: { pendingDetails: { not: Prisma.DbNull } } }),
      // /admin/products/approvals — GET /admin/products?status=PENDING.
      // DRAFT là seller chưa gửi duyệt nên không tính.
      this.prisma.product.count({ where: { status: ProductStatus.PENDING } }),
      // /admin/finance/payouts
      this.prisma.payoutRequest.count({ where: { status: PayoutStatus.PENDING } }),
      // /admin/complaints — lọc mặc định "Chờ xử lý" = 'open' (cột String, không phải enum).
      // 'processing' cố ý KHÔNG tính: việc đó đã có người nhận, badge chỉ nhắc việc chưa ai đụng.
      this.prisma.complaint.count({ where: { status: 'open' } }),
    ]);

    return {
      affiliateAccounts,
      sellerApprovals,
      shopUpdates,
      productApprovals,
      payouts,
      complaints,
    };
  }

  async getSellerStats(sellerId: string) {
    // 1. Tính tổng doanh thu & đơn hàng thành công
    const soldItems = await this.prisma.orderItem.findMany({
      where: {
          product: { is: { sellerId: sellerId } },
          order: { status: OrderStatus.DELIVERED }
      },
      select: { price: true, quantity: true }
    });
    
    const totalRevenue = soldItems.reduce((acc, item) => {
        return acc + (Number(item.price) * item.quantity);
    }, 0);

    // 2. Tổng số đơn hàng (liên quan đến seller)
    const totalOrders = await this.prisma.order.count({
      where: { items: { some: { product: { is: { sellerId } } } } },
    });

    // 3. Tổng sản phẩm & sản phẩm sắp hết hàng
    const totalProducts = await this.prisma.product.count({
      where: { sellerId },
    });

    const lowStockProducts = await this.prisma.product.count({
      where: { sellerId, stock: { lte: 5 } }
    });

    // --- PHẦN MỚI: Todo List Stats (Đếm trạng thái đơn) ---
    const pendingOrders = await this.prisma.order.count({
      where: { 
        status: OrderStatus.PENDING,
        items: { some: { product: { is: { sellerId } } } }
      }
    });

    const shippingOrders = await this.prisma.order.count({
      where: {
        status: OrderStatus.SHIPPING,
        items: { some: { product: { is: { sellerId } } } }
      }
    });

    // Wiki 0068 A6: đơn CONFIRMED ("Chờ lấy hàng") cũng cần seller xử lý (nút
    // "Giao ĐVVC" trong OrderTable). Trước đây todo thiếu confirmed nên sidebar
    // "Đơn chờ" (= pending) đếm thiếu → hiển thị chưa chính xác.
    const confirmedOrders = await this.prisma.order.count({
      where: {
        status: OrderStatus.CONFIRMED,
        items: { some: { product: { is: { sellerId } } } }
      }
    });

    // OrderStatus enum không có 'RETURNED' (chỉ PENDING/CONFIRMED/SHIPPING/
    // DELIVERED/CANCELLED). Trước đây ép `as any` làm Prisma runtime fail 500
    // khi seller load dashboard. Tạm dùng CANCELLED — nếu sau cần "đơn trả",
    // thêm enum value và migration.
    const returnedOrders = await this.prisma.order.count({
      where: {
        status: 'CANCELLED',
        items: { some: { product: { is: { sellerId } } } }
      }
    });

    // --- PHẦN MỚI: Chart Data (Doanh thu 7 ngày qua) ---
    const chartData: { date: string; revenue: number }[] = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));

      // Lấy các item bán được trong ngày này
      const dailyItems = await this.prisma.orderItem.findMany({
        where: {
          product: { is: { sellerId } },
          order: {
            status: OrderStatus.DELIVERED,
            updatedAt: {
              gte: startOfDay,
              lte: endOfDay
            }
          }
        },
        select: { price: true, quantity: true }
      });

      const dailyRevenue = dailyItems.reduce((acc, item) => acc + (Number(item.price) * item.quantity), 0);
      
      chartData.push({
        date: moment(startOfDay).format('DD/MM'), // Format ngày hiển thị
        revenue: dailyRevenue
      });
    }

    // Tính Rating trung bình (nếu có bảng Review)
    // Tạm thời mock hoặc query từ bảng Review nếu bạn đã có
    const rating = 4.8; 

    return {
      revenue: totalRevenue,
      orders: totalOrders,
      products: totalProducts,
      rating: rating,
      lowStockProducts,
      todo: {
        pending: pendingOrders,
        confirmed: confirmedOrders,
        shipping: shippingOrders,
        returned: returnedOrders
      },
      chart: chartData
    };
  }
}