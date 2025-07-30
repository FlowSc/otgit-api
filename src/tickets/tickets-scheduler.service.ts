import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '../config/supabase.config';
import { TransactionType, TicketType } from './dto/ticket.dto';

@Injectable()
export class TicketsSchedulerService {
  private readonly logger = new Logger(TicketsSchedulerService.name);
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    this.supabase = createSupabaseClient(this.configService);
  }

  // 매일 자정에 모든 사용자에게 무료 티켓 1개씩 지급
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async grantDailyFreeTickets() {
    this.logger.log('Starting daily free ticket distribution...');

    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // 오늘 아직 무료 티켓을 받지 않았고 무료 티켓이 0개인 사용자들만 조회
      const { data: eligibleUsers, error: userError } = await this.supabase
        .from('user_tickets')
        .select('user_id, free_tickets, paid_tickets, total_purchased_tickets')
        .or(`last_free_ticket_date.is.null,last_free_ticket_date.neq.${today}`)
        .eq('free_tickets', 0); // 무료 티켓이 0개인 사용자만

      if (userError) {
        this.logger.error('Failed to fetch eligible users:', userError);
        return;
      }

      if (!eligibleUsers || eligibleUsers.length === 0) {
        this.logger.log('No eligible users found for daily free tickets');
        return;
      }

      this.logger.log(
        `Found ${eligibleUsers.length} eligible users (with 0 free tickets) for daily free tickets`,
      );

      // 배치로 업데이트
      const updatePromises = eligibleUsers.map(async (user) => {
        try {
          // 무료 티켓 수 증가 및 날짜 업데이트
          const { error: updateError } = await this.supabase
            .from('user_tickets')
            .update({
              free_tickets: user.free_tickets + 1,
              last_free_ticket_date: today,
            })
            .eq('user_id', user.user_id);

          if (updateError) {
            this.logger.error(
              `Failed to update tickets for user ${user.user_id}:`,
              updateError,
            );
            return;
          }

          // 트랜잭션 기록
          const { error: transactionError } = await this.supabase
            .from('ticket_transactions')
            .insert({
              user_id: user.user_id,
              transaction_type: TransactionType.EARNED_FREE,
              ticket_type: TicketType.FREE,
              amount: 1,
              description: 'Daily free ticket (auto-granted)',
            });

          if (transactionError) {
            this.logger.error(
              `Failed to record transaction for user ${user.user_id}:`,
              transactionError,
            );
          }

          return user.user_id;
        } catch (error) {
          this.logger.error(`Error processing user ${user.user_id}:`, error);
          return null;
        }
      });

      // 모든 업데이트 대기
      const results = await Promise.allSettled(updatePromises);
      const successCount = results.filter(
        (result) => result.status === 'fulfilled' && result.value !== null,
      ).length;

      this.logger.log(
        `Daily free ticket distribution completed. Success: ${successCount}/${eligibleUsers.length}`,
      );
    } catch (error) {
      this.logger.error('Daily free ticket distribution failed:', error);
    }
  }

  // 매주 일요일 자정에 만료된 티켓 정리 (필요시)
  @Cron(CronExpression.EVERY_WEEK)
  async cleanupExpiredTickets() {
    this.logger.log('Starting cleanup of old ticket transactions...');

    try {
      // 6개월 이상 된 트랜잭션 기록 삭제
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { error } = await this.supabase
        .from('ticket_transactions')
        .delete()
        .lt('created_at', sixMonthsAgo.toISOString());

      if (error) {
        this.logger.error('Failed to cleanup old transactions:', error);
        return;
      }

      this.logger.log('Cleanup of old ticket transactions completed');
    } catch (error) {
      this.logger.error('Cleanup failed:', error);
    }
  }

  // 새로 가입한 사용자에게 초기 티켓 지급 (회원가입 시 호출될 메서드)
  async grantInitialTicket(userId: string) {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await this.supabase
        .from('user_tickets')
        .insert({
          user_id: userId,
          free_tickets: 1,
          paid_tickets: 0,
          total_purchased_tickets: 0,
          last_free_ticket_date: today,
        })
        .select()
        .single();

      if (error) {
        this.logger.error(
          `Failed to grant initial ticket to user ${userId}:`,
          error,
        );
        return false;
      }

      // 트랜잭션 기록
      await this.supabase.from('ticket_transactions').insert({
        user_id: userId,
        transaction_type: TransactionType.EARNED_FREE,
        ticket_type: TicketType.FREE,
        amount: 1,
        description: 'Welcome ticket for new user',
      });

      this.logger.log(`Initial ticket granted to user ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Error granting initial ticket to user ${userId}:`,
        error,
      );
      return false;
    }
  }

  // 통계 및 모니터링용 메서드
  async getTicketStatistics() {
    try {
      // 전체 사용자 수
      const { count: totalUsers } = await this.supabase
        .from('user_tickets')
        .select('*', { count: 'exact', head: true });

      // 오늘 무료 티켓을 받은 사용자 수
      const today = new Date().toISOString().split('T')[0];
      const { count: todayRecipients } = await this.supabase
        .from('user_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('last_free_ticket_date', today);

      // 총 보유 티켓 수
      const { data: totalTicketsData } = await this.supabase
        .from('user_tickets')
        .select('free_tickets.sum(), paid_tickets.sum()');

      const totalFreeTickets = totalTicketsData?.[0]?.sum || 0;
      const totalPaidTickets = totalTicketsData?.[0]?.sum || 0;
      const totalTickets = totalFreeTickets + totalPaidTickets;

      return {
        total_users: totalUsers || 0,
        today_recipients: todayRecipients || 0,
        total_tickets_in_circulation: totalTickets,
      };
    } catch (error) {
      this.logger.error('Failed to get ticket statistics:', error);
      return null;
    }
  }
}
