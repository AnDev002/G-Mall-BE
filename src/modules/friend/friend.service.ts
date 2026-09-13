import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ChatGateway } from '../chat/chat.gateway'; // Tận dụng Gateway của Chat để bắn noti
import { FriendshipStatus } from '@prisma/client';
import { MailerService } from '@nestjs-modules/mailer';

/**
 * wiki 0095 B4 — escape nội dung người dùng nhập trước khi ghép vào HTML email.
 * Không dùng thư viện sanitize nặng vì ở đây KHÔNG cần giữ lại thẻ nào cả:
 * lời nhắn mời bạn là text thuần, escape hết là đủ và không thể bypass.
 */
function escapeHtml(input: string): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class FriendService {
  private readonly logger = new Logger(FriendService.name);

  constructor(
    private prisma: PrismaService,
    private chatGateway: ChatGateway, // Inject Gateway để real-time
    private readonly mailerService: MailerService,
  ) {}

  // 1. Gửi lời mời kết bạn
  async sendFriendRequest(userId: string, receiverId: string) {
    if (userId === receiverId) throw new BadRequestException("Không thể kết bạn với chính mình");

    // Kiểm tra xem đã tồn tại quan hệ chưa (kể cả chiều ngược lại)
    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: receiverId },
          { senderId: receiverId, receiverId: userId },
        ]
      }
    });

    if (existing) {
      if (existing.status === FriendshipStatus.ACCEPTED) throw new BadRequestException("Hai bạn đã là bạn bè");
      if (existing.status === FriendshipStatus.PENDING) throw new BadRequestException("Đã có lời mời kết bạn đang chờ");
    }

    // Tạo request mới
    const friendship = await this.prisma.friendship.create({
      data: {
        senderId: userId,
        receiverId: receiverId,
        status: FriendshipStatus.PENDING
      },
      include: { sender: { select: { id: true, name: true, avatar: true } } }
    });

    // 🔥 Real-time: Bắn socket báo cho người nhận (receiverId)
    // Client cần listen sự kiện 'new_friend_request'
    this.chatGateway.server.to(`user_${receiverId}`).emit('new_friend_request', friendship);

    return { message: "Đã gửi lời mời kết bạn", data: friendship };
  }
  async inviteByEmail(senderId: string, email: string, message: string) {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Lấy thông tin người gửi
    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
      select: { id: true, name: true, email: true, avatar: true },
    });

    if (!sender) throw new BadRequestException('Người gửi không tồn tại');
    // wiki 0095 B4: so sánh phải cùng chuẩn hoá. sender.email trong DB có thể
    // còn hoa/thường lẫn lộn (đăng ký cũ, OAuth) → so thô sẽ lọt, user tự mời
    // chính mình rồi nhận lỗi khó hiểu ở bước sau.
    if ((sender.email ?? '').toLowerCase().trim() === normalizedEmail) {
      throw new BadRequestException('Đây là email của chính bạn. Hãy nhập email của người bạn muốn mời.');
    }

    // 2. Kiểm tra xem Email người được mời đã có tài khoản chưa
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // === CASE A: NGƯỜI DÙNG ĐÃ TỒN TẠI ===
    if (existingUser) {
      // FIX: Sửa logic query theo schema (senderId, receiverId)
      const existingFriendship = await this.prisma.friendship.findFirst({
        where: {
          OR: [
            { senderId: senderId, receiverId: existingUser.id },
            { senderId: existingUser.id, receiverId: senderId },
          ],
        },
      });

      // wiki 0095 B4/B5 — khách báo: "báo lỗi email gửi đi", nguyên nhân là
      // "gửi trùng email cũ nhưng chưa thông báo rõ".
      // Message cũ ("Đã gửi lời mời kết bạn rồi.") không nói MỜI AI, ai gửi cho
      // ai, và cũng không phân biệt được các trạng thái khác nhau → seller tưởng
      // hệ thống gửi mail lỗi. Giờ mỗi trạng thái một câu rõ ràng, luôn kèm email.
      if (existingFriendship) {
        if (existingFriendship.status === FriendshipStatus.ACCEPTED) {
          throw new BadRequestException(
            `${normalizedEmail} đã là bạn bè của bạn trên GMall — không cần mời lại.`,
          );
        }
        if (existingFriendship.status === FriendshipStatus.BLOCKED) {
          throw new BadRequestException(
            `Không thể gửi lời mời tới ${normalizedEmail} vì tài khoản này đang bị chặn.`,
          );
        }
        // PENDING — phân biệt chiều gửi, vì hành động tiếp theo của user khác nhau.
        if (existingFriendship.senderId === senderId) {
          throw new BadRequestException(
            `Bạn đã mời ${normalizedEmail} trước đó rồi, lời mời đang chờ họ đồng ý. ` +
              `Không cần gửi lại — nhắc bạn ấy kiểm tra mục "Lời mời kết bạn" nhé.`,
          );
        }
        throw new BadRequestException(
          `${normalizedEmail} đã gửi lời mời kết bạn cho bạn từ trước. ` +
            `Vào mục "Lời mời kết bạn" để đồng ý là hai bạn thành bạn bè ngay.`,
        );
      }

      // Tạo lời mời kết bạn (Friendship PENDING)
      // FIX: Sửa field thành senderId, receiverId
      await this.prisma.friendship.create({
        data: {
          senderId: senderId,
          receiverId: existingUser.id,
          status: 'PENDING',
        },
      });

      // TODO: Bắn Socket thông báo 
      // this.notificationService.sendFriendRequestNotification(existingUser.id, sender);

      return {
        success: true,
        type: 'internal',
        message: `${normalizedEmail} đang dùng GMall — đã gửi lời mời kết bạn tới họ!`,
      };
    }

    // === CASE B: NGƯỜI DÙNG CHƯA TỒN TẠI -> GỬI MAIL ===
    // wiki 0095 B4: TRƯỚC ĐÂY hardcode `https://gmall.com.vn` — domain này KHÔNG
    // phải nơi FE đang chạy (prod chạy trên Render/domain cấu hình qua FE_URL),
    // nên người được mời bấm vào link là vào trang chết → không ai đăng ký được
    // qua email mời, và người giới thiệu không bao giờ nhận điểm.
    // Dùng chung FE_URL với email reset-password (auth.service.ts).
    const feUrl = (process.env.FE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    const registerLink = `${feUrl}/register?ref=${encodeURIComponent(sender.id)}`;

    // wiki 0095 B4: `message` và `sender.name` do người dùng nhập tự do và được
    // nội suy thẳng vào HTML email → có thể chèn thẻ <a> trỏ sang trang lừa đảo
    // mà email vẫn mang danh GMall. Escape trước khi ghép.
    const safeSenderName = escapeHtml(sender.name ?? 'Người dùng GMall');
    const safeMessage = escapeHtml(message);

    try {
      await this.mailerService.sendMail({
        to: normalizedEmail,
        // Subject là text thuần, không escape HTML (escape sẽ hiện "&amp;" trong
        // tiêu đề hộp thư), nhưng phải chặn CRLF injection thêm header.
        subject: `${(sender.name ?? 'Một người bạn').replace(/[\r\n]+/g, ' ')} mời bạn tham gia GMall!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #2563eb; padding: 20px; text-align: center;">
              <h2 style="color: #ffffff; margin: 0;">Lời mời tham gia GMall</h2>
            </div>
            
            <div style="padding: 24px; background-color: #ffffff;">
              <p style="font-size: 16px; color: #333;">Xin chào,</p>
              
              <p style="font-size: 16px; color: #333; line-height: 1.5;">
                Bạn của bạn là <strong>${safeSenderName}</strong> đang sử dụng GMall và muốn mời bạn cùng tham gia.
              </p>

              <div style="background-color: #f3f4f6; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #555; font-style: italic;">"${safeMessage}"</p>
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
      
    } catch (error: any) {
      // wiki 0095 B4: log kèm email đích + mã lỗi SMTP để còn debug được khi
      // seller báo "gửi không được" (trước chỉ có message trần, không biết mời ai).
      this.logger.error(
        `[inviteByEmail] gửi mail tới ${normalizedEmail} thất bại: ${error?.responseCode ?? ''} ${error?.message}`,
      );
      throw new BadRequestException(
        `Không gửi được thư mời tới ${normalizedEmail}. Vui lòng kiểm tra lại địa chỉ email và thử lại sau ít phút.`,
      );
    }
  }
  // 2. Chấp nhận / Từ chối
  async handleFriendRequest(userId: string, requestId: string, action: 'ACCEPT' | 'REJECT') {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: requestId }
    });

    if (!friendship) throw new NotFoundException("Lời mời không tồn tại");
    if (friendship.receiverId !== userId) throw new BadRequestException("Bạn không có quyền xử lý lời mời này");
    if (friendship.status !== FriendshipStatus.PENDING) throw new BadRequestException("Lời mời này đã được xử lý trước đó");

    if (action === 'REJECT') {
      await this.prisma.friendship.delete({ where: { id: requestId } });
      return { message: "Đã từ chối lời mời" };
    }

    // ACCEPT
    const updated = await this.prisma.friendship.update({
      where: { id: requestId },
      data: { status: FriendshipStatus.ACCEPTED },
      include: { receiver: { select: { id: true, name: true, avatar: true } } }
    });

    // 🔥 Real-time: Báo cho người gửi là "A đã chấp nhận lời mời"
    this.chatGateway.server.to(`user_${friendship.senderId}`).emit('friend_request_accepted', updated);

    return { message: "Đã trở thành bạn bè", data: updated };
  }

  // 3. Lấy danh sách bạn bè (Cho trang /user/friends)
  async getFriendList(userId: string) {
    const friends = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [{ senderId: userId }, { receiverId: userId }]
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true, email: true } },
        receiver: { select: { id: true, name: true, avatar: true, email: true } }
      }
    });

    // Map lại dữ liệu để FE dễ hiển thị
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

  // 4. Lấy danh sách lời mời đã nhận (Pending)
  async getPendingRequests(userId: string) {
    console.log(">>> [DEBUG] Finding pending requests for Receiver ID:", userId);

    const requests = await this.prisma.friendship.findMany({
      where: {
        receiverId: userId,          // Đảm bảo userId này chính xác
        status: FriendshipStatus.PENDING
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(">>> [DEBUG] Found:", requests.length, "requests");
    return requests;
  }

  // 5. Hủy kết bạn
  async unfriend(userId: string, friendId: string) {
    // Tìm record bất kể ai là sender/receiver
    const friendship = await this.prisma.friendship.findFirst({
        where: {
            status: FriendshipStatus.ACCEPTED,
            OR: [
                { senderId: userId, receiverId: friendId },
                { senderId: friendId, receiverId: userId }
            ]
        }
    });

    if (!friendship) throw new NotFoundException("Các bạn chưa kết bạn");

    await this.prisma.friendship.delete({ where: { id: friendship.id } });
    return { success: true, message: "Đã hủy kết bạn" };
  }

  async searchUsers(userId: string, keyword: string) {
    if (!keyword || keyword.trim() === '') return [];

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
      select: { id: true, name: true, avatar: true, email: true, role: true }, // Nên select thêm role để FE hiển thị
      take: 20
    });

    // 2. Kiểm tra trạng thái bạn bè với từng người tìm được
    const results = await Promise.all(users.map(async (u) => {
      const friendship = await this.prisma.friendship.findFirst({
        where: {
          OR: [
            { senderId: userId, receiverId: u.id },
            { senderId: u.id, receiverId: userId }
          ]
        }
      });

      let status: 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'FRIEND' = 'NONE';

      if (friendship) {
        if (friendship.status === FriendshipStatus.ACCEPTED) {
          status = 'FRIEND';
        } else if (friendship.status === FriendshipStatus.PENDING) {
          // Nếu mình là người gửi -> PENDING_SENT
          // Nếu mình là người nhận -> PENDING_RECEIVED
          status = friendship.senderId === userId ? 'PENDING_SENT' : 'PENDING_RECEIVED';
        }
      }

      return { ...u, status };
    }));

    return results;
  }
}