import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  ValidationPipe,
  Param,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import {
  CreateChatRoomDto,
  ChatRoomResponseDto,
  SendMessageDto,
  MessageResponseDto,
  GetChatRoomsDto,
  GetMessagesDto,
  MarkAsReadDto,
} from './dto/chat.dto';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Post('rooms')
  async createChatRoom(
    @Body(ValidationPipe) createChatRoomDto: CreateChatRoomDto,
  ): Promise<ChatRoomResponseDto> {
    return this.chatService.createChatRoom(createChatRoomDto);
  }

  @Get('rooms')
  async getChatRooms(@Query(ValidationPipe) getChatRoomsDto: GetChatRoomsDto) {
    return this.chatService.getChatRooms(getChatRoomsDto);
  }

  @Post('messages')
  async sendMessage(
    @Body(ValidationPipe) sendMessageDto: SendMessageDto,
  ): Promise<MessageResponseDto> {
    return this.chatService.sendMessage(sendMessageDto);
  }

  @Get('messages')
  async getMessages(@Query(ValidationPipe) getMessagesDto: GetMessagesDto) {
    return this.chatService.getMessages(getMessagesDto);
  }

  @Post('mark-read')
  async markAsRead(@Body(ValidationPipe) markAsReadDto: MarkAsReadDto) {
    return this.chatService.markAsRead(markAsReadDto);
  }

  @Get('online-users')
  async getOnlineUsers() {
    const onlineUserIds = this.chatGateway.getOnlineUsers();
    return {
      success: true,
      online_users: onlineUserIds,
      count: onlineUserIds.length,
    };
  }

  @Get('user/:userId/online')
  async isUserOnline(@Param('userId') userId: string) {
    const isOnline = this.chatGateway.isUserOnline(userId);
    return {
      success: true,
      user_id: userId,
      is_online: isOnline,
    };
  }
}
