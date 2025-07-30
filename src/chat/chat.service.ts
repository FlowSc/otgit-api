import { Injectable, BadRequestException, InternalServerErrorException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '../config/supabase.config';
import { NotificationsService, NotificationType } from '../notifications/notifications.service';
import { 
  CreateChatRoomDto, 
  ChatRoomResponseDto, 
  SendMessageDto, 
  MessageResponseDto, 
  GetChatRoomsDto, 
  GetMessagesDto, 
  MarkAsReadDto 
} from './dto/chat.dto';

@Injectable()
export class ChatService {
  private supabase: SupabaseClient;

  constructor(
    private configService: ConfigService,
    private notificationsService: NotificationsService,
  ) {
    this.supabase = createSupabaseClient(this.configService);
  }

  async createChatRoom(createChatRoomDto: CreateChatRoomDto): Promise<ChatRoomResponseDto> {
    let { user1_id, user2_id } = createChatRoomDto;

    try {
      // 자기 자신과 채팅방 생성 방지
      if (user1_id === user2_id) {
        throw new BadRequestException('Cannot create chat room with yourself');
      }

      // user1_id < user2_id 규칙 적용
      if (user1_id > user2_id) {
        [user1_id, user2_id] = [user2_id, user1_id];
      }

      // 기존 채팅방 확인
      const { data: existingRoom, error: existingRoomError } = await this.supabase
        .from('chat_rooms')
        .select('*')
        .eq('user1_id', user1_id)
        .eq('user2_id', user2_id)
        .single();

      if (existingRoom) {
        return {
          id: existingRoom.id,
          user1_id: existingRoom.user1_id,
          user2_id: existingRoom.user2_id,
          created_at: existingRoom.created_at,
          updated_at: existingRoom.updated_at,
          is_active: existingRoom.is_active,
        };
      }

      // 새 채팅방 생성
      const { data: chatRoom, error: chatRoomError } = await this.supabase
        .from('chat_rooms')
        .insert([{ user1_id, user2_id }])
        .select()
        .single();

      if (chatRoomError) {
        throw new InternalServerErrorException('Failed to create chat room');
      }

      // 참여자 정보 생성
      const participants = [
        { chat_room_id: chatRoom.id, user_id: user1_id },
        { chat_room_id: chatRoom.id, user_id: user2_id }
      ];

      const { error: participantsError } = await this.supabase
        .from('chat_participants')
        .insert(participants);

      if (participantsError) {
        console.error('Failed to create participants:', participantsError);
      }

      return {
        id: chatRoom.id,
        user1_id: chatRoom.user1_id,
        user2_id: chatRoom.user2_id,
        created_at: chatRoom.created_at,
        updated_at: chatRoom.updated_at,
        is_active: chatRoom.is_active,
      };

    } catch (error) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
      console.error('Create chat room error:', error);
      throw new InternalServerErrorException('Failed to create chat room');
    }
  }

  async getChatRooms(getChatRoomsDto: GetChatRoomsDto): Promise<{ rooms: ChatRoomResponseDto[], total: number, page: number, limit: number }> {
    const { user_id, page = 1, limit = 20 } = getChatRoomsDto;
    const offset = (page - 1) * limit;

    try {
      // 사용자가 참여한 채팅방 조회
      const { data: chatRooms, error: roomsError, count } = await this.supabase
        .from('chat_rooms')
        .select('*', { count: 'exact' })
        .or(`user1_id.eq.${user_id},user2_id.eq.${user_id}`)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (roomsError) {
        throw new InternalServerErrorException('Failed to fetch chat rooms');
      }

      const roomsWithDetails: ChatRoomResponseDto[] = [];

      for (const room of chatRooms || []) {
        // 상대방 사용자 정보 조회
        const otherUserId = room.user1_id === user_id ? room.user2_id : room.user1_id;
        
        const { data: otherUser } = await this.supabase
          .from('users')
          .select('id, name, age, gender')
          .eq('id', otherUserId)
          .single();

        // 상대방 프로필 사진 조회
        const { data: profilePhoto } = await this.supabase
          .from('profile_photos')
          .select('id, file_url, file_name')
          .eq('user_id', otherUserId)
          .eq('is_active', true)
          .single();

        // 마지막 메시지 조회
        const { data: lastMessage } = await this.supabase
          .from('chat_messages')
          .select('id, message_text, sender_id, created_at, message_type')
          .eq('chat_room_id', room.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // 읽지 않은 메시지 수 조회
        const { data: participant } = await this.supabase
          .from('chat_participants')
          .select('last_read_message_id')
          .eq('chat_room_id', room.id)
          .eq('user_id', user_id)
          .single();

        let unreadCount = 0;
        if (participant && participant.last_read_message_id) {
          const { count: unreadCountResult } = await this.supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('chat_room_id', room.id)
            .neq('sender_id', user_id)
            .gt('created_at', 
              (await this.supabase
                .from('chat_messages')
                .select('created_at')
                .eq('id', participant.last_read_message_id)
                .single()
              ).data?.created_at || '1970-01-01'
            );
          
          unreadCount = unreadCountResult || 0;
        } else {
          // 읽은 메시지가 없는 경우 모든 메시지 개수
          const { count: totalCount } = await this.supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('chat_room_id', room.id)
            .neq('sender_id', user_id);
          
          unreadCount = totalCount || 0;
        }

        roomsWithDetails.push({
          id: room.id,
          user1_id: room.user1_id,
          user2_id: room.user2_id,
          created_at: room.created_at,
          updated_at: room.updated_at,
          is_active: room.is_active,
          other_user: otherUser ? {
            id: otherUser.id,
            name: otherUser.name,
            age: otherUser.age,
            gender: otherUser.gender,
            profile_photo: profilePhoto ? {
              id: profilePhoto.id,
              file_url: profilePhoto.file_url,
              file_name: profilePhoto.file_name,
            } : undefined,
          } : undefined,
          last_message: lastMessage || undefined,
          unread_count: unreadCount,
        });
      }

      return {
        rooms: roomsWithDetails,
        total: count || 0,
        page,
        limit,
      };

    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      console.error('Get chat rooms error:', error);
      throw new InternalServerErrorException('Failed to get chat rooms');
    }
  }

  async sendMessage(sendMessageDto: SendMessageDto): Promise<MessageResponseDto> {
    const { chat_room_id, sender_id, message_text, message_type = 'text' } = sendMessageDto;

    try {
      // 채팅방 존재 및 권한 확인
      const { data: chatRoom, error: roomError } = await this.supabase
        .from('chat_rooms')
        .select('*')
        .eq('id', chat_room_id)
        .single();

      if (roomError || !chatRoom) {
        throw new NotFoundException('Chat room not found');
      }

      // 발신자가 채팅방 참여자인지 확인
      if (chatRoom.user1_id !== sender_id && chatRoom.user2_id !== sender_id) {
        throw new ForbiddenException('You are not a participant of this chat room');
      }

      // 메시지 생성
      const { data: message, error: messageError } = await this.supabase
        .from('chat_messages')
        .insert([{
          chat_room_id,
          sender_id,
          message_text,
          message_type,
        }])
        .select()
        .single();

      if (messageError) {
        throw new InternalServerErrorException('Failed to send message');
      }

      // 채팅방 updated_at 업데이트
      await this.supabase
        .from('chat_rooms')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', chat_room_id);

      // 발신자 정보 조회
      const { data: sender } = await this.supabase
        .from('users')
        .select('id, name')
        .eq('id', sender_id)
        .single();

      // 발신자 프로필 사진 조회
      const { data: senderPhoto } = await this.supabase
        .from('profile_photos')
        .select('id, file_url, file_name')
        .eq('user_id', sender_id)
        .eq('is_active', true)
        .single();

      // 상대방에게 푸시 알림 전송
      const recipientId = chatRoom.user1_id === sender_id ? chatRoom.user2_id : chatRoom.user1_id;
      try {
        await this.notificationsService.sendPushNotification({
          userId: recipientId,
          title: sender?.name || '새 메시지',
          body: message_text.length > 50 ? message_text.substring(0, 50) + '...' : message_text,
          data: {
            senderName: sender?.name || 'Unknown',
            chatRoomId: chat_room_id,
            senderId: sender_id,
          },
          type: NotificationType.CHAT_MESSAGE,
        });
      } catch (notificationError) {
        console.error('Failed to send push notification:', notificationError);
        // 알림 실패는 메시지 전송을 막지 않음
      }

      return {
        id: message.id,
        chat_room_id: message.chat_room_id,
        sender_id: message.sender_id,
        message_text: message.message_text,
        message_type: message.message_type,
        is_read: message.is_read,
        created_at: message.created_at,
        updated_at: message.updated_at,
        sender: sender ? {
          id: sender.id,
          name: sender.name,
          profile_photo: senderPhoto ? {
            id: senderPhoto.id,
            file_url: senderPhoto.file_url,
            file_name: senderPhoto.file_name,
          } : undefined,
        } : undefined,
      };

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof InternalServerErrorException) {
        throw error;
      }
      console.error('Send message error:', error);
      throw new InternalServerErrorException('Failed to send message');
    }
  }

  async getMessages(getMessagesDto: GetMessagesDto): Promise<{ messages: MessageResponseDto[], total: number, page: number, limit: number }> {
    const { chat_room_id, user_id, page = 1, limit = 50 } = getMessagesDto;
    const offset = (page - 1) * limit;

    try {
      // 채팅방 존재 및 권한 확인
      const { data: chatRoom, error: roomError } = await this.supabase
        .from('chat_rooms')
        .select('*')
        .eq('id', chat_room_id)
        .single();

      if (roomError || !chatRoom) {
        throw new NotFoundException('Chat room not found');
      }

      // 사용자가 채팅방 참여자인지 확인
      if (chatRoom.user1_id !== user_id && chatRoom.user2_id !== user_id) {
        throw new ForbiddenException('You are not a participant of this chat room');
      }

      // 메시지 조회
      const { data: messages, error: messagesError, count } = await this.supabase
        .from('chat_messages')
        .select('*', { count: 'exact' })
        .eq('chat_room_id', chat_room_id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (messagesError) {
        throw new InternalServerErrorException('Failed to fetch messages');
      }

      // 발신자 정보 조회
      const senderIds = [...new Set((messages || []).map(msg => msg.sender_id))];
      const sendersMap = new Map();
      const senderPhotosMap = new Map();

      if (senderIds.length > 0) {
        const { data: senders } = await this.supabase
          .from('users')
          .select('id, name')
          .in('id', senderIds);

        for (const sender of senders || []) {
          sendersMap.set(sender.id, sender);
        }

        const { data: senderPhotos } = await this.supabase
          .from('profile_photos')
          .select('user_id, id, file_url, file_name')
          .in('user_id', senderIds)
          .eq('is_active', true);

        for (const photo of senderPhotos || []) {
          senderPhotosMap.set(photo.user_id, photo);
        }
      }

      const messagesWithSender: MessageResponseDto[] = (messages || []).map(message => {
        const sender = sendersMap.get(message.sender_id);
        const senderPhoto = senderPhotosMap.get(message.sender_id);

        return {
          id: message.id,
          chat_room_id: message.chat_room_id,
          sender_id: message.sender_id,
          message_text: message.message_text,
          message_type: message.message_type,
          is_read: message.is_read,
          created_at: message.created_at,
          updated_at: message.updated_at,
          sender: sender ? {
            id: sender.id,
            name: sender.name,
            profile_photo: senderPhoto ? {
              id: senderPhoto.id,
              file_url: senderPhoto.file_url,
              file_name: senderPhoto.file_name,
            } : undefined,
          } : undefined,
        };
      });

      return {
        messages: messagesWithSender,
        total: count || 0,
        page,
        limit,
      };

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof InternalServerErrorException) {
        throw error;
      }
      console.error('Get messages error:', error);
      throw new InternalServerErrorException('Failed to get messages');
    }
  }

  async markAsRead(markAsReadDto: MarkAsReadDto): Promise<{ message: string }> {
    const { chat_room_id, user_id, message_id } = markAsReadDto;

    try {
      // 채팅방 존재 및 권한 확인
      const { data: chatRoom, error: roomError } = await this.supabase
        .from('chat_rooms')
        .select('*')
        .eq('id', chat_room_id)
        .single();

      if (roomError || !chatRoom) {
        throw new NotFoundException('Chat room not found');
      }

      // 사용자가 채팅방 참여자인지 확인
      if (chatRoom.user1_id !== user_id && chatRoom.user2_id !== user_id) {
        throw new ForbiddenException('You are not a participant of this chat room');
      }

      let targetMessageId = message_id;

      // 특정 메시지 ID가 없으면 가장 최근 메시지 사용
      if (!targetMessageId) {
        const { data: lastMessage } = await this.supabase
          .from('chat_messages')
          .select('id')
          .eq('chat_room_id', chat_room_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (lastMessage) {
          targetMessageId = lastMessage.id;
        }
      }

      if (targetMessageId) {
        // 참여자의 마지막 읽은 메시지 업데이트
        const { error: updateError } = await this.supabase
          .from('chat_participants')
          .update({
            last_read_message_id: targetMessageId,
            last_read_at: new Date().toISOString(),
          })
          .eq('chat_room_id', chat_room_id)
          .eq('user_id', user_id);

        if (updateError) {
          throw new InternalServerErrorException('Failed to mark messages as read');
        }
      }

      return { message: 'Messages marked as read successfully' };

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof InternalServerErrorException) {
        throw error;
      }
      console.error('Mark as read error:', error);
      throw new InternalServerErrorException('Failed to mark messages as read');
    }
  }
}