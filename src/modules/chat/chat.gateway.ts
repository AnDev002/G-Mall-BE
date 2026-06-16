import { 
  WebSocketGateway, 
  SubscribeMessage, 
  MessageBody, 
  ConnectedSocket, 
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer 
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io'; // Import Server
import { GiftConsultantService } from './gift-consultant.service';
import { ChatService } from './chat.service'; // Import ChatService
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt'; // Cần để verify token lấy userId
import * as cookie from 'cookie';

function parseCookie(str: string) {
  return str
    .split(';')
    .map(v => v.split('='))
    .reduce((acc, v) => {
      acc[decodeURIComponent(v[0].trim())] = decodeURIComponent(v[1].trim());
      return acc;
    }, {});
}

@WebSocketGateway({ 
  cors: {
    origin: true, // Hoặc domain frontend cụ thể
    credentials: true // QUAN TRỌNG: Phải khớp với frontend
  }
 })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server; // Inject Server instance để emit tới room cụ thể

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly giftService: GiftConsultantService,
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService // Inject JwtService (cần import trong ChatModule)
  ) {}

  async handleConnection(client: Socket) {
    try {
        console.log(`\n--- [DEBUG] New Connection Attempt: ${client.id} ---`);
        
        let token = client.handshake.auth.token;
        const cookieString = client.handshake.headers.cookie;

        console.log('1. Cookie String:', cookieString); // Xem cookie có được gửi lên không

        if (!token && cookieString) {
            const cookies = parseCookie(cookieString);
            // In ra toàn bộ key cookie để xem bạn đang dùng tên gì
            console.log('2. Parsed Cookies Keys:', Object.keys(cookies)); 
            
            // Kiểm tra tên cookie chính xác
            token = cookies['Authentication'] || cookies['accessToken'] || cookies['access_token']; 
        }

        if (!token) {
            console.log('❌ No Token found -> Guest Mode');
            return;
        }

        const payload = this.jwtService.verify(token, { secret: process.env.JWT_SECRET });
        // Kiểm tra xem payload giải mã ra cái gì
        console.log('3. Decoded Payload:', payload);

        const userId = payload.userId || payload.sub || payload.id;

        if (!userId) {
            console.log('❌ Token valid but UserID is missing in payload');
            client.disconnect();
            return;
        }

        // Áp dụng các check giống JwtStrategy.validate (gateway không qua
        // JwtAuthGuard): user phải tồn tại, chưa bị ban, tokenVersion khớp.
        // Nếu không hợp lệ -> ngắt kết nối.
        const validUser = await this.chatService.validateSocketUser(
            userId,
            payload.tokenVersion,
        );
        if (!validUser) {
            console.log('❌ User not found / banned / token revoked');
            client.disconnect();
            return;
        }

        // QUAN TRỌNG: Kiểm tra xem đã join đúng room chưa
        client.join(`user_${userId}`);
        client.data.userId = userId;

        console.log(`✅ SUCCESS: User ${userId} joined room "user_${userId}"`);
        
        // In ra danh sách các room mà socket này đang join
        console.log('   Current Rooms:', client.rooms);

    } catch (e) {
        console.error('❌ Connection Error:', e.message);
        client.disconnect();
    }
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    const senderId = client.data.userId;
    console.log(`\n--- [DEBUG] Handle Message from ${senderId} ---`);
    console.log('Payload:', data);

    if (!senderId) {
        console.log('❌ Sender not identified (Not logged in)');
        client.emit('error', { message: 'Unauthorized' });
        return;
    }

    // Validate payload trước khi xử lý: tránh null/empty content, content quá
    // dài (DoS / abuse), và phải có receiverId hợp lệ.
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

    // ... (Giữ code logic cũ)

    // B3.3 fix: optimistic clientTempId — FE gửi kèm clientTempId khi send,
    // BE echo lại ở payload để FE biết tin nào đã confirmed (thay cho logic
    // merge theo content-match cũ dễ sai khi user gõ tin trùng nhau).
    const clientTempId = data.clientTempId;

    try {
        const savedMessage = await this.chatService.sendMessage(senderId, {
            content: content.trim(),
            receiverId,
            type: (data.type as any) || 'TEXT'
        });

        const payload = {
            id: savedMessage.id,
            conversationId: savedMessage.conversationId,
            senderId: senderId,
            content: savedMessage.content,
            type: savedMessage.type,
            timestamp: savedMessage.createdAt,
            sender: savedMessage.sender,
            clientTempId, // echo để FE replace optimistic message chính xác
        };

        // Gửi cho NGƯỜI NHẬN
        this.server.to(`user_${data.receiverId}`).emit('receive_message', payload);

        // Gửi lại cho NGƯỜI GỬI (xác nhận lưu thành công)
        client.emit('receive_message', payload);

    } catch (e) {
        // B3.3 fix: trước đây chỉ console.error, client không biết -> tin
        // optimistic vĩnh viễn "pending" rồi F5 mới mất. Giờ báo rõ cho FE.
        console.error('❌ Error processing message:', e);
        client.emit('message_error', {
          clientTempId,
          message: 'Không gửi được tin nhắn. Vui lòng thử lại.',
          reason: e?.message,
        });
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }
}