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
var ChatGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const gift_consultant_service_1 = require("./gift-consultant.service");
const chat_service_1 = require("./chat.service");
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
function parseCookie(str) {
    return str
        .split(';')
        .map(v => v.split('='))
        .reduce((acc, v) => {
        acc[decodeURIComponent(v[0].trim())] = decodeURIComponent(v[1].trim());
        return acc;
    }, {});
}
let ChatGateway = ChatGateway_1 = class ChatGateway {
    giftService;
    chatService;
    jwtService;
    server;
    logger = new common_1.Logger(ChatGateway_1.name);
    constructor(giftService, chatService, jwtService) {
        this.giftService = giftService;
        this.chatService = chatService;
        this.jwtService = jwtService;
    }
    async handleConnection(client) {
        try {
            console.log(`\n--- [DEBUG] New Connection Attempt: ${client.id} ---`);
            let token = client.handshake.auth.token;
            const cookieString = client.handshake.headers.cookie;
            console.log('1. Cookie String:', cookieString);
            if (!token && cookieString) {
                const cookies = parseCookie(cookieString);
                console.log('2. Parsed Cookies Keys:', Object.keys(cookies));
                token = cookies['Authentication'] || cookies['accessToken'] || cookies['access_token'];
            }
            if (!token) {
                console.log('❌ No Token found -> Guest Mode');
                return;
            }
            const payload = this.jwtService.verify(token, { secret: process.env.JWT_SECRET });
            console.log('3. Decoded Payload:', payload);
            const userId = payload.userId || payload.sub || payload.id;
            if (!userId) {
                console.log('❌ Token valid but UserID is missing in payload');
                client.disconnect();
                return;
            }
            const validUser = await this.chatService.validateSocketUser(userId, payload.tokenVersion);
            if (!validUser) {
                console.log('❌ User not found / banned / token revoked');
                client.disconnect();
                return;
            }
            client.join(`user_${userId}`);
            client.data.userId = userId;
            console.log(`✅ SUCCESS: User ${userId} joined room "user_${userId}"`);
            console.log('   Current Rooms:', client.rooms);
        }
        catch (e) {
            console.error('❌ Connection Error:', e.message);
            client.disconnect();
        }
    }
    async handleMessage(data, client) {
        const senderId = client.data.userId;
        console.log(`\n--- [DEBUG] Handle Message from ${senderId} ---`);
        console.log('Payload:', data);
        if (!senderId) {
            console.log('❌ Sender not identified (Not logged in)');
            client.emit('error', { message: 'Unauthorized' });
            return;
        }
        const MAX_CONTENT_LENGTH = 5000;
        const content = data?.content;
        const receiverId = data?.receiverId;
        if (typeof content !== 'string' || content.trim().length === 0) {
            client.emit('message_error', {
                clientTempId: data?.clientTempId,
                message: 'Nội dung tin nhắn không hợp lệ.',
            });
            return;
        }
        if (content.length > MAX_CONTENT_LENGTH) {
            client.emit('message_error', {
                clientTempId: data?.clientTempId,
                message: `Tin nhắn quá dài (tối đa ${MAX_CONTENT_LENGTH} ký tự).`,
            });
            return;
        }
        if (typeof receiverId !== 'string' || receiverId.trim().length === 0) {
            client.emit('message_error', {
                clientTempId: data?.clientTempId,
                message: 'Người nhận không hợp lệ.',
            });
            return;
        }
        const clientTempId = data.clientTempId;
        try {
            const savedMessage = await this.chatService.sendMessage(senderId, {
                content: content.trim(),
                receiverId,
                type: data.type || 'TEXT'
            });
            const payload = {
                id: savedMessage.id,
                conversationId: savedMessage.conversationId,
                senderId: senderId,
                content: savedMessage.content,
                type: savedMessage.type,
                timestamp: savedMessage.createdAt,
                sender: savedMessage.sender,
                clientTempId,
            };
            this.server.to(`user_${data.receiverId}`).emit('receive_message', payload);
            client.emit('receive_message', payload);
        }
        catch (e) {
            console.error('❌ Error processing message:', e);
            client.emit('message_error', {
                clientTempId,
                message: 'Không gửi được tin nhắn. Vui lòng thử lại.',
                reason: e?.message,
            });
        }
    }
    handleDisconnect(client) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }
};
exports.ChatGateway = ChatGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], ChatGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('send_message'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleMessage", null);
exports.ChatGateway = ChatGateway = ChatGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: true,
            credentials: true
        }
    }),
    __metadata("design:paramtypes", [gift_consultant_service_1.GiftConsultantService,
        chat_service_1.ChatService,
        jwt_1.JwtService])
], ChatGateway);
//# sourceMappingURL=chat.gateway.js.map