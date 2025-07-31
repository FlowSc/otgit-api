import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  ValidationPipe,
  Param,
  UseGuards,
  Request,
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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Post('rooms')
  @UseGuards(JwtAuthGuard)
  async createChatRoom(
    @Body(ValidationPipe) createChatRoomDto: CreateChatRoomDto,
    @Request() req: any,
  ): Promise<ChatRoomResponseDto> {
    return this.chatService.createChatRoom(createChatRoomDto);
  }

  @Get('rooms')
  @UseGuards(JwtAuthGuard)
  async getChatRooms(
    @Query(ValidationPipe) getChatRoomsDto: GetChatRoomsDto,
    @Request() req: any,
  ) {
    const userId = req.user.userId;
    return this.chatService.getChatRooms({
      ...getChatRoomsDto,
      user_id: userId,
    });
  }

  @Post('messages')
  @UseGuards(JwtAuthGuard)
  async sendMessage(
    @Body(ValidationPipe) sendMessageDto: SendMessageDto,
    @Request() req: any,
  ): Promise<MessageResponseDto> {
    const senderId = req.user.userId;
    return this.chatService.sendMessage({
      ...sendMessageDto,
      sender_id: senderId,
    });
  }

  @Get('messages')
  @UseGuards(JwtAuthGuard)
  async getMessages(
    @Query(ValidationPipe) getMessagesDto: GetMessagesDto,
    @Request() req: any,
  ) {
    return this.chatService.getMessages(getMessagesDto);
  }

  @Post('mark-read')
  @UseGuards(JwtAuthGuard)
  async markAsRead(
    @Body(ValidationPipe) markAsReadDto: MarkAsReadDto,
    @Request() req: any,
  ) {
    const userId = req.user.userId;
    return this.chatService.markAsRead({ ...markAsReadDto, user_id: userId });
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
