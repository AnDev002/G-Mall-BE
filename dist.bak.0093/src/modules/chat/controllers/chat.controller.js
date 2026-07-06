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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatController = void 0;
const common_1 = require("@nestjs/common");
const chat_service_1 = require("../chat.service");
const jwt_guard_1 = require("../../auth/guards/jwt.guard");
const chat_dto_1 = require("../dto/chat.dto");
const create_message_dto_1 = require("../dto/create-message.dto");
const public_decorator_1 = require("../../../common/decorators/public.decorator");
const rate_limit_guard_1 = require("../../../common/guards/rate-limit.guard");
let ChatController = class ChatController {
    chatService;
    constructor(chatService) {
        this.chatService = chatService;
    }
    async sendMessage(req, dto) {
        const userId = req.user?.userId || null;
        return this.chatService.processUserMessage(userId, dto);
    }
    getConversations(req) {
        return this.chatService.getUserConversations(req.user.userId);
    }
    getMessages(req, conversationId, limit, cursor) {
        return this.chatService.getMessages(conversationId, req.user.userId, Number(limit) || 20, cursor);
    }
    markAsRead(req, conversationId) {
        return this.chatService.markAsRead(conversationId, req.user.userId);
    }
    async openChat(req, dto) {
        console.log('Open Chat Request:', dto);
        return this.chatService.findOrCreateConversation(req.user.userId, dto.receiverId);
    }
    async searchUsers(q, req) {
        const userId = req.user.userId;
        if (!q)
            return [];
        return this.chatService.searchUsers(q, userId);
    }
    async findPartner(role) {
        const safeRole = role === 'ADMIN' || role === 'SELLER' ? role : 'ADMIN';
        return this.chatService.findChatPartnerByRole(safeRole);
    }
};
exports.ChatController = ChatController;
__decorate([
    (0, common_1.Post)('send'),
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(rate_limit_guard_1.RateLimitGuard),
    (0, rate_limit_guard_1.RateLimit)({ points: 20, windowSeconds: 60, keyBy: 'ip+path' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_message_dto_1.CreateMessageDto]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Get)('conversations'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChatController.prototype, "getConversations", null);
__decorate([
    (0, common_1.Get)('messages/:conversationId'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('conversationId')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('cursor')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Number, String]),
    __metadata("design:returntype", void 0)
], ChatController.prototype, "getMessages", null);
__decorate([
    (0, common_1.Patch)('read/:conversationId'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('conversationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ChatController.prototype, "markAsRead", null);
__decorate([
    (0, common_1.Post)('open-chat'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, chat_dto_1.OpenChatDto]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "openChat", null);
__decorate([
    (0, common_1.Get)('users/search'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "searchUsers", null);
__decorate([
    (0, common_1.Get)('find-partner'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Query)('role')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "findPartner", null);
exports.ChatController = ChatController = __decorate([
    (0, common_1.Controller)('chat'),
    __metadata("design:paramtypes", [chat_service_1.ChatService])
], ChatController);
//# sourceMappingURL=chat.controller.js.map