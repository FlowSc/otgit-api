import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  ValidationPipe,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { NotificationsService } from './notifications.service';
import { createSupabaseClient } from '../config/supabase.config';
import {
  RegisterTokenDto,
  DeactivateTokenDto,
  SendNotificationDto,
  UpdateNotificationSettingsDto,
  NotificationSettingsResponseDto,
  PushTokensResponseDto,
  NotificationHistoryDto,
} from './dto/notifications.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notifications')
export class NotificationsController {
  private supabase;

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {
    this.supabase = createSupabaseClient(this.configService);
  }

  // FCM 토큰 등록
  @Post('register-token')
  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { limit: 2, ttl: 1000 } }) // 1초에 2번만 허용
  async registerToken(
    @Body(ValidationPipe) registerTokenDto: RegisterTokenDto,
    @Request() req: any,
  ) {
    const userId = req.user.userId;
    const success = await this.notificationsService.registerToken(
      userId,
      registerTokenDto.token,
      registerTokenDto.device_type,
      registerTokenDto.device_id,
      registerTokenDto.app_version,
    );

    return {
      success,
      message: success
        ? 'Token registered successfully'
        : 'Failed to register token',
    };
  }

  // FCM 토큰 비활성화
  @Post('deactivate-token')
  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { limit: 3, ttl: 1000 } }) // 1초에 3번만 허용
  async deactivateToken(
    @Body(ValidationPipe) deactivateTokenDto: DeactivateTokenDto,
    @Request() req: any,
  ) {
    const userId = req.user.userId;
    const success = await this.notificationsService.deactivateToken(
      userId,
      deactivateTokenDto.token,
      deactivateTokenDto.device_id,
    );

    return {
      success,
      message: success
        ? 'Token deactivated successfully'
        : 'Failed to deactivate token',
    };
  }

  // 푸시 알림 전송 (테스트용)
  @Post('send')
  @Throttle({ medium: { limit: 10, ttl: 60000 } }) // 1분에 10번만 허용
  async sendNotification(
    @Body(ValidationPipe) sendNotificationDto: SendNotificationDto,
  ) {
    const success = await this.notificationsService.sendPushNotification({
      userId: sendNotificationDto.user_id,
      title: sendNotificationDto.title,
      body: sendNotificationDto.body,
      data: sendNotificationDto.data,
      type: sendNotificationDto.type as any,
    });

    return {
      success,
      message: success
        ? 'Notification sent successfully'
        : 'Failed to send notification',
    };
  }

  // 알림 설정 조회 (본인만)
  @Get('settings')
  @UseGuards(JwtAuthGuard)
  async getNotificationSettings(
    @Request() req: any,
  ): Promise<NotificationSettingsResponseDto> {
    const userId = req.user.userId;
    try {
      const { data: settings, error } = await this.supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching notification settings:', error);
        if (error.code !== 'PGRST116') {
          // PGRST116 = not found
          throw new Error(
            'Failed to fetch notification settings: ' + error.message,
          );
        }
      }

      // 설정이 없으면 기본값으로 생성
      if (!settings) {
        const defaultSettings = {
          user_id: userId,
          new_messages: true,
          new_matches: true,
          new_likes: true,
          chat_messages: true,
          marketing: false,
        };

        const { data: newSettings, error: insertError } = await this.supabase
          .from('notification_settings')
          .insert(defaultSettings)
          .select()
          .single();

        if (insertError) {
          console.error('Error creating default settings:', insertError);
          throw new Error(
            'Failed to create default notification settings: ' +
              insertError.message,
          );
        }

        return newSettings;
      }

      return settings;
    } catch (error) {
      console.error('Caught error in getNotificationSettings:', error);
      throw error;
    }
  }

  // 알림 설정 업데이트
  @Post('settings')
  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { limit: 5, ttl: 1000 } }) // 1초에 5번만 허용
  async updateNotificationSettings(
    @Body(ValidationPipe) updateSettingsDto: UpdateNotificationSettingsDto,
    @Request() req: any,
  ): Promise<NotificationSettingsResponseDto> {
    const userId = req.user.userId;
    const updateData: any = {};
    if (updateSettingsDto.new_messages !== undefined)
      updateData.new_messages = updateSettingsDto.new_messages;
    if (updateSettingsDto.new_matches !== undefined)
      updateData.new_matches = updateSettingsDto.new_matches;
    if (updateSettingsDto.new_likes !== undefined)
      updateData.new_likes = updateSettingsDto.new_likes;
    if (updateSettingsDto.chat_messages !== undefined)
      updateData.chat_messages = updateSettingsDto.chat_messages;
    if (updateSettingsDto.marketing !== undefined)
      updateData.marketing = updateSettingsDto.marketing;

    const { data: settings, error } = await this.supabase
      .from('notification_settings')
      .upsert({
        user_id: userId,
        ...updateData,
      })
      .select()
      .single();

    if (error) {
      throw new Error('Failed to update notification settings');
    }

    return settings;
  }

  // 사용자의 등록된 토큰 목록 조회 (본인만)
  @Get('tokens')
  @UseGuards(JwtAuthGuard)
  async getUserTokens(@Request() req: any): Promise<PushTokensResponseDto[]> {
    const userId = req.user.userId;
    const { data: tokens, error } = await this.supabase
      .from('push_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error('Failed to fetch user tokens');
    }

    return tokens || [];
  }

  // 알림 히스토리 조회 (본인만)
  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getNotificationHistory(
    @Request() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ): Promise<{
    notifications: NotificationHistoryDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const userId = req.user.userId;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    const {
      data: notifications,
      error,
      count,
    } = await this.supabase
      .from('push_notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (error) {
      throw new Error('Failed to fetch notification history');
    }

    return {
      notifications: notifications || [],
      total: count || 0,
      page: pageNum,
      limit: limitNum,
    };
  }

  // 특정 토큰 삭제
  @Delete('tokens/:tokenId')
  async deleteToken(@Param('tokenId') tokenId: string) {
    const { error } = await this.supabase
      .from('push_tokens')
      .update({ is_active: false })
      .eq('id', tokenId);

    if (error) {
      throw new Error('Failed to delete token');
    }

    return {
      success: true,
      message: 'Token deleted successfully',
    };
  }

  // 서버 푸시 알림 상태 확인
  @Get('status')
  async getNotificationStatus() {
    const isFirebaseInitialized =
      this.notificationsService['firebaseConfig'].isInitialized();

    return {
      firebase_initialized: isFirebaseInitialized,
      service_status: 'running',
      timestamp: new Date().toISOString(),
    };
  }
}
