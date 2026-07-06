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
exports.ChatService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const encryption_util_1 = require("../../common/utils/encryption.util");
const ai_service_1 = require("./ai.service");
const create_message_dto_1 = require("./dto/create-message.dto");
const redis_service_1 = require("../../database/redis/redis.service");
let ChatService = class ChatService {
    prisma;
    aiService;
    redis;
    constructor(prisma, aiService, redis) {
        this.prisma = prisma;
        this.aiService = aiService;
        this.redis = redis;
    }
    async onModuleInit() {
        try {
            await this.prisma.user.upsert({
                where: { id: 'AI_ASSISTANT' },
                update: {},
                create: { id: 'AI_ASSISTANT', name: 'Trợ lý GMall', email: 'ai-assistant@gmall.internal', isVerified: true },
            });
        }
        catch (e) {
            console.warn('[ChatService] seed AI_ASSISTANT skipped:', e?.message);
        }
    }
    async validateSocketUser(userId, tokenVersion) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, isBanned: true, tokenVersion: true },
        });
        if (!user)
            return null;
        if (user.isBanned)
            return null;
        if (typeof tokenVersion === 'number' && tokenVersion !== user.tokenVersion) {
            return null;
        }
        return user;
    }
    async getAiHistory(userId, limit = 6) {
        const conversation = await this.prisma.conversation.findFirst({
            where: {
                AND: [
                    { participants: { some: { id: userId } } },
                    { participants: { some: { id: 'AI_ASSISTANT' } } },
                ],
            },
            select: { id: true }
        });
        if (!conversation)
            return [];
        const messages = await this.prisma.message.findMany({
            where: {
                conversationId: conversation.id
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                sender: { select: { id: true, role: true } }
            }
        });
        return messages.reverse().map(msg => {
            try {
                return {
                    ...msg,
                    content: encryption_util_1.EncryptionUtil.decrypt(msg.content)
                };
            }
            catch (e) {
                return msg;
            }
        });
    }
    async processUserMessage(userId, dto) {
        if (!userId) {
            if (dto.receiverId === 'AI_ASSISTANT') {
                const guestHistory = dto.history || [];
                const aiResponse = await this.aiService.getAiResponse('guest', dto.content, guestHistory);
                return {
                    userMessage: {
                        id: Date.now().toString(),
                        content: dto.content,
                        senderId: 'ME',
                        createdAt: new Date().toISOString()
                    },
                    aiMessage: {
                        id: (Date.now() + 1).toString(),
                        senderId: 'AI_ASSISTANT',
                        content: aiResponse.text,
                        options: aiResponse.options,
                        searchSuggestions: aiResponse.searchSuggestions,
                        type: aiResponse.products?.length ? 'PRODUCT' : create_message_dto_1.MessageType.TEXT,
                        payload: aiResponse.products,
                        createdAt: new Date().toISOString()
                    }
                };
            }
            throw new common_1.BadRequestException("Cần đăng nhập để nhắn tin cho người dùng này.");
        }
        if (userId === dto.receiverId) {
            throw new common_1.BadRequestException('Không thể nhắn tin cho chính mình');
        }
        const savedUserMsg = await this.sendMessageToDb(userId, dto);
        if (dto.receiverId === 'AI_ASSISTANT') {
            const history = await this.getAiHistory(userId, 6);
            const aiResult = await this.aiService.getAiResponse(userId || 'guest', dto.content, history);
            let msgType = create_message_dto_1.MessageType.TEXT;
            let msgContent = aiResult.text;
            if (aiResult.products && aiResult.products.length > 0) {
                msgType = 'PRODUCT';
                msgContent = JSON.stringify(aiResult.products[0]);
            }
            let savedAiMsg;
            if (userId) {
                savedAiMsg = await this.sendMessageToDb('AI_ASSISTANT', {
                    receiverId: userId,
                    content: msgContent,
                    type: msgType,
                });
            }
            else {
                savedAiMsg = {
                    id: Date.now().toString(),
                    senderId: 'AI_ASSISTANT',
                    content: msgContent,
                    type: msgType,
                    createdAt: new Date().toISOString()
                };
            }
            return {
                userMessage: savedUserMsg,
                aiMessage: {
                    ...savedAiMsg,
                    options: aiResult.options,
                    searchSuggestions: aiResult.searchSuggestions
                }
            };
        }
        return { userMessage: savedUserMsg, aiMessage: null };
    }
    async sendMessageToDb(senderId, dto) {
        const lockKey = 'chat:conv-lock:' + [senderId, dto.receiverId].sort().join(':');
        let acquired = false;
        try {
            try {
                for (let i = 0; i < 5; i++) {
                    acquired = await this.redis.setNX(lockKey, '1', 10);
                    if (acquired)
                        break;
                    await new Promise((r) => setTimeout(r, 100));
                }
            }
            catch {
                acquired = false;
            }
            const message = await this.prisma.$transaction(async (tx) => {
                let conversationId = '';
                const existingConv = await tx.conversation.findFirst({
                    where: { AND: [{ participants: { some: { id: senderId } } }, { participants: { some: { id: dto.receiverId } } }] }
                });
                if (existingConv) {
                    conversationId = existingConv.id;
                    await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });
                }
                else {
                    const newConv = await tx.conversation.create({ data: {} });
                    await tx.conversation.update({
                        where: { id: newConv.id },
                        data: { participants: { connect: { id: senderId } } },
                    });
                    await tx.conversation.update({
                        where: { id: newConv.id },
                        data: { participants: { connect: { id: dto.receiverId } } },
                    });
                    conversationId = newConv.id;
                }
                return tx.message.create({
                    data: {
                        senderId, conversationId,
                        content: encryption_util_1.EncryptionUtil.encrypt(dto.content),
                        type: dto.type || create_message_dto_1.MessageType.TEXT
                    },
                    include: { sender: { select: { id: true, name: true, role: true } } }
                });
            });
            return { ...message, content: encryption_util_1.EncryptionUtil.decrypt(message.content) };
        }
        finally {
            if (acquired) {
                try {
                    await this.redis.del(lockKey);
                }
                catch { }
            }
        }
    }
    async sendMessage(senderId, dto) {
        if (senderId === dto.receiverId) {
            throw new common_1.BadRequestException('Không thể nhắn tin cho chính mình');
        }
        return this.prisma.$transaction(async (tx) => {
            let conversationId = '';
            const existingConv = await tx.conversation.findFirst({
                where: {
                    AND: [
                        { participants: { some: { id: senderId } } },
                        { participants: { some: { id: dto.receiverId } } },
                    ],
                },
            });
            if (existingConv) {
                conversationId = existingConv.id;
                await tx.conversation.update({
                    where: { id: conversationId },
                    data: { lastMessageAt: new Date() },
                });
            }
            else {
                const newConv = await tx.conversation.create({ data: {} });
                await tx.conversation.update({
                    where: { id: newConv.id },
                    data: { participants: { connect: { id: senderId } } },
                });
                await tx.conversation.update({
                    where: { id: newConv.id },
                    data: { participants: { connect: { id: dto.receiverId } } },
                });
                conversationId = newConv.id;
            }
            const message = await tx.message.create({
                data: {
                    senderId,
                    conversationId,
                    content: encryption_util_1.EncryptionUtil.encrypt(dto.content),
                    type: dto.type,
                },
                include: {
                    sender: { select: { id: true, name: true, role: true } },
                },
            });
            return {
                ...message,
                content: encryption_util_1.EncryptionUtil.decrypt(message.content),
                senderId: message.senderId,
            };
        });
    }
    async searchUsers(query, currentUserId) {
        const trimmed = (query || '').trim();
        if (trimmed.length < 2)
            return [];
        const isFullEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
        const orConditions = [{ name: { contains: trimmed } }];
        if (isFullEmail) {
            orConditions.push({ email: trimmed });
        }
        return this.prisma.user.findMany({
            where: {
                AND: [
                    { id: { not: currentUserId } },
                    { OR: orConditions },
                ],
            },
            select: { id: true, name: true, avatar: true, role: true },
            take: 5,
        });
    }
    async findChatPartnerByRole(role) {
        const user = await this.prisma.user.findFirst({
            where: { role },
            orderBy: { createdAt: 'asc' },
            select: { id: true, name: true, role: true, avatar: true },
        });
        if (!user) {
            return null;
        }
        return user;
    }
    async getUserConversations(userId) {
        const conversations = await this.prisma.conversation.findMany({
            where: {
                participants: { some: { id: userId } },
            },
            orderBy: { lastMessageAt: 'desc' },
            include: {
                participants: {
                    select: { id: true, name: true, role: true, avatar: true },
                },
                messages: {
                    take: 1,
                    orderBy: { createdAt: 'desc' },
                },
            },
        });
        return conversations.map((conv) => {
            const partner = conv.participants.find((p) => p.id !== userId);
            const lastMsg = conv.messages[0];
            let lastMessagePlain = '';
            if (lastMsg?.content) {
                try {
                    lastMessagePlain = encryption_util_1.EncryptionUtil.decrypt(lastMsg.content);
                }
                catch {
                    lastMessagePlain = lastMsg.content;
                }
            }
            return {
                id: conv.id,
                partner,
                lastMessage: lastMessagePlain,
                lastMessageAt: conv.lastMessageAt,
                unreadCount: lastMsg && lastMsg.senderId !== userId && !lastMsg.isRead ? 1 : 0,
                isRead: lastMsg?.senderId === userId ? true : lastMsg?.isRead,
            };
        });
    }
    async getMessages(conversationId, userId, limit = 20, cursor) {
        const conv = await this.prisma.conversation.findFirst({
            where: { id: conversationId, participants: { some: { id: userId } } },
            select: { id: true },
        });
        if (!conv)
            throw new common_1.ForbiddenException('Bạn không có quyền xem hội thoại này');
        const messages = await this.prisma.message.findMany({
            where: { conversationId },
            take: limit,
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            orderBy: { createdAt: 'desc' },
            include: {
                sender: { select: { id: true, name: true } },
            },
        });
        return messages.map((msg) => {
            try {
                return {
                    ...msg,
                    content: encryption_util_1.EncryptionUtil.decrypt(msg.content),
                };
            }
            catch (error) {
                return msg;
            }
        });
    }
    async markAsRead(conversationId, userId) {
        const conv = await this.prisma.conversation.findFirst({
            where: { id: conversationId, participants: { some: { id: userId } } },
            select: { id: true },
        });
        if (!conv)
            throw new common_1.ForbiddenException('Bạn không có quyền với hội thoại này');
        await this.prisma.message.updateMany({
            where: {
                conversationId,
                senderId: { not: userId },
                isRead: false,
            },
            data: { isRead: true },
        });
        return { success: true };
    }
    async findOrCreateConversation(userId, partnerId) {
        if (userId === partnerId) {
            throw new common_1.BadRequestException('Không thể nhắn tin cho chính mình');
        }
        let conversation = await this.prisma.conversation.findFirst({
            where: {
                AND: [
                    { participants: { some: { id: userId } } },
                    { participants: { some: { id: partnerId } } },
                ],
            },
            include: {
                participants: { select: { id: true, name: true, role: true } },
                messages: { take: 1, orderBy: { createdAt: 'desc' } },
            },
        });
        if (!conversation) {
            const newConv = await this.prisma.conversation.create({ data: {} });
            await this.prisma.conversation.update({
                where: { id: newConv.id },
                data: { participants: { connect: { id: userId } } },
            });
            conversation = await this.prisma.conversation.update({
                where: { id: newConv.id },
                data: { participants: { connect: { id: partnerId } } },
                include: {
                    participants: { select: { id: true, name: true, role: true } },
                    messages: { take: 1, orderBy: { createdAt: 'desc' } },
                },
            });
        }
        const partner = conversation.participants.find((p) => p.id !== userId);
        const lastMsg = conversation.messages[0];
        return {
            id: conversation.id,
            partner,
            lastMessage: lastMsg?.content || '',
            lastMessageAt: conversation.lastMessageAt,
            unreadCount: lastMsg && lastMsg.senderId !== userId && !lastMsg.isRead ? 1 : 0,
        };
    }
};
exports.ChatService = ChatService;
exports.ChatService = ChatService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ai_service_1.AiService,
        redis_service_1.RedisService])
], ChatService);
//# sourceMappingURL=chat.service.js.map