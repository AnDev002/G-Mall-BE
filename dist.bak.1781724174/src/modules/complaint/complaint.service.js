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
exports.ComplaintService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const VALID_CATEGORIES = new Set(['shipping', 'product', 'finance', 'system', 'other']);
const VALID_STATUSES = new Set(['open', 'processing', 'resolved', 'rejected']);
let ComplaintService = class ComplaintService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(userId, dto) {
        if (!VALID_CATEGORIES.has(dto.category)) {
            throw new common_1.BadRequestException('Danh mục khiếu nại không hợp lệ');
        }
        if (!dto.title?.trim())
            throw new common_1.BadRequestException('Tiêu đề là bắt buộc');
        if (!dto.content?.trim())
            throw new common_1.BadRequestException('Nội dung là bắt buộc');
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
    async listMine(userId, params = {}) {
        const page = Math.max(Number(params.page) || 1, 1);
        const limit = Math.min(Math.max(Number(params.limit) || 10, 1), 50);
        const where = { userId };
        if (params.status && VALID_STATUSES.has(params.status))
            where.status = params.status;
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
    async findOneAsOwner(userId, id) {
        const c = await this.prisma.complaint.findFirst({ where: { id, userId } });
        if (!c)
            throw new common_1.NotFoundException('Không tìm thấy khiếu nại');
        return c;
    }
    async listAll(params = {}) {
        const page = Math.max(Number(params.page) || 1, 1);
        const limit = Math.min(Math.max(Number(params.limit) || 20, 1), 100);
        const where = {};
        if (params.status && VALID_STATUSES.has(params.status))
            where.status = params.status;
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
    async updateStatus(id, status, adminNote) {
        if (!VALID_STATUSES.has(status))
            throw new common_1.BadRequestException('Trạng thái không hợp lệ');
        return this.prisma.complaint.update({
            where: { id },
            data: {
                status,
                adminNote: adminNote?.trim() || null,
                resolvedAt: status === 'resolved' || status === 'rejected' ? new Date() : null,
            },
        });
    }
};
exports.ComplaintService = ComplaintService;
exports.ComplaintService = ComplaintService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ComplaintService);
//# sourceMappingURL=complaint.service.js.map