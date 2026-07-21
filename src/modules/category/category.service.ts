import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service'; // Đường dẫn tuỳ project bạn
import slugify from 'slugify'; // Cần cài: npm i slugify
import { UpdateCategoryOrderDto } from './dto/update-category-order.dto';
import { generateSlug } from 'src/common/utils/slug.util';

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) { }

  // 1. Lấy danh sách category theo cấp (Cascading)
  async getCategories(parentId?: string) {
    const categories = await this.prisma.category.findMany({
      where: {
        parentId: parentId || null, // Nếu null thì lấy Root (Level 1)
      },
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        // Kỹ thuật tối ưu: Chỉ đếm số lượng con để biết có load tiếp hay không
        _count: {
          select: { children: true },
        },
      },
      // Wiki 0068 A13: sắp theo `order` (thứ tự hiển thị website) thay vì alphabet.
      // Khớp với getCategoryTree() + menu trang chủ. `name` là tie-break ổn định
      // khi nhiều danh mục cùng order (mặc định 0).
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });

    // Map lại dữ liệu để trả về field hasChildren boolean clean hơn
    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      parentId: cat.parentId,
      hasChildren: cat._count.children > 0,
    }));
  }
  async getCategoryBySlugWithChildren(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        children: {
          orderBy: { order: 'asc' } // Sắp xếp theo order admin đã set
        }
      }
    });
    if (!category) throw new NotFoundException('Danh mục không tồn tại');
    return category;
  }
  // 2. Tìm kiếm Category & Trả về Full Path (Breadcrumb)
  async searchCategories(keyword: string) {
    if (!keyword) return [];

    const categories = await this.prisma.category.findMany({
      where: {
        name: {
          contains: keyword,
          // mode: 'insensitive', // PostgreSQL hỗ trợ, MySQL cần config collation hoặc dùng raw query nếu cần thiết
        },
      },
      // Include ngược lên cha để lấy path. 
      // Giả sử tối đa 4 cấp, ta include 3 tầng parent.
      include: {
        parent: {
          include: {
            parent: {
              include: {
                parent: true,
              },
            },
          },
        },
      },
      take: 20, // Limit kết quả
    });

    // Helper function đệ quy để build chuỗi path
    const buildPath = (cat: any): string => {
      if (!cat.parent) return cat.name;
      return `${buildPath(cat.parent)} > ${cat.name}`;
    };

    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      path: buildPath(cat), // Kết quả: "Sức khỏe > Răng miệng > Bàn chải"
    }));
  }

  // 3. Helper lấy Breadcrumb chi tiết cho trang Product (SEO)
  // Dùng slug của category cuối cùng để truy ngược lên
  async getCategoryTreeBySlug(slug: string) {
    return this.prisma.category.findUnique({
      where: { slug },
      include: {
        parent: {
          include: {
            parent: {
              include: { parent: true }
            }
          }
        }
      }
    });
  }
  async updateOrder(dto: UpdateCategoryOrderDto) {
    const { parentId, orderedIds } = dto;
    const targetParentId = parentId || null;

    // Wiki 0082 fix-2: trước đây re-parent tất cả orderedIds vào parentId mà KHÔNG
    // kiểm tra gì → có thể tạo vòng lặp cây (gán 1 node làm con của chính con cháu
    // nó) hoặc gán vào id không tồn tại.

    // (a) parentId không được nằm trong chính tập orderedIds (node không thể là cha
    // của chính nó / của tập đang re-parent → vòng lặp trực tiếp).
    if (targetParentId && orderedIds.includes(targetParentId)) {
      throw new BadRequestException('Danh mục cha không được nằm trong danh sách cần sắp xếp (gây vòng lặp)');
    }

    // (b) Tất cả id (gồm cả parentId nếu có) phải tồn tại.
    const idsToCheck = targetParentId ? [...orderedIds, targetParentId] : orderedIds;
    const existing = await this.prisma.category.findMany({
      where: { id: { in: idsToCheck } },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((c) => c.id));
    const missing = idsToCheck.filter((id) => !existingIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(`Danh mục không tồn tại: ${missing.join(', ')}`);
    }

    // (c) Cycle check: parentId không được là con cháu của bất kỳ node nào đang
    // re-parent. Đi ngược từ parentId lên gốc; nếu gặp 1 id trong orderedIds nghĩa
    // là ta sắp đặt node đó làm cha của tổ tiên nó → vòng lặp.
    if (targetParentId) {
      const orderedSet = new Set(orderedIds);
      const seen = new Set<string>();
      let cur: { id: string; parentId: string | null } | null =
        await this.prisma.category.findUnique({
          where: { id: targetParentId },
          select: { id: true, parentId: true },
        });
      while (cur && cur.parentId) {
        if (orderedSet.has(cur.parentId)) {
          throw new BadRequestException('Không thể gán danh mục con/cháu làm cha (tạo vòng lặp)');
        }
        if (seen.has(cur.parentId)) break; // an toàn nếu DB đã có vòng sẵn
        seen.add(cur.parentId);
        cur = await this.prisma.category.findUnique({
          where: { id: cur.parentId },
          select: { id: true, parentId: true },
        });
      }
    }

    try {
      // Sử dụng Transaction để tối ưu hiệu năng và đảm bảo tính toàn vẹn
      // Thay vì await từng lệnh update, ta gom lại thành 1 mảng Promise
      const updateOperations = orderedIds.map((id, index) => {
        return this.prisma.category.update({
          where: { id },
          data: {
            order: index, // Vị trí trong mảng chính là thứ tự mới (0, 1, 2...)
            parentId: targetParentId, // Cập nhật luôn parentId để hỗ trợ kéo thả giữa các cấp cha con
          },
        });
      });

      // Thực thi đồng loạt
      await this.prisma.$transaction(updateOperations);

      return {
        success: true,
        message: 'Cập nhật thứ tự danh mục thành công',
        count: orderedIds.length
      };

    } catch (error) {
      // this.logger.error(`Lỗi khi cập nhật order category: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Không thể cập nhật thứ tự danh mục');
    }
  }
  async getCategoryTree() {
    // SỬA: Đổi tất cả 'name' thành 'order' trong orderBy
    return this.prisma.category.findMany({
      where: { parentId: null },
      orderBy: { order: 'asc' }, // <--- Sửa ở đây (Cấp 1)
      include: {
        children: {
          orderBy: { order: 'asc' }, // <--- Sửa ở đây (Cấp 2)
          include: {
            children: {
              orderBy: { order: 'asc' }, // <--- Sửa ở đây (Cấp 3)
              include: {
                children: {
                  orderBy: { order: 'asc' }, // <--- Sửa ở đây (Cấp 4)
                  include: {
                    children: {
                      orderBy: { order: 'asc' } // <--- Sửa ở đây (Cấp 5)
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
  }

  // [MỚI] Helper: Lấy danh sách tất cả ID con cháu của 1 categoryId
  // Dùng để filter product: Chọn cha ra cả con
  async getAllDescendantIds(rootId: string): Promise<string[]> {
    // Cách tối ưu nhất trong SQL là dùng Recursive CTE, nhưng với Prisma raw query:
    // Hoặc fetch flat list về xử lý. Ở đây dùng giải pháp fetch flat đơn giản an toàn.

    const allCategories = await this.prisma.category.findMany({
      select: { id: true, parentId: true }
    });

    const resultIds = [rootId];
    const queue = [rootId];

    while (queue.length > 0) {
      const currentId = queue.shift();
      const children = allCategories.filter(c => c.parentId === currentId);
      for (const child of children) {
        resultIds.push(child.id);
        queue.push(child.id);
      }
    }

    return resultIds;
  }

  async create(data: { name: string; slug?: string; parentId?: string; filterKeys?: any }) {
    const slug = data.slug || this.generateSlug(data.name);

    // Kiểm tra slug trùng
    const exist = await this.prisma.category.findUnique({ where: { slug } });
    if (exist) {
      throw new BadRequestException(`Slug '${slug}' đã tồn tại. Vui lòng chọn tên khác.`);
    }

    return this.prisma.category.create({
      data: {
        name: data.name,
        slug: slug,
        // Nếu parentId là chuỗi rỗng hoặc undefined -> null (Root)
        parentId: data.parentId && data.parentId.length > 0 ? data.parentId : null,
        // Spec [0018]: filter per category
        ...(data.filterKeys !== undefined ? { filterKeys: data.filterKeys as any } : {}),
      }
    });
  }

  // 3. [FIX] Cập nhật
  async update(id: string, data: { name?: string; slug?: string; parentId?: string; filterKeys?: any }) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Danh mục không tồn tại');

    // Prevent circular reference (Không thể chọn chính mình hoặc con cháu làm cha)
    if (data.parentId && data.parentId === id) {
      throw new BadRequestException('Không thể chọn chính danh mục này làm cha');
    }
    // Wiki 0082: chặn chọn CON/CHÁU làm cha (tạo vòng lặp cây). Đi ngược từ parentId lên gốc;
    // nếu gặp lại `id` thì parentId nằm trong cây con của id → là vòng lặp.
    if (data.parentId && data.parentId !== 'ROOT') {
      let cur = await this.prisma.category.findUnique({ where: { id: data.parentId }, select: { id: true, parentId: true } });
      if (!cur) throw new BadRequestException('Danh mục cha không tồn tại');
      const seen = new Set<string>();
      while (cur && cur.parentId) {
        if (cur.parentId === id) throw new BadRequestException('Không thể chọn danh mục con/cháu làm cha (tạo vòng lặp)');
        if (seen.has(cur.parentId)) break; // an toàn nếu DB đã có vòng sẵn
        seen.add(cur.parentId);
        cur = await this.prisma.category.findUnique({ where: { id: cur.parentId }, select: { id: true, parentId: true } });
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        parentId: data.parentId === 'ROOT' ? null : data.parentId, // Logic xử lý nếu muốn đưa về gốc
        // Spec [0018]: filter per category — null hoặc array đều cho qua, undefined skip update
        ...(data.filterKeys !== undefined ? { filterKeys: data.filterKeys as any } : {}),
      }
    });
  }

  // 4. [FIX] Xóa an toàn
  async remove(id: string) {
    // Wiki 0039 BUG-CAT-2: trước đây deleteMany trả 200 cho id không tồn tại
    // (silent success). Check trước, throw 404 đúng REST.
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Danh mục không tồn tại');

    // Sử dụng lại hàm helper có sẵn trong class để lấy ID của nó và toàn bộ con cháu
    const idsToDelete = await this.getAllDescendantIds(id);

    // [Optional] Kiểm tra an toàn: Có sản phẩm nào thuộc cây danh mục này không?
    // Nếu bạn muốn xoá bất chấp sản phẩm (sản phẩm sẽ mất categoryId hoặc lỗi) thì bỏ đoạn check này đi.
    const countProduct = await this.prisma.product.count({
      where: {
        categoryId: { in: idsToDelete }
      }
    });

    if (countProduct > 0) {
      throw new BadRequestException(`Đang có ${countProduct} sản phẩm thuộc danh mục này hoặc các danh mục con. Không thể xóa.`);
    }

    // Thực hiện xoá tất cả danh mục tìm được (bao gồm cả cha và con)
    return this.prisma.category.deleteMany({
      where: {
        id: { in: idsToDelete }
      }
    });
  }

  // 5. [MỚI] Update Bulk from JSON (Nguy hiểm - Chỉ dành cho Admin hiểu rõ)
  // Hàm này nhận vào mảng cấu trúc phẳng hoặc tree để sync lại DB. 
  // Để an toàn, ở đây tôi chỉ làm cập nhật Name/Slug theo ID, không xóa bừa bãi.
  async updateBatch(items: any[]) {
    // SỬA: Thêm kiểu dữ liệu : any[] để tránh lỗi type 'never'
    const results: any[] = [];

    for (const item of items) {
      if (item.id) {
        try {
          const updated = await this.prisma.category.update({
            where: { id: item.id },
            data: {
              name: item.name,
              slug: item.slug,
              parentId: item.parentId || null
            }
          });
          results.push(updated); // Giờ sẽ không còn lỗi
        } catch (e) {
          console.error(`Failed to update ${item.id}`, e);
        }
      }
    }
    return results;
  }

  private generateSlug(text: string) {
    return text.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
  }

  async getBreadcrumbs(categoryId: string) {
    // #15 (wiki 0044/0045/0046): trước đây hardcode include parent 4 cấp →
    // Category cấp 5+ bị skip parent ở giữa (vd "Mẹ và Bé > Dinh dưỡng cho bé"
    // chain bị mất). Spec Require GMall §5 cho phép tới 5 cấp + có thể tăng.
    // Sửa: loop iterative đi ngược parentId, không giới hạn cấp.
    // Cap cứng 10 vòng để đề phòng cycle data corruption.
    const breadcrumbs: { id: string; name: string; slug: string }[] = [];
    let currentId: string | null = categoryId;
    let iterations = 0;
    while (currentId && iterations < 10) {
      const cat = await this.prisma.category.findUnique({
        where: { id: currentId },
        select: { id: true, name: true, slug: true, parentId: true },
      });
      if (!cat) break;
      breadcrumbs.unshift({ id: cat.id, name: cat.name, slug: cat.slug });
      currentId = cat.parentId;
      iterations++;
    }
    return breadcrumbs;
  }

  /**
   * #10 (wiki 0044/0045/0046): khi user click category cấp cao (vd "Mẹ và Bé"),
   * SP của cấp con (Dinh dưỡng cho bé, Tã bỉm...) cũng phải hiển. Trước đây
   * query `categoryId = X` chỉ lấy SP đính trực tiếp vào X → empty.
   * Fix: BFS đi xuống lấy tất cả descendant ids + chính nó.
   * Cap depth 10 để tránh vô hạn nếu data có cycle.
   */
  async getDescendantIds(categoryId: string): Promise<string[]> {
    const result = new Set<string>([categoryId]);
    let frontier: string[] = [categoryId];
    let depth = 0;
    while (frontier.length > 0 && depth < 10) {
      const children = await this.prisma.category.findMany({
        where: { parentId: { in: frontier } },
        select: { id: true },
      });
      const childIds = children.map(c => c.id).filter(id => !result.has(id));
      if (childIds.length === 0) break;
      childIds.forEach(id => result.add(id));
      frontier = childIds;
      depth++;
    }
    return Array.from(result);
  }

  async fixAllSlugs() {
    const categories = await this.prisma.category.findMany();
    let count = 0;

    for (const cat of categories) {
      // Tạo slug mới bằng hàm chuẩn (xử lý tiếng Việt)
      const newSlug = generateSlug(cat.name);

      // Chỉ update nếu slug thực sự thay đổi
      if (newSlug !== cat.slug) {
        try {
          await this.prisma.category.update({
            where: { id: cat.id },
            data: { slug: newSlug }
          });
          count++;
        } catch (e) {
          console.error(`Lỗi update slug cho danh mục ${cat.name}:`, e);
        }
      }
    }
    return { message: `Đã sửa lỗi slug thành công cho ${count} danh mục.` };
  }
}