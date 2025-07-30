import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class RegisterTokenDto {
  @IsNotEmpty()
  @IsString()
  user_id: string;

  @IsNotEmpty()
  @IsString()
  token: string;

  @IsNotEmpty()
  @IsEnum(['ios', 'android', 'web'])
  device_type: 'ios' | 'android' | 'web';

  @IsOptional()
  @IsString()
  device_id?: string;

  @IsOptional()
  @IsString()
  app_version?: string;
}

export class DeactivateTokenDto {
  @IsNotEmpty()
  @IsString()
  user_id: string;

  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsString()
  device_id?: string;
}

export class SendNotificationDto {
  @IsNotEmpty()
  @IsString()
  user_id: string;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  body: string;

  @IsOptional()
  data?: Record<string, any>;

  @IsNotEmpty()
  @IsEnum(['new_message', 'new_match', 'new_like', 'chat_message', 'system'])
  type: 'new_message' | 'new_match' | 'new_like' | 'chat_message' | 'system';
}

export class UpdateNotificationSettingsDto {
  @IsNotEmpty()
  @IsString()
  user_id: string;

  @IsOptional()
  @IsBoolean()
  new_messages?: boolean;

  @IsOptional()
  @IsBoolean()
  new_matches?: boolean;

  @IsOptional()
  @IsBoolean()
  new_likes?: boolean;

  @IsOptional()
  @IsBoolean()
  chat_messages?: boolean;

  @IsOptional()
  @IsBoolean()
  marketing?: boolean;
}

export class NotificationSettingsResponseDto {
  user_id: string;
  new_messages: boolean;
  new_matches: boolean;
  new_likes: boolean;
  chat_messages: boolean;
  marketing: boolean;
  created_at: string;
  updated_at: string;
}

export class PushTokensResponseDto {
  id: string;
  user_id: string;
  token: string;
  device_type: string;
  device_id?: string;
  app_version?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export class NotificationHistoryDto {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data?: any;
  notification_type: string;
  is_sent: boolean;
  sent_at?: string;
  error_message?: string;
  created_at: string;
}
