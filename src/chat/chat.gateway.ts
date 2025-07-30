import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userInfo?: {
    id: string;
    name: string;
    email: string;
  };
}

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001', /^otgit:\/\//],
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly connectedUsers = new Map<string, AuthenticatedSocket>();

  constructor(
    private readonly chatService: ChatService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // JWT 토큰 인증
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Connection rejected: No token provided`);
        client.disconnect();
        return;
      }

      const jwtSecret = this.configService.get('JWT_SECRET');
      if (!jwtSecret) {
        this.logger.error('JWT_SECRET not configured');
        client.disconnect();
        return;
      }

      // JWT 토큰 검증
      const decoded = jwt.verify(token, jwtSecret) as any;
      client.userId = decoded.sub;
      client.userInfo = {
        id: decoded.sub,
        name: decoded.name,
        email: decoded.email,
      };

      // 사용자 연결 상태 저장
      if (client.userId) {
        this.connectedUsers.set(client.userId, client);
      }

      // 사용자의 채팅방들에 조인
      if (client.userId) {
        await this.joinUserChatRooms(client);
      }

      this.logger.log(
        `User ${client.userInfo.name} (${client.userId}) connected`,
      );

      // 온라인 상태를 다른 사용자들에게 알림
      this.server.emit('user_online', {
        userId: client.userId,
        userName: client.userInfo.name,
      });
    } catch (error) {
      this.logger.warn(`Connection rejected: Invalid token - ${error.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      this.connectedUsers.delete(client.userId);

      this.logger.log(
        `User ${client.userInfo?.name} (${client.userId}) disconnected`,
      );

      // 오프라인 상태를 다른 사용자들에게 알림
      this.server.emit('user_offline', {
        userId: client.userId,
        userName: client.userInfo?.name,
      });
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody()
    data: { chat_room_id: string; message_text: string; message_type?: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      if (!client.userId) {
        return { error: 'Not authenticated' };
      }

      // 메시지 데이터베이스에 저장
      const message = await this.chatService.sendMessage({
        chat_room_id: data.chat_room_id,
        sender_id: client.userId,
        message_text: data.message_text,
        message_type:
          (data.message_type as 'text' | 'image' | 'system') || 'text',
      });

      // 채팅방의 모든 참여자에게 실시간 전송
      this.server.to(`room_${data.chat_room_id}`).emit('new_message', {
        id: message.id,
        chat_room_id: message.chat_room_id,
        sender_id: message.sender_id,
        message_text: message.message_text,
        message_type: message.message_type,
        created_at: message.created_at,
        sender: message.sender,
      });

      return { success: true, message_id: message.id };
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      return { error: 'Failed to send message' };
    }
  }

  @SubscribeMessage('mark_as_read')
  async handleMarkAsRead(
    @MessageBody() data: { chat_room_id: string; message_id: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      if (!client.userId) {
        return { error: 'Not authenticated' };
      }

      await this.chatService.markAsRead({
        chat_room_id: data.chat_room_id,
        user_id: client.userId,
        message_id: data.message_id,
      });

      // 채팅방의 다른 사용자에게 읽음 상태 알림
      client.to(`room_${data.chat_room_id}`).emit('message_read', {
        chat_room_id: data.chat_room_id,
        message_id: data.message_id,
        read_by: client.userId,
        read_by_name: client.userInfo?.name,
        read_at: new Date().toISOString(),
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`Error marking message as read: ${error.message}`);
      return { error: 'Failed to mark message as read' };
    }
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @MessageBody() data: { chat_room_id: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      if (!client.userId) {
        return { error: 'Not authenticated' };
      }

      // 채팅방 참여 권한 확인
      if (!client.userId) {
        return { error: 'Not authenticated' };
      }

      const rooms = await this.chatService.getChatRooms({
        user_id: client.userId,
        page: 1,
        limit: 100,
      });

      const hasAccess = rooms.rooms.some(
        (room) => room.id === data.chat_room_id,
      );
      if (!hasAccess) {
        return { error: 'Access denied to this chat room' };
      }

      // Socket.IO 룸에 조인
      await client.join(`room_${data.chat_room_id}`);

      this.logger.log(
        `User ${client.userInfo?.name} joined room ${data.chat_room_id}`,
      );

      return { success: true };
    } catch (error) {
      this.logger.error(`Error joining room: ${error.message}`);
      return { error: 'Failed to join room' };
    }
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @MessageBody() data: { chat_room_id: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    await client.leave(`room_${data.chat_room_id}`);
    this.logger.log(
      `User ${client.userInfo?.name} left room ${data.chat_room_id}`,
    );
    return { success: true };
  }

  @SubscribeMessage('typing_start')
  async handleTypingStart(
    @MessageBody() data: { chat_room_id: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.userId) return;

    client.to(`room_${data.chat_room_id}`).emit('user_typing_start', {
      chat_room_id: data.chat_room_id,
      user_id: client.userId,
      user_name: client.userInfo?.name,
    });
  }

  @SubscribeMessage('typing_stop')
  async handleTypingStop(
    @MessageBody() data: { chat_room_id: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.userId) return;

    client.to(`room_${data.chat_room_id}`).emit('user_typing_stop', {
      chat_room_id: data.chat_room_id,
      user_id: client.userId,
      user_name: client.userInfo?.name,
    });
  }

  // 사용자가 참여한 모든 채팅방에 자동으로 조인
  private async joinUserChatRooms(client: AuthenticatedSocket) {
    try {
      if (!client.userId) {
        throw new Error('User ID not found');
      }

      const rooms = await this.chatService.getChatRooms({
        user_id: client.userId,
        page: 1,
        limit: 100,
      });

      for (const room of rooms.rooms) {
        await client.join(`room_${room.id}`);
      }

      this.logger.log(
        `User ${client.userInfo?.name} joined ${rooms.rooms.length} chat rooms`,
      );
    } catch (error) {
      this.logger.error(`Error joining user chat rooms: ${error.message}`);
    }
  }

  // 특정 사용자가 온라인인지 확인
  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  // 특정 사용자에게 직접 메시지 전송
  sendToUser(userId: string, event: string, data: any) {
    const userSocket = this.connectedUsers.get(userId);
    if (userSocket) {
      userSocket.emit(event, data);
    }
  }

  // 온라인 사용자 목록 조회
  getOnlineUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }
}
