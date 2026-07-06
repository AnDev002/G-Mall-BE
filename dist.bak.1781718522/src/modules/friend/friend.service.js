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
exports.FriendService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const chat_gateway_1 = require("../chat/chat.gateway");
const client_1 = require("@prisma/client");
const mailer_1 = require("@nestjs-modules/mailer");
let FriendService = class FriendService {
    prisma;
    chatGateway;
    mailerService;
    constructor(prisma, chatGateway, mailerService) {
        this.prisma = prisma;
        this.chatGateway = chatGateway;
        this.mailerService = mailerService;
    }
    async sendFriendRequest(userId, receiverId) {
        if (userId === receiverId)
            throw new common_1.BadRequestException("Không thể kết bạn với chính mình");
        const existing = await this.prisma.friendship.findFirst({
            where: {
                OR: [
                    { senderId: userId, receiverId: receiverId },
                    { senderId: receiverId, receiverId: userId },
                ]
            }
        });
        if (existing) {
            if (existing.status === client_1.FriendshipStatus.ACCEPTED)
                throw new common_1.BadRequestException("Hai bạn đã là bạn bè");
            if (existing.status === client_1.FriendshipStatus.PENDING)
                throw new common_1.BadRequestException("Đã có lời mời kết bạn đang chờ");
        }
        const friendship = await this.prisma.friendship.create({
            data: {
                senderId: userId,
                receiverId: receiverId,
                status: client_1.FriendshipStatus.PENDING
            },
            include: { sender: { select: { id: true, name: true, avatar: true } } }
        });
        this.chatGateway.server.to(`user_${receiverId}`).emit('new_friend_request', friendship);
        return { message: "Đã gửi lời mời kết bạn", data: friendship };
    }
    async inviteByEmail(senderId, email, message) {
        const normalizedEmail = email.toLowerCase().trim();
        const sender = await this.prisma.user.findUnique({
            where: { id: senderId },
            select: { id: true, name: true, email: true, avatar: true },
        });
        if (!sender)
            throw new common_1.BadRequestException('Người gửi không tồn tại');
        if (sender.email === normalizedEmail)
            throw new common_1.BadRequestException('Bạn không thể mời chính mình');
        const existingUser = await this.prisma.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (existingUser) {
            const existingFriendship = await this.prisma.friendship.findFirst({
                where: {
                    OR: [
                        { senderId: senderId, receiverId: existingUser.id },
                        { senderId: existingUser.id, receiverId: senderId },
                    ],
                },
            });
            if (existingFriendship) {
                if (existingFriendship.status === 'ACCEPTED') {
                    throw new common_1.BadRequestException('Hai bạn đã là bạn bè từ trước.');
                }
                throw new common_1.BadRequestException('Đã gửi lời mời kết bạn rồi.');
            }
            await this.prisma.friendship.create({
                data: {
                    senderId: senderId,
                    receiverId: existingUser.id,
                    status: 'PENDING',
                },
            });
            return {
                success: true,
                type: 'internal',
                message: 'Người dùng này đang dùng GMall. Đã gửi lời mời kết bạn!',
            };
        }
        const registerLink = `https://gmall.com.vn/register?ref=${sender.id}`;
        try {
            await this.mailerService.sendMail({
                to: normalizedEmail,
                subject: `${sender.name ?? 'Một người bạn'} mời bạn tham gia GMall!`,
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #2563eb; padding: 20px; text-align: center;">
              <h2 style="color: #ffffff; margin: 0;">Lời mời tham gia GMall</h2>
            </div>
            
            <div style="padding: 24px; background-color: #ffffff;">
              <p style="font-size: 16px; color: #333;">Xin chào,</p>
              
              <p style="font-size: 16px; color: #333; line-height: 1.5;">
                Bạn của bạn là <strong>${sender.name ?? 'Người dùng GMall'}</strong> đang sử dụng GMall và muốn mời bạn cùng tham gia.
              </p>

              <div style="background-color: #f3f4f6; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #555; font-style: italic;">"${message}"</p>
              </div>

              <div style="text-align: center; margin-top: 30px; margin-bottom: 30px;">
                <a href="${registerLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">
                  Đăng ký ngay & Kết bạn
                </a>
              </div>
              
              <p style="font-size: 14px; color: #666;">
                Hoặc truy cập link sau: <br>
                <a href="${registerLink}" style="color: #2563eb;">${registerLink}</a>
              </p>
            </div>

            <div style="background-color: #f9fafb; padding: 15px; text-align: center; font-size: 12px; color: #9ca3af;">
              © 2026 GMall Vietnam. All rights reserved.
            </div>
          </div>
        `,
            });
            return {
                success: true,
                type: 'email',
                message: `Đã gửi email mời thành công tới ${normalizedEmail}`,
            };
        }
        catch (error) {
            console.log('>>> [WARNING] Lỗi gửi mail:', error.message);
            throw new common_1.BadRequestException('Không thể gửi mail lúc này, vui lòng thử lại sau.');
        }
    }
    async handleFriendRequest(userId, requestId, action) {
        const friendship = await this.prisma.friendship.findUnique({
            where: { id: requestId }
        });
        if (!friendship)
            throw new common_1.NotFoundException("Lời mời không tồn tại");
        if (friendship.receiverId !== userId)
            throw new common_1.BadRequestException("Bạn không có quyền xử lý lời mời này");
        if (friendship.status !== client_1.FriendshipStatus.PENDING)
            throw new common_1.BadRequestException("Lời mời này đã được xử lý trước đó");
        if (action === 'REJECT') {
            await this.prisma.friendship.delete({ where: { id: requestId } });
            return { message: "Đã từ chối lời mời" };
        }
        const updated = await this.prisma.friendship.update({
            where: { id: requestId },
            data: { status: client_1.FriendshipStatus.ACCEPTED },
            include: { receiver: { select: { id: true, name: true, avatar: true } } }
        });
        this.chatGateway.server.to(`user_${friendship.senderId}`).emit('friend_request_accepted', updated);
        return { message: "Đã trở thành bạn bè", data: updated };
    }
    async getFriendList(userId) {
        const friends = await this.prisma.friendship.findMany({
            where: {
                status: client_1.FriendshipStatus.ACCEPTED,
                OR: [{ senderId: userId }, { receiverId: userId }]
            },
            include: {
                sender: { select: { id: true, name: true, avatar: true, email: true } },
                receiver: { select: { id: true, name: true, avatar: true, email: true } }
            }
        });
        return friends.map(f => {
            const isSender = f.senderId === userId;
            const friendInfo = isSender ? f.receiver : f.sender;
            return {
                friendshipId: f.id,
                ...friendInfo,
                joinedAt: f.createdAt
            };
        });
    }
    async getPendingRequests(userId) {
        console.log(">>> [DEBUG] Finding pending requests for Receiver ID:", userId);
        const requests = await this.prisma.friendship.findMany({
            where: {
                receiverId: userId,
                status: client_1.FriendshipStatus.PENDING
            },
            include: {
                sender: { select: { id: true, name: true, avatar: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        console.log(">>> [DEBUG] Found:", requests.length, "requests");
        return requests;
    }
    async unfriend(userId, friendId) {
        const friendship = await this.prisma.friendship.findFirst({
            where: {
                status: client_1.FriendshipStatus.ACCEPTED,
                OR: [
                    { senderId: userId, receiverId: friendId },
                    { senderId: friendId, receiverId: userId }
                ]
            }
        });
        if (!friendship)
            throw new common_1.NotFoundException("Các bạn chưa kết bạn");
        await this.prisma.friendship.delete({ where: { id: friendship.id } });
        return { success: true, message: "Đã hủy kết bạn" };
    }
    async searchUsers(userId, keyword) {
        if (!keyword || keyword.trim() === '')
            return [];
        const users = await this.prisma.user.findMany({
            where: {
                AND: [
                    { id: { not: userId } },
                    { role: { in: ['BUYER', 'SELLER'] } },
                    {
                        OR: [
                            { name: { contains: keyword } },
                            { email: { contains: keyword } }
                        ]
                    }
                ]
            },
            select: { id: true, name: true, avatar: true, email: true, role: true },
            take: 20
        });
        const results = await Promise.all(users.map(async (u) => {
            const friendship = await this.prisma.friendship.findFirst({
                where: {
                    OR: [
                        { senderId: userId, receiverId: u.id },
                        { senderId: u.id, receiverId: userId }
                    ]
                }
            });
            let status = 'NONE';
            if (friendship) {
                if (friendship.status === client_1.FriendshipStatus.ACCEPTED) {
                    status = 'FRIEND';
                }
                else if (friendship.status === client_1.FriendshipStatus.PENDING) {
                    status = friendship.senderId === userId ? 'PENDING_SENT' : 'PENDING_RECEIVED';
                }
            }
            return { ...u, status };
        }));
        return results;
    }
};
exports.FriendService = FriendService;
exports.FriendService = FriendService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        chat_gateway_1.ChatGateway,
        mailer_1.MailerService])
], FriendService);
//# sourceMappingURL=friend.service.js.map