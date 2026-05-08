import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class NewsletterService {
  constructor(private readonly prisma: PrismaService) {}

  async subscribe(email: string, sourceTag = 'footer') {
    const normalized = email.trim().toLowerCase();

    // Upsert: nếu email đã tồn tại → reactivate; chưa có → tạo mới.
    // Tránh leak (cùng email tạo nhiều bản ghi) và đỡ check exists trước.
    const existing = await this.prisma.newsletterSubscriber.findUnique({
      where: { email: normalized },
    });

    if (existing) {
      if (existing.isActive) {
        return { ok: true, alreadySubscribed: true };
      }
      await this.prisma.newsletterSubscriber.update({
        where: { email: normalized },
        data: {
          isActive: true,
          unsubscribedAt: null,
          sourceTag: sourceTag || existing.sourceTag,
        },
      });
      return { ok: true, reactivated: true };
    }

    await this.prisma.newsletterSubscriber.create({
      data: { email: normalized, sourceTag },
    });
    return { ok: true };
  }

  async unsubscribe(email: string) {
    const normalized = email.trim().toLowerCase();
    const sub = await this.prisma.newsletterSubscriber.findUnique({
      where: { email: normalized },
    });
    if (!sub) throw new BadRequestException('Email không tồn tại trong danh sách');
    if (!sub.isActive) return { ok: true };

    await this.prisma.newsletterSubscriber.update({
      where: { email: normalized },
      data: { isActive: false, unsubscribedAt: new Date() },
    });
    return { ok: true };
  }
}
