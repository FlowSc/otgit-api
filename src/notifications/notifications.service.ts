import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '../config/supabase.config';
import { FirebaseService } from '../config/firebase.config';
import * as admin from 'firebase-admin';

export interface PushNotificationData {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  type: NotificationType;
}

export enum NotificationType {
  NEW_MESSAGE = 'new_message',
  NEW_MATCH = 'new_match',
  NEW_LIKE = 'new_like',
  CHAT_MESSAGE = 'chat_message',
  SYSTEM = 'system',
}

export interface NotificationTemplate {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private supabase: SupabaseClient;
  private messaging: admin.messaging.Messaging | null;

  constructor(
    private configService: ConfigService,
    private firebaseService: FirebaseService,
  ) {
    this.supabase = createSupabaseClient(this.configService);
    this.messaging = this.firebaseService.getMessaging();
  }

  // 알림 템플릿 생성
  private getNotificationTemplate(
    type: NotificationType,
    data: any,
  ): NotificationTemplate {
    switch (type) {
      case NotificationType.NEW_MESSAGE:
        return {
          title: '새로운 메시지',
          body: `${data.senderName}님이 메시지를 보냈습니다.`,
          data: {
            type: 'new_message',
            chatRoomId: data.chatRoomId,
            senderId: data.senderId,
          },
        };

      case NotificationType.NEW_MATCH:
        return {
          title: '새로운 매치! 🎉',
          body: `${data.matchedUserName}님과 매치되었습니다!`,
          data: {
            type: 'new_match',
            matchedUserId: data.matchedUserId,
          },
        };

      case NotificationType.NEW_LIKE:
        return {
          title: '누군가 당신을 좋아해요! ❤️',
          body: '새로운 좋아요를 받았습니다.',
          data: {
            type: 'new_like',
            likedBy: data.likedBy,
          },
        };

      case NotificationType.CHAT_MESSAGE:
        return {
          title: data.senderName,
          body: data.message,
          data: {
            type: 'chat_message',
            chatRoomId: data.chatRoomId,
            senderId: data.senderId,
          },
        };

      case NotificationType.SYSTEM:
        return {
          title: data.title || '시스템 알림',
          body: data.body,
          data: {
            type: 'system',
            ...data.customData,
          },
        };

      default:
        return {
          title: '알림',
          body: '새로운 알림이 있습니다.',
          data: { type: 'general' },
        };
    }
  }

