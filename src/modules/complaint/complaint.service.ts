import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

const VALID_CATEGORIES = new Set(['shipping', 'product', 'finance', 'system', 'other']);
const VALID_STATUSES = new Set(['open', 'processing', 'resolved', 'rejected']);

interface CreateComplaintInput {
  category: string;
  title: string;
  content: string;
  relatedOrderId?: string | null;
  attachments?: string[];
}

@Injectable()
export class ComplaintService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateComplaintInput) {
    if (!VALID_CATEGORIES.has(dto.category)) {
      throw new BadRequestException('Danh mục khiếu nại không hợp lệ');
    }
    if (!dto.title?.trim()) throw new BadRequestException('Tiêu đề là bắt buộc');
    if (!dto.content?.trim()) throw new BadRequestException('Nội dung là bắt buộc');

    return this.prisma.complaint.create({
      data: {
        userId,
        category: dto.category,
        title: dto.title.trim(),
        content: dto.content.trim(),
        relatedOrderId: dto.relatedOrderId?.trim() || null,
        attachments: Array.isArray(dto.attachments) ? dto.attachments : [],
      },
    });
  }

  async listMine(userId: string, params: { page?: number; limit?: number; status?: string } = {}) {
    const page = Math.max(Number(params.page) || 1, 1);
    const limit = Math.min(Math.max(Number(params.limit) || 10, 1), 50);
    const where: any = { userId };
    if (params.status && VALID_STATUSES.has(params.status)) where.status = params.status;

    const [data, total] = await Promise.all([
      this.prisma.complaint.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.complaint.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOneAsOwner(userId: string, id: string) {
    const c = await this.prisma.complaint.findFirst({ where: { id, userId } });
    if (!c) throw new NotFoundException('Không tìm thấy khiếu nại');
    return c;
  }

  // Admin endpoints
  async listAll(params: { page?: number; limit?: number; status?: string } = {}) {
    const page = Math.max(Number(params.page) || 1, 1);
    const limit = Math.min(Math.max(Number(params.limit) || 20, 1), 100);
    const where: any = {};
    if (params.status && VALID_STATUSES.has(params.status)) where.status = params.status;

    const [data, total] = await Promise.all([
      this.prisma.complaint.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.complaint.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async updateStatus(id: string, status: string, adminNote?: string) {
    if (!VALID_STATUSES.has(status)) throw new BadRequestException('Trạng thái không hợp lệ');
    return this.prisma.complaint.update({
      where: { id },
      data: {
        status,
        adminNote: adminNote?.trim() || null,
        resolvedAt: status === 'resolved' || status === 'rejected' ? new Date() : null,
      },
    });
  }
}
