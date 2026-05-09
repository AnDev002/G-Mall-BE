import { Controller, Get, Patch, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { NotificationService } from './notification.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  @Get()
  async list(@Request() req, @Query('page') page = '1', @Query('pageSize') pageSize = '20') {
    return this.service.listMine(req.user.id, Number(page) || 1, Number(pageSize) || 20);
  }

  @Get('unread-count')
  async unread(@Request() req) {
    return this.service.unreadCount(req.user.id);
  }

  @Patch(':id/read')
  async markRead(@Request() req, @Param('id') id: string) {
    return this.service.markRead(req.user.id, id);
  }

  @Patch('read-all')
  async markAll(@Request() req) {
    return this.service.markAllRead(req.user.id);
  }
}
