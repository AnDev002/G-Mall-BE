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
exports.NewsletterService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
let NewsletterService = class NewsletterService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async subscribe(email, sourceTag = 'footer') {
        const normalized = email.trim().toLowerCase();
        const existing = await this.prisma.newsletterSubscriber.findUnique({
            where: { email: normalized },
        });
        if (existing) {
            if (existing.isActive) {
                return { ok: true, alreadySubscribed: true };
            }
            await this.prisma.newsletterSubscriber.update({
                where: { email: normalized },
                data: {
                    isActive: true,
                    unsubscribedAt: null,
                    sourceTag: sourceTag || existing.sourceTag,
                },
            });
            return { ok: true, reactivated: true };
        }
        await this.prisma.newsletterSubscriber.create({
            data: { email: normalized, sourceTag },
        });
        return { ok: true };
    }
    async unsubscribe(email) {
        const normalized = email.trim().toLowerCase();
        const sub = await this.prisma.newsletterSubscriber.findUnique({
            where: { email: normalized },
        });
        if (!sub)
            throw new common_1.BadRequestException('Email không tồn tại trong danh sách');
        if (!sub.isActive)
            return { ok: true };
        await this.prisma.newsletterSubscriber.update({
            where: { email: normalized },
            data: { isActive: false, unsubscribedAt: new Date() },
        });
        return { ok: true };
    }
};
exports.NewsletterService = NewsletterService;
exports.NewsletterService = NewsletterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], NewsletterService);
//# sourceMappingURL=newsletter.service.js.map