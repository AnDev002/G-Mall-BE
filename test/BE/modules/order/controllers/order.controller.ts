import { Controller, Post, Body, UseGuards, Request, Get, Param, Query, Patch } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { OrderService } from '../order.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { OrderStatus } from '@prisma/client';
import { SubmitOrderReviewDto } from '../dto/submit-review.dto';
import { User } from 'src/common/decorators/user.decorator';
import { ReviewService } from '../review.service';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly reviewService: ReviewService,
  ) {}

  // API tính giá trước khi đặt (Frontend gọi khi user thay đổi voucher, shipping...)
  @Post('preview')
  async preview(@Request() req, @Body() dto: CreateOrderDto) {
    return this.orderService.previewOrder(req.user.id, dto);
  }

  // API đặt hàng thật
  @Post()
  async create(@Request() req, @Body() dto: CreateOrderDto) {
    // Hứng kết quả từ Service (Lúc này là { orders: Order[], paymentUrl: ... })
    const result = await this.orderService.createOrder(req.user.id, dto);

    // [FIX] Không còn result.order nữa, mà là result.orders (mảng)
    // Nếu bạn cần lấy ID để redirect, có thể lấy ID của đơn đầu tiên hoặc trả về cả danh sách
    
    return {
      success: true,
      message: 'Đặt hàng thành công',
      // Trả về danh sách các đơn hàng đã được tạo (do tách shop)
      orders: result.orders, 
      // Hoặc nếu FE cần 1 ID đại diện để redirect:
      // orderId: result.orders[0]?.id, 
      
      paymentUrl: result.paymentUrl, 
    };
  }
  @Post('review')
  async submitReview(@User() user: any, @Body() dto: SubmitOrderReviewDto) {
    return this.reviewService.submitReview(user.id, dto);
  }
  
  @Get()
  async findAll(@Request() req, @Query('status') status?: string) {
    const filterStatus = (status === 'all' || !status) ? undefined : status.toUpperCase();
    return this.orderService.getUserOrders(req.user.id, filterStatus);
  }

  @Get('seller')
  @UseGuards(JwtAuthGuard)
  async getSellerOrders(@Request() req, @Query('status') status?: string) {
    return this.orderService.getSellerOrders(req.user.id, status);
  }

  @Post(':id/confirm')
  async confirmReceived(@Request() req, @Param('id') id: string) {
    // Gọi xuống service method mà chúng ta đã viết ở bước trước
    return this.orderService.confirmOrderReceived(req.user.id, id);
  }


  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    return this.orderService.findOne(id, req.user.id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: OrderStatus,
    @Request() req
  ) {
    return this.orderService.updateOrderStatus(id, req.user.id, status);
  }


  @Get('seller/:id')
  @UseGuards(JwtAuthGuard)
  async getSellerOrderDetail(@Param('id') id: string, @Request() req) {
    return this.orderService.getSellerOrderDetail(id, req.user.id);
  }
  
  @Patch(':id/cancel')
  async cancelOrder(@Request() req, @Param('id') id: string) {
    return this.orderService.cancelOrder(req.user.id, id);
  }
}