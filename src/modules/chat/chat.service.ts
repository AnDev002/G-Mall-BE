import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { EncryptionUtil } from 'src/common/utils/encryption.util';
import { CreateMessageDto } from './dto/create-message.dto';
import { AiService } from './ai.service';
import { MessageType } from './dto/create-message.dto';
@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService // Inject AI Service
  ) {}

  // --- SOCKET LOGIC ---

  // Dùng cho ChatGateway.handleConnection: áp dụng các check giống JwtStrategy
  // (user tồn tại, chưa bị ban, tokenVersion khớp) cho kết nối WebSocket vì
  // gateway không đi qua JwtAuthGuard. Trả về user hợp lệ hoặc null nếu invalid.
  async validateSocketUser(userId: string, tokenVersion?: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isBanned: true, tokenVersion: true },
    });

    if (!user) return null;
    if (user.isBanned) return null;
    if (typeof tokenVersion === 'number' && tokenVersion !== user.tokenVersion) {
      return null;
    }

    return user;
  }

  async getAiHistory(userId: string, limit: number = 6) {
    // 1. Tìm Conversation giữa User và AI
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { id: userId } } },
          { participants: { some: { id: 'AI_ASSISTANT' } } }, // Giả sử ID của AI trong DB là AI_ASSISTANT
        ],
      },
      select: { id: true }
    });

    if (!conversation) return [];

    // 2. Lấy tin nhắn dựa trên conversationId
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId: conversation.id
      },
      take: limit,
      orderBy: { createdAt: 'desc' }, // Lấy mới nhất
      include: {
        sender: { select: { id: true, role: true } } 
      }
    });

    // 3. Đảo ngược & Giải mã
    return messages.reverse().map(msg => {
        try {
            return { 
                ...msg, 
                content: EncryptionUtil.decrypt(msg.content) 
            };
        } catch (e) { return msg; }
    });
  }
  async processUserMessage(userId: string | null, dto: CreateMessageDto) {
    if (!userId) {
      if (dto.receiverId === 'AI_ASSISTANT') {
        // Wiki 0086: `history` giờ là field hợp lệ trên DTO (không còn bị whitelist cắt).
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
            // Sửa 'TEXT' thành MessageType.TEXT, 'PRODUCT' thành MessageType.PRODUCT (nếu bạn đã thêm vào Enum Prisma)
            // Nếu Prisma chưa có PRODUCT, bạn phải dùng string as any hoặc thêm vào schema.prisma
            type: aiResponse.products?.length ? 'PRODUCT' : MessageType.TEXT, 
            payload: aiResponse.products, 
            createdAt: new Date().toISOString() 
          }
        };
      }
      throw new Error("Guest login required");
    }

    // Wiki 0086: chặn tự nhắn cho chính mình. Trước đây receiverId === senderId
    // khiến find-or-create conversation match nhầm 1 hội thoại sẵn có của user với
    // người khác (vì điều kiện chỉ là "participants có cả 2 id", mà 2 id trùng nhau
    // → bất kỳ conversation nào chứa user đều khớp) → tin tự gửi lọt vào hội thoại
    // người lạ = rò rỉ riêng tư / inject chéo hội thoại. AI_ASSISTANT không bị ảnh
    // hưởng vì id của nó không bao giờ bằng userId thật.
    if (userId === dto.receiverId) {
      throw new BadRequestException('Không thể nhắn tin cho chính mình');
    }

    // 2. Xử lý logic USER ĐĂNG NHẬP (Lưu DB như cũ)
    // Lưu tin nhắn user gửi
    const savedUserMsg = await this.sendMessageToDb(userId, dto);

    if (dto.receiverId === 'AI_ASSISTANT') {
        const history = await this.getAiHistory(userId, 6);
        const aiResult = await this.aiService.getAiResponse(userId || 'guest', dto.content, history);
    
        // Sửa kiểu dữ liệu ở đây
        let msgType: MessageType = MessageType.TEXT; // Sử dụng Enum chuẩn
        let msgContent = aiResult.text;

        if (aiResult.products && aiResult.products.length > 0) {
             // LƯU Ý: Nếu schema.prisma của bạn chưa có enum PRODUCT, dòng dưới sẽ lỗi.
             // Hãy đảm bảo schema.prisma: enum MessageType { TEXT, IMAGE, PRODUCT, ... }
             // Nếu chưa có, tạm thời dùng: msgType = 'PRODUCT' as any;
             msgType = 'PRODUCT' as any; 
             msgContent = JSON.stringify(aiResult.products[0]); 
        }

    // Nếu là User thật -> Lưu DB
    let savedAiMsg;
    if (userId) {
         savedAiMsg = await this.sendMessageToDb('AI_ASSISTANT', {
            receiverId: userId,
            content: msgContent, // Lưu JSON string
            type: msgType,
        });
    } else {
        // Mock cho Guest
        savedAiMsg = {
            id: Date.now().toString(),
            senderId: 'AI_ASSISTANT',
            content: msgContent,
            type: msgType,
            createdAt: new Date().toISOString()
        };
    }

        // Trả về cả 2 để frontend hiển thị
        return {
            userMessage: savedUserMsg,
            aiMessage: {
                ...savedAiMsg,
                options: aiResult.options,
                searchSuggestions: aiResult.searchSuggestions
            }
        };
    }

    // Nếu chat người thường
    return { userMessage: savedUserMsg, aiMessage: null };
  }

  private async sendMessageToDb(senderId: string, dto: CreateMessageDto) {
     let conversationId = '';

     const existingConv = await this.prisma.conversation.findFirst({
        where: { AND: [{ participants: { some: { id: senderId } } }, { participants: { some: { id: dto.receiverId } } }] }
     });
     
     if (existingConv) {
         conversationId = existingConv.id;
         await this.prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });
     } else {
         // Prisma 5 implicit M2M không nhận `connect: [...]` ở MySQL — tách 2 step.
         const newConv = await this.prisma.conversation.create({ data: {} });
         await this.prisma.conversation.update({
             where: { id: newConv.id },
             data: { participants: { connect: { id: senderId } } },
         });
         await this.prisma.conversation.update({
             where: { id: newConv.id },
             data: { participants: { connect: { id: dto.receiverId } } },
         });
         conversationId = newConv.id;
     }

     const message = await this.prisma.message.create({
        data: {
            senderId, conversationId,
            content: EncryptionUtil.encrypt(dto.content),
            // FIX LỖI TYPE Ở ĐÂY:
            type: dto.type || MessageType.TEXT 
        },
        include: { sender: { select: { id: true, name: true, role: true } } }
     });

     return { ...message, content: EncryptionUtil.decrypt(message.content) };
  }
  async sendMessage(senderId: string, dto: CreateMessageDto) {
    // Wiki 0086: chặn tự nhắn cho chính mình ngay tại get-or-create-conversation
    // (path WebSocket gateway). Nếu senderId === receiverId thì điều kiện
    // "participants có cả 2 id" khớp BẤT KỲ hội thoại nào chứa user → tin lọt vào
    // hội thoại người lạ = inject chéo / rò rỉ riêng tư.
    if (senderId === dto.receiverId) {
      throw new BadRequestException('Không thể nhắn tin cho chính mình');
    }
    // B3.3 fix: bọc find/create conversation + create message trong transaction
    // để tránh trường hợp conversation được tạo nhưng message fail -> có
    // conversation rỗng trong DB + client nghĩ tin đã gửi (vì gateway
    // catch-all).
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
      } else {
        // Prisma 5 implicit M2M trên MySQL bị bug array connect — tách step.
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
          content: EncryptionUtil.encrypt(dto.content),
          type: dto.type,
        },
        include: {
          sender: { select: { id: true, name: true, role: true } },
        },
      });

      return {
        ...message,
        content: EncryptionUtil.decrypt(message.content),
        senderId: message.senderId,
      };
    });
  }

  // --- API LOGIC ---

  async searchUsers(query: string, currentUserId: string) {
  return this.prisma.user.findMany({
    where: {
      AND: [
        { id: { not: currentUserId } },
        {
          OR: [
            // <--- Xóa dòng mode: 'insensitive' để tránh lỗi type
            { email: { contains: query } },
            { name: { contains: query } },
          ],
        },
      ],
    },
    // Không trả email ra ngoài — chỉ id/name/avatar/role để tránh lộ email
    // của người dùng khác qua API tìm kiếm (vẫn cho phép search theo email).
    select: { id: true, name: true, avatar: true, role: true },
    take: 5,
  });
}

  // Audit Buyer Search/Game #21: "Chat với chuyên gia tư vấn" / "Chat với nhân viên"
  // ở `/user/help` link sang `/messages?role=admin` nhưng FE không biết user
  // admin nào để mở. Endpoint mới trả về 1 admin user để FE open-chat.
  async findChatPartnerByRole(role: 'ADMIN' | 'SELLER') {
    const user = await this.prisma.user.findFirst({
      where: { role },
      orderBy: { createdAt: 'asc' }, // admin đầu tiên (account hệ thống)
      // Wiki 0086: KHÔNG trả email ra ngoài — endpoint này cho mọi user đã đăng nhập
      // gọi, trước đây lộ email của admin/seller cho bất kỳ ai. Mirror fix round10 ở
      // searchUsers (đã bỏ email). Chỉ cần id/name/avatar/role để FE mở chat.
      select: { id: true, name: true, role: true, avatar: true },
    });
    if (!user) {
      // Không throw — FE sẽ hiển thị "Không tìm thấy admin để chat" thân thiện.
      return null;
    }
    return user;
  }

  async getUserConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        participants: { some: { id: userId } },
      },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        participants: {
          select: { id: true, name: true, role: true, email: true, avatar: true },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // B3.3 fix: lastMessage phải decrypt trước khi trả cho FE — trước đây hàm
    // này trả thẳng content ở dạng encrypted (base64) nên preview bên trái
    // hiển thị chuỗi rối. getMessages đã decrypt đúng, chỉ hàm này quên.
    return conversations.map((conv) => {
      const partner = conv.participants.find((p) => p.id !== userId);
      const lastMsg = conv.messages[0];
      let lastMessagePlain = '';
      if (lastMsg?.content) {
        try {
          lastMessagePlain = EncryptionUtil.decrypt(lastMsg.content);
        } catch {
          // Data cũ chưa encrypt hoặc key thay đổi — trả nguyên để không crash
          lastMessagePlain = lastMsg.content;
        }
      }
      return {
        id: conv.id,
        partner,
        lastMessage: lastMessagePlain,
        lastMessageAt: conv.lastMessageAt,
        unreadCount:
          lastMsg && lastMsg.senderId !== userId && !lastMsg.isRead ? 1 : 0,
        isRead: lastMsg?.senderId === userId ? true : lastMsg?.isRead,
      };
    });
  }

  async getMessages(conversationId: string, userId: string, limit: number = 20, cursor?: string) {
    // Wiki 0075: chỉ participant mới đọc được tin nhắn. Trước đây fetch chỉ theo
    // conversationId (không nhận userId) → bất kỳ ai biết convId đọc trộm tin nhắn
    // (đã giải mã) của 2 người khác = lộ riêng tư.
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, participants: { some: { id: userId } } },
      select: { id: true },
    });
    if (!conv) throw new ForbiddenException('Bạn không có quyền xem hội thoại này');

    // 1. Lấy dữ liệu từ DB (Cần await để lấy kết quả thô trước)
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

    // 2. Map qua từng tin nhắn để giải mã nội dung
    return messages.map((msg) => {
      try {
        return {
          ...msg,
          // Giải mã nội dung trước khi trả về FE
          content: EncryptionUtil.decrypt(msg.content),
        };
      } catch (error) {
        // Phòng trường hợp dữ liệu cũ chưa mã hoá hoặc lỗi key, trả về nguyên gốc để không crash app
        return msg;
      }
    });
  }

  async markAsRead(conversationId: string, userId: string) {
    // Wiki 0075 (tương tự getMessages): chỉ participant của hội thoại mới được
    // markAsRead. Trước đây updateMany chỉ lọc theo conversationId nên bất kỳ ai
    // biết convId cũng có thể đánh dấu đã đọc tin nhắn của 2 người khác.
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, participants: { some: { id: userId } } },
      select: { id: true },
    });
    if (!conv) throw new ForbiddenException('Bạn không có quyền với hội thoại này');

    // Đánh dấu tất cả tin nhắn trong hội thoại mà KHÔNG PHẢI do mình gửi là đã đọc
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

  async findOrCreateConversation(userId: string, partnerId: string) {
    // Wiki 0086: chặn mở hội thoại với chính mình. Cùng lỗ hổng như send-message:
    // userId === partnerId khiến điều kiện match BẤT KỲ hội thoại nào của user với
    // người khác → trả về partner/lastMessage của người lạ = rò rỉ riêng tư.
    if (userId === partnerId) {
      throw new BadRequestException('Không thể nhắn tin cho chính mình');
    }
    // 1. Tìm hội thoại cũ
    let conversation = await this.prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { id: userId } } },
          { participants: { some: { id: partnerId } } },
        ],
      },
      include: {
        participants: { select: { id: true, name: true, role: true, email: true } },
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });

    // 2. Nếu chưa có -> Tạo mới.
    // Prisma 5 + many-to-many implicit ở MySQL bị lỗi 'Expected UserWhereUniqueInput'
    // khi dùng `connect: [{...}, {...}]` trong nested write. Tách thành 2 update
    // sequential để né bug.
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
          participants: { select: { id: true, name: true, role: true, email: true } },
          messages: { take: 1, orderBy: { createdAt: 'desc' } },
        },
      });
    }

    // 3. Format dữ liệu
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
}