  // 사용자의 활성 토큰 조회
  private async getUserTokens(userId: string): Promise<string[]> {
    try {
      const { data: tokens, error } = await this.supabase
        .from('push_tokens')
        .select('token')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        this.logger.error(`Failed to get user tokens for ${userId}:`, error);
        return [];
      }

      return tokens.map((t) => t.token);
    } catch (error) {
      this.logger.error(`Error getting user tokens:`, error);
      return [];
    }
  }

  // 사용자의 알림 설정 조회
  private async getUserNotificationSettings(userId: string): Promise<any> {
    try {
      const { data: settings, error } = await this.supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // 설정이 없으면 기본값 반환
        return {
          new_messages: true,
          new_matches: true,
          new_likes: true,
          chat_messages: true,
          marketing: false,
        };
      }

      return settings;
    } catch (error) {
      this.logger.error(`Error getting notification settings:`, error);
      return {};
    }
  }

  // 알림 설정 확인
  private isNotificationEnabled(
    settings: any,
    type: NotificationType,
  ): boolean {
    switch (type) {
      case NotificationType.NEW_MESSAGE:
        return settings.new_messages !== false;
      case NotificationType.NEW_MATCH:
        return settings.new_matches !== false;
      case NotificationType.NEW_LIKE:
        return settings.new_likes !== false;
      case NotificationType.CHAT_MESSAGE:
        return settings.chat_messages !== false;
      case NotificationType.SYSTEM:
        return true; // 시스템 알림은 항상 전송
      default:
        return true;
    }
  }

  // 알림 히스토리 저장
  private async saveNotificationHistory(
    userId: string,
    template: NotificationTemplate,
    type: NotificationType,
    isSent: boolean,
    errorMessage?: string,
  ): Promise<void> {
    try {
      await this.supabase.from('push_notifications').insert({
        user_id: userId,
        title: template.title,
        body: template.body,
        data: template.data,
        notification_type: type,
        is_sent: isSent,
        sent_at: isSent ? new Date().toISOString() : null,
        error_message: errorMessage,
      });
    } catch (error) {
      this.logger.error(`Failed to save notification history:`, error);
    }
  }

  // 단일 사용자에게 푸시 알림 전송
  async sendPushNotification(
    notificationData: PushNotificationData,
  ): Promise<boolean> {
    try {
      if (!this.messaging) {
        this.logger.warn('Firebase messaging not initialized');
        return false;
      }

      // 사용자 알림 설정 확인
      const settings = await this.getUserNotificationSettings(
        notificationData.userId,
      );
      if (!this.isNotificationEnabled(settings, notificationData.type)) {
        this.logger.log(
          `Notification disabled for user ${notificationData.userId}, type: ${notificationData.type}`,
        );
        return false;
      }

      // 사용자 토큰 조회
      const tokens = await this.getUserTokens(notificationData.userId);
      if (tokens.length === 0) {
        this.logger.warn(
          `No active tokens found for user: ${notificationData.userId}`,
        );
        return false;
      }

      // 알림 템플릿 생성
      const template = this.getNotificationTemplate(
        notificationData.type,
        notificationData.data,
      );

      // FCM 메시지 생성
      const message: admin.messaging.MulticastMessage = {
        tokens: tokens,
        notification: {
          title: template.title,
          body: template.body,
        },
        data: template.data,
        android: {
          notification: {
            sound: 'default',
            priority: 'high',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      // 푸시 알림 전송
      const response = await this.messaging.sendEachForMulticast(message);

      let success = false;
      let errorMessage: string | undefined;

      if (response.successCount > 0) {
        success = true;
        this.logger.log(
          `Push notification sent successfully to ${response.successCount} devices for user: ${notificationData.userId}`,
        );
      }

      if (response.failureCount > 0) {
        const errors = response.responses
          .filter((resp, idx) => !resp.success)
          .map((resp, idx) => `Token ${idx}: ${resp.error?.message}`)
          .join(', ');
        errorMessage = errors;
        this.logger.error(
          `Failed to send to ${response.failureCount} devices: ${errors}`,
        );

        // 만료된 토큰들 비활성화
        await this.handleFailedTokens(tokens, response.responses);
      }

      // 알림 히스토리 저장
      await this.saveNotificationHistory(
        notificationData.userId,
        template,
        notificationData.type,
        success,
        errorMessage,
      );

      return success;
    } catch (error) {
      this.logger.error(`Error sending push notification:`, error);
      return false;
    }
  }

  // 여러 사용자에게 푸시 알림 전송
  async sendBatchPushNotifications(
    notifications: PushNotificationData[],
  ): Promise<number> {
    let successCount = 0;

    for (const notification of notifications) {
      const success = await this.sendPushNotification(notification);
      if (success) successCount++;
    }

    this.logger.log(
      `Batch notification completed: ${successCount}/${notifications.length} sent successfully`,
    );
    return successCount;
  }

  // 실패한 토큰들 처리 (만료된 토큰 비활성화)
  private async handleFailedTokens(
    tokens: string[],
    responses: admin.messaging.SendResponse[],
  ): Promise<void> {
    const failedTokens: string[] = [];

    responses.forEach((response, index) => {
      if (!response.success && response.error) {
        const errorCode = response.error.code;
        // 토큰이 유효하지 않거나 만료된 경우
        if (
          errorCode === 'messaging/invalid-registration-token' ||
          errorCode === 'messaging/registration-token-not-registered'
        ) {
          failedTokens.push(tokens[index]);
        }
      }
    });

    if (failedTokens.length > 0) {
      try {
        await this.supabase
          .from('push_tokens')
          .update({ is_active: false })
          .in('token', failedTokens);

        this.logger.log(`Deactivated ${failedTokens.length} invalid tokens`);
      } catch (error) {
        this.logger.error('Failed to deactivate invalid tokens:', error);
      }
    }
  }

  // 토큰 등록
  async registerToken(
    userId: string,
    token: string,
    deviceType: 'ios' | 'android' | 'web',
    deviceId?: string,
    appVersion?: string,
  ): Promise<boolean> {
    try {
      // 기존 토큰 비활성화 (같은 기기의 이전 토큰)
      if (deviceId) {
        await this.supabase
          .from('push_tokens')
          .update({ is_active: false })
          .eq('user_id', userId)
          .eq('device_id', deviceId);
      }

      // 새 토큰 등록
      const { error } = await this.supabase.from('push_tokens').insert({
        user_id: userId,
        token: token,
        device_type: deviceType,
        device_id: deviceId,
        app_version: appVersion,
        is_active: true,
      });

      if (error) {
        this.logger.error(`Failed to register token:`, error);
        return false;
      }

      this.logger.log(`Token registered successfully for user: ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error registering token:`, error);
      return false;
    }
  }

  // 토큰 비활성화
  async deactivateToken(
    userId: string,
    token?: string,
    deviceId?: string,
  ): Promise<boolean> {
    try {
      let query = this.supabase
        .from('push_tokens')
        .update({ is_active: false })
        .eq('user_id', userId);

      if (token) {
        query = query.eq('token', token);
      } else if (deviceId) {
        query = query.eq('device_id', deviceId);
      }

      const { error } = await query;

      if (error) {
        this.logger.error(`Failed to deactivate token:`, error);
        return false;
      }

      this.logger.log(`Token deactivated successfully for user: ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error deactivating token:`, error);
      return false;
    }
  }
}
