import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { getPagination } from 'src/common/utils/pagination.util';
import { Prisma } from '@prisma/client';

/**
 * #11/#23/#35/#53 (wiki 0044/0045) — Notification service.
 *
 * Service được expose `create()` cho các module khác trigger (Order, Promotion,
 * Friend, Chat, ...) — không expose qua HTTP để tránh user tự tạo notif fake.
 *
 * Endpoint user-facing (xem controller):
 *   GET    /notifications       — list (paginate)
 *   GET    /notifications/unread-count
 *   PATCH  /notifications/:id/read
 *   PATCH  /notifications/read-all
 */
@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  /**
   * Tạo notif. Có thể truyền `tx` để gọi từ trong transaction (vd OrderService.confirm).
   * Best-effort — không throw nếu DB fail (caller có thể bị rollback trans nếu trans).
   */
  async create(
    data: {
      userId: string;
      type?: 'ORDER' | 'PROMOTION' | 'SYSTEM' | 'CHAT' | 'FRIEND';
      title: string;
      content: string;
      link?: string;
      image?: string;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    return client.notification.create({
      data: {
        userId: data.userId,
        type: data.type || 'SYSTEM',
        title: data.title,
        content: data.content,
        link: data.link,
        image: data.image,
      },
    });
  }

  async listMine(userId: string, page = 1, pageSize = 20) {
    // Wiki 0074: clamp page/pageSize (page=-1 → skip âm → Prisma 500).
    const _pg = getPagination(page, pageSize, { defaultLimit: 20 });
    page = _pg.page; pageSize = _pg.limit;
    const skip = _pg.skip;
    const [items, total, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
    return { items, meta: { page, pageSize, total, unread } };
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  async markRead(userId: string, id: string) {
    const notif = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!notif) throw new NotFoundException('Thông báo không tồn tại');
    if (notif.isRead) return notif;
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { updated: result.count };
  }
}
