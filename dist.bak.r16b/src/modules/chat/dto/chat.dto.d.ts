import { MessageType } from '@prisma/client';
export declare class SendMessageDto {
    receiverId: string;
    content: string;
    type?: MessageType;
}
export declare class OpenChatDto {
    receiverId: string;
}
