import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  IsIn,
} from 'class-validator';

export class CreateChatRoomDto {
  @IsString()
  @IsNotEmpty()
  user1_id: string;

  @IsString()
  @IsNotEmpty()
  user2_id: string;
}

export class ChatRoomResponseDto {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  other_user?: {
    id: string;
    name: string;
    age: number;
    gender: string;
    profile_photo?: {
      id: string;
      file_url: string;
      file_name: string;
    };
  };
  last_message?: {
    id: string;
    message_text: string;
    sender_id: string;
    created_at: string;
    message_type: string;
  };
  unread_count?: number;
}

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  chat_room_id: string;

  @IsString()
  @IsNotEmpty()
  sender_id: string;

  @IsString()
  @IsNotEmpty()
  message_text: string;

  @IsString()
  @IsOptional()
  @IsIn(['text', 'image', 'system'])
  message_type?: 'text' | 'image' | 'system' = 'text';
}

export class MessageResponseDto {
  id: string;
  chat_room_id: string;
  sender_id: string;
  message_text: string;
  message_type: 'text' | 'image' | 'system';
  is_read: boolean;
  created_at: string;
  updated_at: string;
  sender?: {
    id: string;
    name: string;
    profile_photo?: {
      id: string;
      file_url: string;
      file_name: string;
    };
  };
}

export class GetChatRoomsDto {
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  @Min(1)
  limit?: number = 20;
}

export class GetMessagesDto {
  @IsString()
  @IsNotEmpty()
  chat_room_id: string;

  @IsString()
  @IsNotEmpty()
  user_id: string; // 권한 확인용

  @IsNumber()
  @IsOptional()
  @Min(1)
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  @Min(1)
  limit?: number = 50;
}

export class MarkAsReadDto {
  @IsString()
  @IsNotEmpty()
  chat_room_id: string;

  @IsString()
  @IsNotEmpty()
  user_id: string;

  @IsString()
  @IsOptional()
  message_id?: string; // 특정 메시지까지 읽음 처리
}
