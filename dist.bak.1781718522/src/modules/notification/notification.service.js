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
exports.NotificationService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const pagination_util_1 = require("../../common/utils/pagination.util");
let NotificationService = class NotificationService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(data, tx) {
        const client = tx || this.prisma;
        return client.notification.create({
            data: {
                userId: data.userId,
                type: data.type || 'SYSTEM',
                title: data.title,
                content: data.content,
                link: data.link,
                image: data.image,
            },
        });
    }
    async listMine(userId, page = 1, pageSize = 20) {
        const _pg = (0, pagination_util_1.getPagination)(page, pageSize, { defaultLimit: 20 });
        page = _pg.page;
        pageSize = _pg.limit;
        const skip = _pg.skip;
        const [items, total, unread] = await Promise.all([
            this.prisma.notification.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: pageSize,
            }),
            this.prisma.notification.count({ where: { userId } }),
            this.prisma.notification.count({ where: { userId, isRead: false } }),
        ]);
        return { items, meta: { page, pageSize, total, unread } };
    }
    async unreadCount(userId) {
        const count = await this.prisma.notification.count({
            where: { userId, isRead: false },
        });
        return { count };
    }
    async markRead(userId, id) {
        const notif = await this.prisma.notification.findFirst({ where: { id, userId } });
        if (!notif)
            throw new common_1.NotFoundException('Thông báo không tồn tại');
        if (notif.isRead)
            return notif;
        return this.prisma.notification.update({
            where: { id },
            data: { isRead: true, readAt: new Date() },
        });
    }
    async markAllRead(userId) {
        const result = await this.prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true, readAt: new Date() },
        });
        return { updated: result.count };
    }
};
exports.NotificationService = NotificationService;
exports.NotificationService = NotificationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], NotificationService);
//# sourceMappingURL=notification.service.js.map