import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { NewsletterService } from './newsletter.service';

class SubscribeDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  sourceTag?: string;
}

class UnsubscribeDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string;
}

@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly service: NewsletterService) {}

  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  subscribe(@Body() dto: SubscribeDto) {
    return this.service.subscribe(dto.email, dto.sourceTag);
  }

  @Post('unsubscribe')
  @HttpCode(HttpStatus.OK)
  unsubscribe(@Body() dto: UnsubscribeDto) {
    return this.service.unsubscribe(dto.email);
  }
}
