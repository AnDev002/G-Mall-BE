import { Controller, Get, Post, Body, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../database/prisma/prisma.service';

@Controller('seller/shop-categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SELLER')
export class ShopCategoryController {
  constructor(private prisma: PrismaService) {}

  @Post()
  async create(@Request() req, @Body('name') name: string) {
    // [SỬA LỖI] Đổi userId -> ownerId
    const shop = await this.prisma.shop.findFirst({ 
        where: { ownerId: req.user.userId } // Hoặc req.user.id tùy vào JWT strategy của bạn trả về key nào
    });

    if (!shop) {
        throw new NotFoundException('Không tìm thấy thông tin Shop của tài khoản này');
    }

    return this.prisma.shopCategory.create({
      data: { name, shopId: shop.id }
    });
  }

  @Get()
  async findAll(@Request() req) {
    // [SỬA LỖI] Đổi userId -> ownerId
    const shop = await this.prisma.shop.findFirst({ 
        where: { ownerId: req.user.userId } // Hoặc req.user.id
    });

    if (!shop) {
        throw new NotFoundException('Không tìm thấy thông tin Shop');
    }

    return this.prisma.shopCategory.findMany({
      where: { shopId: shop.id, isActive: true },
      include: { _count: { select: { products: true } } }
    });
  }
}