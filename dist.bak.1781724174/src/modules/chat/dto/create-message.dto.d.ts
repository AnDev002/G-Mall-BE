import { MessageType } from '@prisma/client';
export { MessageType };
export declare class AiHistoryMessageDto {
    senderId?: string;
    content?: string;
}
export declare class CreateMessageDto {
    content: string;
    receiverId: string;
    type?: MessageType;
    history?: AiHistoryMessageDto[];
}
