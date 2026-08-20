import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
// SỬA DÒNG NÀY: Dùng đường dẫn đúng (lùi 1 cấp) hoặc đường dẫn tuyệt đối
import { JwtAuthGuard } from '../auth/guards/jwt.guard'; 
// Hoặc an toàn hơn: import { JwtAuthGuard } from 'src/modules/auth/guards/jwt.guard';

import { RolesGuard } from '../../common/guards/roles.guard'; // Nếu file này cũng báo lỗi tương tự, hãy sửa thành '../common/guards/roles.guard' nếu common ngang cấp với modules
// Kiểm tra lại đường dẫn RolesGuard:
// Nếu 'common' nằm trong 'src/common' và 'dashboard' nằm trong 'src/modules/dashboard':
// path đúng là: '../../common/guards/roles.guard' (modules -> src -> common)

import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  async getStats() {
    return this.dashboardService.getStats();
  }

  /**
   * wiki 0111 — số việc đang chờ xử lý, cho badge trên menu quản trị.
   * Tách khỏi `stats` chứ không nhét thêm vào đó: badge nằm ở mọi trang quản trị và cần
   * làm mới theo nhịp khác hẳn dashboard, còn `stats` thì giao diện dashboard đang dùng
   * với một hình dạng cố định — thêm khoá vào đó là đổi hợp đồng của người khác.
   */
  @Get('pending-counts')
  async getPendingCounts() {
    return this.dashboardService.getPendingCounts();
  }

  // THÊM MỚI: API cho Seller
  @Get('seller/stats')
  @Roles(Role.SELLER)
  async getSellerStats(@Request() req) {
    // req.user được lấy từ JwtStrategy
    return this.dashboardService.getSellerStats(req.user.id);
  }
}