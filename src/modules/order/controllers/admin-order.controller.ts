// Backend-1.1.2/modules/order/controllers/admin-order.controller.ts
import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { OrderStatus, Role } from '@prisma/client';
import { OrderService } from '../order.service';

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN) // Chỉ Admin mới truy cập được
export class AdminOrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  async getAllOrders(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('status') status: string,
    @Query('search') search: string,
  ) {
    return this.orderService.findAll({ page, limit, status, search });
  }

  // #55 — wire admin "Xem chi tiết đơn" action.
  @Get(':id')
  async getOrderDetail(@Param('id') id: string) {
    return this.orderService.findOneAsAdmin(id);
  }

  /**
   * wiki 0108 — ADM-088: controller này trước đây CHỈ CÓ `@Get`. Admin không có cách nào
   * sửa một đơn bị kẹt (shop bỏ bê, khách gọi tổng đài xin huỷ, giao nhầm...); mọi đường
   * `PATCH/PUT /admin/orders/:id...` đều 404.
   *
   * Ủy quyền cho `updateOrderStatusAsAdmin`, hàm này lại ủy quyền tiếp cho đúng logic của
   * người bán — nên admin vẫn phải tuân máy trạng thái (không lùi, không đổi tiếp khi đã
   * DELIVERED/CANCELLED) và vẫn được hưởng đầy đủ bồi hoàn tồn kho/xu/voucher khi huỷ.
   */
  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: { status: OrderStatus }) {
    return this.orderService.updateOrderStatusAsAdmin(id, body?.status);
  }
}