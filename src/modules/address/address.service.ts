import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';
// [FIX] Sửa tên class import đúng là GhnService
import { GhnService } from '../ghn/ghn.service'; 

@Injectable()
export class AddressService {
  constructor(
    private prisma: PrismaService,
    private ghnService: GhnService // [FIX] Inject đúng class GhnService
  ) {}

  // Helper: Tạo địa chỉ đầy đủ string bằng cách gọi GHN lấy tên Tỉnh/Huyện/Xã
  private async buildFullAddress(dto: CreateAddressDto): Promise<string> {
    try {
      // 1. Lấy tên Tỉnh
      const provinces = await this.ghnService.getProvinces();
      const provinceName = provinces.find((p: any) => p.ProvinceID === dto.provinceId)?.ProvinceName || '';

      // 2. Lấy tên Quận/Huyện
      const districts = await this.ghnService.getDistricts(dto.provinceId);
      const districtName = districts.find((d: any) => d.DistrictID === dto.districtId)?.DistrictName || '';

      // 3. Lấy tên Phường/Xã
      const wards = await this.ghnService.getWards(dto.districtId);
      const wardName = wards.find((w: any) => w.WardCode === dto.wardCode)?.WardName || '';

      // 4. Ghép chuỗi
      const parts = [
        dto.specificAddress,
        wardName,
        districtName,
        provinceName
      ].filter(Boolean); // Lọc bỏ giá trị rỗng

      return parts.join(', ');
    } catch (error) {
      // Fallback nếu lỗi API GHN thì trả về chuỗi ID (hoặc chỉ specificAddress)
      return `${dto.specificAddress}, Phường ${dto.wardCode}, Quận ${dto.districtId}, Tỉnh ${dto.provinceId}`;
    }
  }

  async create(userId: string, dto: CreateAddressDto) {
    // Build full string hiển thị (gọi GHN API) — để ngoài transaction tránh giữ
    // kết nối DB trong lúc chờ network, gây timeout transaction.
    const fullAddress = await this.buildFullAddress(dto);

    // Bọc clear-defaults + count + create trong 1 interactive transaction để
    // giữ bất biến "chỉ 1 địa chỉ mặc định" khi có request đồng thời.
    return this.prisma.$transaction(async (tx) => {
      // [Wiki 0086 - Bug #21] Xác định trước isDefault rồi MỚI clear, đảm bảo
      // mọi nhánh tạo địa chỉ mặc định (kể cả địa chỉ đầu tiên khi count===0)
      // đều xoá default cũ trong CÙNG transaction. Tránh trường hợp 2 create
      // đồng thời cùng thắng -> 2 địa chỉ mặc định.
      const count = await tx.address.count({ where: { userId } });
      const isDefault = count === 0 ? true : dto.isDefault || false;

      if (isDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.address.create({
        data: {
          userId,
          ...dto,
          isDefault,
          fullAddress,
        },
      });
    });
  }

  async findAll(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: { isDefault: 'desc' },
    });
  }

  async update(userId: string, id: string, dto: UpdateAddressDto) {
    // Build full string hiển thị (gọi GHN API) — để ngoài transaction tránh
    // giữ kết nối DB trong lúc chờ network, gây timeout transaction.
    const fullAddress = await this.buildFullAddress(dto);

    // Bọc clear-others + update trong 1 interactive transaction để giữ bất biến
    // "chỉ 1 địa chỉ mặc định" khi có request đồng thời (mirror setDefault()).
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }

      // [Wiki 0086 - Bug #22] Không cho phép bỏ default của địa chỉ mặc định DUY
      // NHẤT (sẽ khiến user không còn địa chỉ mặc định nào). Nếu request hạ default
      // mà đây đang là default duy nhất thì bỏ qua field isDefault=false, giữ nguyên
      // là default. User muốn đổi default thì set default cho địa chỉ khác.
      const data: any = { ...dto, fullAddress };
      if (dto.isDefault === false) {
        const otherDefaults = await tx.address.count({
          where: { userId, isDefault: true, id: { not: id } },
        });
        if (otherDefaults === 0) {
          // Đây là default duy nhất -> không cho hạ, loại field isDefault khỏi update.
          delete data.isDefault;
        }
      }

      return tx.address.update({
        where: { id, userId },
        data,
      });
    });
  }

  async remove(userId: string, id: string) {
    // [Wiki 0086 - Bug #23] Bọc delete + re-elect trong 1 transaction. Nếu xoá đúng
    // địa chỉ đang là mặc định và user còn địa chỉ khác thì promote địa chỉ mới nhất
    // lên làm mặc định, tránh để user không còn địa chỉ mặc định nào.
    return this.prisma.$transaction(async (tx) => {
      // Lấy bản ghi (kèm kiểm tra ownership qua where id+userId) trước khi xoá để
      // biết nó có phải default hay không.
      const deleted = await tx.address.delete({
        where: { id, userId },
      });

      if (deleted.isDefault) {
        const next = await tx.address.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        });
        if (next) {
          await tx.address.update({
            where: { id: next.id },
            data: { isDefault: true },
          });
        }
      }

      return deleted;
    });
  }

  async setDefault(userId: string, id: string) {
    await this.prisma.$transaction([
      this.prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      }),
      this.prisma.address.update({
        where: { id, userId },
        data: { isDefault: true },
      }),
    ]);
    return true;
  }
}