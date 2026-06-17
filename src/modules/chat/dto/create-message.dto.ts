// src/chat/dto/create-message.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  MaxLength,
  ArrayMaxSize,
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
  @MaxLength(5000) // [round14 FIX H2] clamp content lịch sử để chống DoS chi phí OpenAI/bộ nhớ
  content?: string;
}

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000) // [round14 FIX H2] giới hạn độ dài tin nhắn để chống DoS chi phí OpenAI/bộ nhớ
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
  @ArrayMaxSize(20) // [round14 FIX H2] cap số message lịch sử để chống DoS bộ nhớ/chi phí
  @ValidateNested({ each: true })
  @Type(() => AiHistoryMessageDto)
  history?: AiHistoryMessageDto[];
}