import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { GiftConsultantService } from './gift-consultant.service';
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';
export declare class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly giftService;
    private readonly chatService;
    private readonly jwtService;
    server: Server;
    private readonly logger;
    constructor(giftService: GiftConsultantService, chatService: ChatService, jwtService: JwtService);
    handleConnection(client: Socket): Promise<void>;
    handleMessage(data: any, client: Socket): Promise<void>;
    handleDisconnect(client: Socket): void;
}
