// Backend-1.1.2/modules/order/controllers/admin-order.controller.ts
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
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
}