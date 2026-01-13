import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service'; // Đường dẫn tuỳ project bạn
import slugify from 'slugify'; // Cần cài: npm i slugify

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

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
      orderBy: {
        name: 'asc', // Hoặc thêm field 'order' nếu muốn sắp xếp tùy chỉnh
      },
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
}