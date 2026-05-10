import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class BrandService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Admin: List All with Counts ---
  async findAllAdmin(query: { search?: string; page?: number; limit?: number }) {
    const { search, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.BrandWhereInput = search
      ? { name: { contains: search } } // Removed mode: 'insensitive' for MySQL compatibility, add if using Postgres
      : {};

    const [brands, total] = await Promise.all([
      this.prisma.brand.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { products: true },
          },
        },
      }),
      this.prisma.brand.count({ where }),
    ]);

    // Map to Frontend Interface
    const data = brands.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      logoUrl: b.logoUrl,
      status: b.status,
      description: b.description,
      productCount: b._count.products, // Computed field
    }));

    return {
      data,
      meta: {
        total,
        page,
        last_page: Math.ceil(total / limit),
      },
    };
  }

  // --- Public/Seller: Lightweight List ---
  async findAllActive() {
    return this.prisma.brand.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        name: true,
        logoUrl: true, // Needed for UI dropdowns
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * #22 (wiki 0044/0045/0046): brand chips dưới banner ở product detail.
   * Trả các brand có ≥ 1 product trong category (hoặc descendant) cho trước.
   * Sort theo số product DESC để brand phổ biến hiển trước.
   */
  async findActiveByCategoryIds(categoryIds: string[], limit = 12) {
    if (!categoryIds || categoryIds.length === 0) return [];
    // Group products by brandId, count
    const products = await this.prisma.product.findMany({
      where: { categoryId: { in: categoryIds }, status: 'ACTIVE', brandId: { not: null } },
      select: { brandId: true },
    });
    const counts = new Map<number, number>();
    for (const p of products) {
      if (p.brandId == null) continue;
      counts.set(p.brandId, (counts.get(p.brandId) || 0) + 1);
    }
    if (counts.size === 0) return [];
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, limit);
    const brandIds = sorted.map(([id]) => id);
    const brands = await this.prisma.brand.findMany({
      where: { id: { in: brandIds }, status: 'active' },
      select: { id: true, name: true, slug: true, logoUrl: true },
    });
    // Reorder theo sort order count
    const map = new Map(brands.map(b => [b.id, b]));
    return sorted.map(([id, count]) => {
      const brand = map.get(id);
      return brand ? { ...brand, productCount: count } : null;
    }).filter(Boolean);
  }

  // --- CRUD Operations ---
  async create(dto: CreateBrandDto) {
    const exists = await this.prisma.brand.findUnique({
      where: { slug: dto.slug },
    });
    if (exists) {
      throw new ConflictException('Brand slug already exists');
    }

    return this.prisma.brand.create({
      data: {
        ...dto,
        status: dto.status || 'active',
      },
    });
  }

  async update(id: number, dto: UpdateBrandDto) {
    // Check existence
    await this.findById(id);

    if (dto.slug) {
        const exists = await this.prisma.brand.findUnique({ where: { slug: dto.slug } });
        if (exists && exists.id !== id) throw new ConflictException('Slug taken');
    }

    return this.prisma.brand.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: number) {
    const brand = await this.findById(id);
    
    // Check dependencies
    const productCount = await this.prisma.product.count({
        where: { brandId: id }
    });
    
    if (productCount > 0) {
        throw new ConflictException(`Cannot delete brand. It has ${productCount} products.`);
    }

    return this.prisma.brand.delete({ where: { id } });
  }

  async toggleStatus(id: number) {
      const brand = await this.findById(id);
      const newStatus = brand.status === 'active' ? 'inactive' : 'active';
      return this.prisma.brand.update({
          where: { id },
          data: { status: newStatus }
      });
  }

  async findById(id: number) {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }
}