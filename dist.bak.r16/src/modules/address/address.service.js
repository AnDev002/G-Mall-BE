"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddressService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const ghn_service_1 = require("../ghn/ghn.service");
let AddressService = class AddressService {
    prisma;
    ghnService;
    constructor(prisma, ghnService) {
        this.prisma = prisma;
        this.ghnService = ghnService;
    }
    async buildFullAddress(dto) {
        try {
            const provinces = await this.ghnService.getProvinces();
            const provinceName = provinces.find((p) => p.ProvinceID === dto.provinceId)?.ProvinceName || '';
            const districts = await this.ghnService.getDistricts(dto.provinceId);
            const districtName = districts.find((d) => d.DistrictID === dto.districtId)?.DistrictName || '';
            const wards = await this.ghnService.getWards(dto.districtId);
            const wardName = wards.find((w) => w.WardCode === dto.wardCode)?.WardName || '';
            const parts = [
                dto.specificAddress,
                wardName,
                districtName,
                provinceName
            ].filter(Boolean);
            return parts.join(', ');
        }
        catch (error) {
            return `${dto.specificAddress}, Phường ${dto.wardCode}, Quận ${dto.districtId}, Tỉnh ${dto.provinceId}`;
        }
    }
    async create(userId, dto) {
        const fullAddress = await this.buildFullAddress(dto);
        return this.prisma.$transaction(async (tx) => {
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
    async findAll(userId) {
        return this.prisma.address.findMany({
            where: { userId },
            orderBy: { isDefault: 'desc' },
        });
    }
    async update(userId, id, dto) {
        const fullAddress = await this.buildFullAddress(dto);
        return this.prisma.$transaction(async (tx) => {
            if (dto.isDefault) {
                await tx.address.updateMany({
                    where: { userId, isDefault: true, id: { not: id } },
                    data: { isDefault: false },
                });
            }
            const data = { ...dto, fullAddress };
            if (dto.isDefault === false) {
                const otherDefaults = await tx.address.count({
                    where: { userId, isDefault: true, id: { not: id } },
                });
                if (otherDefaults === 0) {
                    delete data.isDefault;
                }
            }
            return tx.address.update({
                where: { id, userId },
                data,
            });
        });
    }
    async remove(userId, id) {
        return this.prisma.$transaction(async (tx) => {
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
    async setDefault(userId, id) {
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
};
exports.AddressService = AddressService;
exports.AddressService = AddressService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ghn_service_1.GhnService])
], AddressService);
//# sourceMappingURL=address.service.js.map