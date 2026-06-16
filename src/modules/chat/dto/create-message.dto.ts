// src/chat/dto/create-message.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MessageType } from '@prisma/client';

// --- QUAN TRỌNG: Re-export để sửa lỗi "declares locally but is not exported" ---
export { MessageType };

// Wiki 0086: 1 message lịch sử mà guest AI-chat gửi kèm. AI service đọc `senderId`
// (để phân biệt user/assistant) và `content`. Khai báo thành class có decorator để
// global ValidationPipe (whitelist:true) GIỮ field thay vì strip.
export class AiHistoryMessageDto {
  @IsOptional()
  @IsString()
  senderId?: string;

  @IsOptional()
  @IsString()
  content?: string;
}

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsNotEmpty()
  receiverId: string;

  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType = MessageType.TEXT;

  // Wiki 0086: lịch sử hội thoại cho guest AI-chat. Trước đây không khai báo nên
  // ValidationPipe whitelist:true CẮT field này → AI mất ngữ cảnh hội thoại khách.
  // Optional + validate-nested để không phá happy-path các tin nhắn người-người.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiHistoryMessageDto)
  history?: AiHistoryMessageDto[];
}