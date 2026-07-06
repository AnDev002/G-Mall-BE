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
var ContentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
let ContentService = ContentService_1 = class ContentService {
    prisma;
    logger = new common_1.Logger(ContentService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getBanners(location) {
        return this.prisma.banner.findMany({
            where: {
                isActive: true,
                ...(location ? { location } : {})
            },
            orderBy: { order: 'asc' },
        });
    }
    async getConfig(key) {
        const config = await this.prisma.systemConfig.findUnique({ where: { key } });
        if (config?.value) {
            try {
                return typeof config.value === 'string' ? JSON.parse(config.value) : config.value;
            }
            catch (e) {
                return config.value;
            }
        }
        return null;
    }
    async getAllBannersAdmin() {
        return this.prisma.banner.findMany({
            orderBy: [{ location: 'asc' }, { order: 'asc' }],
        });
    }
    async createBanner(data) {
        if (data.order === undefined) {
            const lastItem = await this.prisma.banner.findFirst({
                where: { location: data.location },
                orderBy: { order: 'desc' }
            });
            data.order = lastItem ? lastItem.order + 1 : 0;
        }
        return this.prisma.banner.create({ data });
    }
    async updateBanner(id, data) {
        return this.prisma.banner.update({
            where: { id },
            data,
        });
    }
    async deleteBanner(id) {
        return this.prisma.banner.delete({ where: { id } });
    }
    async reorderBanners(payload) {
        const items = Array.isArray(payload) ? payload : payload.items;
        return this.prisma.$transaction(items.map((item) => this.prisma.banner.update({
            where: { id: item.id },
            data: { order: item.order },
        })));
    }
    async saveConfig(dto) {
        this.logger.log(`🔥 [SAVE CONFIG] Key: ${dto.key}`);
        let valueToSave = dto.value;
        if (typeof dto.value === 'object' && dto.value !== null) {
            valueToSave = JSON.stringify(dto.value);
        }
        this.logger.log(`   -> Saving Value Length: ${valueToSave?.length || 0}`);
        try {
            const result = await this.prisma.systemConfig.upsert({
                where: { key: dto.key },
                create: {
                    key: dto.key,
                    value: valueToSave,
                    description: `Config created/updated via Admin at ${new Date().toISOString()}`
                },
                update: {
                    value: valueToSave,
                }
            });
            this.logger.log(`✅ [SAVE SUCCESS] Config saved for ${dto.key}`);
            return result;
        }
        catch (error) {
            this.logger.error(`❌ [SAVE ERROR] Failed to save config ${dto.key}`, error);
            throw error;
        }
    }
};
exports.ContentService = ContentService;
exports.ContentService = ContentService = ContentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ContentService);
//# sourceMappingURL=content.service.js.map