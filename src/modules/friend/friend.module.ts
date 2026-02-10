import { Module } from '@nestjs/common';
import { FriendService } from './friend.service';
import { FriendController } from './friend.controller';
import { DatabaseModule } from '../../database/database.module';
import { ChatModule } from '../chat/chat.module'; // Import ChatModule để dùng ChatGateway
import { MailerModule } from '@nestjs-modules/mailer';

@Module({
  imports: [DatabaseModule, MailerModule, ChatModule], 
  controllers: [FriendController],
  providers: [FriendService],
  exports: [FriendService],
})
export class FriendModule {}