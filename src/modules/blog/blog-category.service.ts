// src/modules/blog/blog-category.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
// [FIX] Import chính xác hàm generateSlug, KHÔNG import SlugUtil
import { generateSlug } from '../../common/utils/slug.util'; 

@Injectable()
export class BlogCategoryService {
  constructor(private prisma: PrismaService) {}

  async create(data: { name: string; parentId?: string }) {
    return this.prisma.blogCategory.create({
      data: {
        name: data.name,
        // [FIX] Gọi trực tiếp hàm generateSlug(string)
        slug: generateSlug(data.name), 
        parentId: data.parentId || null,
      },
    });
  }

  async findAll() {
    // Wiki 0068 C10: sắp theo sortOrder (admin kéo thả) rồi createdAt cho ổn định.
    return this.prisma.blogCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        children: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      },
    });
  }

  // Wiki 0068 C10: lưu thứ tự kéo thả. Nhận mảng {id, sortOrder} của các danh mục
  // cùng cấp (hoặc bất kỳ), update trong 1 transaction để toàn vẹn.
  async reorder(items: { id: string; sortOrder: number }[]) {
    if (!Array.isArray(items) || items.length === 0) return { count: 0 };
    await this.prisma.$transaction(
      items.map((it) =>
        this.prisma.blogCategory.update({
          where: { id: it.id },
          data: { sortOrder: it.sortOrder },
        }),
      ),
    );
    return { count: items.length };
  }

  // Wiki 0068 C10: FE CategoryManagerModal gọi PATCH /admin/blog-categories/:id
  // (updateCategory) nhưng BE chưa có endpoint → edit danh mục im lặng fail.
  // Bổ sung update name/parentId (giữ nguyên slug cho URL ổn định).
  async update(id: string, data: { name?: string; parentId?: string | null }) {
    if (data.parentId && data.parentId === id) {
      throw new BadRequestException('Không thể chọn chính danh mục này làm cha');
    }
    // Wiki 0086: chặn chọn CON/CHÁU làm cha (tạo vòng lặp cây) — mirror product
    // CategoryService.update. Đi ngược từ parentId lên gốc; nếu gặp lại `id` thì
    // parentId nằm trong cây con của id → vòng lặp. Trước đây thiếu check này.
    if (data.parentId) {
      let cur = await this.prisma.blogCategory.findUnique({
        where: { id: data.parentId },
        select: { id: true, parentId: true },
      });
      const seen = new Set<string>();
      while (cur && cur.parentId) {
        if (cur.parentId === id) {
          throw new BadRequestException(
            'Không thể chọn danh mục con/cháu làm cha (tạo vòng lặp)',
          );
        }
        if (seen.has(cur.parentId)) break; // an toàn nếu DB đã có vòng sẵn
        seen.add(cur.parentId);
        cur = await this.prisma.blogCategory.findUnique({
          where: { id: cur.parentId },
          select: { id: true, parentId: true },
        });
      }
    }
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.parentId !== undefined) updateData.parentId = data.parentId || null;
    return this.prisma.blogCategory.update({ where: { id }, data: updateData });
  }

  async remove(id: string) {
    return this.prisma.blogCategory.delete({ where: { id } });
  }
}