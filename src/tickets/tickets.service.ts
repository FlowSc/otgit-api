import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '../config/supabase.config';
import {
  UseTicketDto,
  PurchaseTicketDto,
  TicketBalanceResponseDto,
  TicketTransactionResponseDto,
  TicketHistoryResponseDto,
  TransactionType,
  TicketType,
} from './dto/ticket.dto';

@Injectable()
export class TicketsService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    this.supabase = createSupabaseClient(this.configService);
  }

  // 사용자 티켓 잔액 조회
  async getTicketBalance(userId: string): Promise<TicketBalanceResponseDto> {
    try {
      // 사용자 티켓 정보 조회
      const { data, error } = await this.supabase
        .from('user_tickets')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new InternalServerErrorException(
          'Failed to fetch ticket balance',
        );
      }

      // 티켓 정보가 없으면 초기화
      if (!data) {
        const newTicketData = await this.initializeUserTickets(userId);
        return {
          user_id: userId,
          free_tickets: newTicketData.free_tickets,
          paid_tickets: newTicketData.paid_tickets,
          total_tickets:
            newTicketData.free_tickets + newTicketData.paid_tickets,
          total_purchased_tickets: newTicketData.total_purchased_tickets,
          last_free_ticket_date: newTicketData.last_free_ticket_date,
          can_get_free_ticket: this.canGetFreeTicketToday(
            newTicketData.last_free_ticket_date,
            newTicketData.free_tickets,
          ),
        };
      }

      return {
        user_id: userId,
        free_tickets: data.free_tickets,
        paid_tickets: data.paid_tickets,
        total_tickets: data.free_tickets + data.paid_tickets,
        total_purchased_tickets: data.total_purchased_tickets,
        last_free_ticket_date: data.last_free_ticket_date,
        can_get_free_ticket: this.canGetFreeTicketToday(
          data.last_free_ticket_date,
          data.free_tickets,
        ),
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      console.error('Get ticket balance error:', error);
      throw new InternalServerErrorException('Failed to get ticket balance');
    }
  }

  // 매일 무료 티켓 1개 지급 (티켓이 0개일 때만)
  async claimFreeTicket(userId: string): Promise<TicketBalanceResponseDto> {
    try {
      // 현재 티켓 정보 조회
      const ticketData = await this.getTicketBalance(userId);

      // 오늘 이미 무료 티켓을 받았는지 확인
      if (!ticketData.can_get_free_ticket) {
        throw new BadRequestException('Free ticket already claimed today');
      }

      // 현재 무료 티켓이 있으면 무료 티켓을 받을 수 없음
      if (ticketData.free_tickets > 0) {
        throw new BadRequestException(
          'Cannot claim free ticket when you already have free tickets',
        );
      }

      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // 무료 티켓 추가 및 날짜 업데이트
      const { data, error } = await this.supabase
        .from('user_tickets')
        .update({
          free_tickets: ticketData.free_tickets + 1,
          last_free_ticket_date: today,
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new InternalServerErrorException('Failed to claim free ticket');
      }

      // 트랜잭션 기록
      await this.recordTransaction(
        userId,
        TransactionType.EARNED_FREE,
        TicketType.FREE,
        1,
        'Daily free ticket',
      );

      return {
        user_id: userId,
        free_tickets: data.free_tickets,
        paid_tickets: data.paid_tickets,
        total_tickets: data.free_tickets + data.paid_tickets,
        total_purchased_tickets: data.total_purchased_tickets,
        last_free_ticket_date: data.last_free_ticket_date,
        can_get_free_ticket: false,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      console.error('Claim free ticket error:', error);
      throw new InternalServerErrorException('Failed to claim free ticket');
    }
  }

  // 티켓 구매
  async purchaseTickets(
    purchaseTicketDto: PurchaseTicketDto,
  ): Promise<TicketBalanceResponseDto> {
    const { user_id, amount, description } = purchaseTicketDto;

    try {
      // 현재 티켓 정보 조회
      const currentBalance = await this.getTicketBalance(user_id);

      // 유료 티켓 추가
      const { data, error } = await this.supabase
        .from('user_tickets')
        .update({
          paid_tickets: currentBalance.paid_tickets + amount,
          total_purchased_tickets:
            currentBalance.total_purchased_tickets + amount,
        })
        .eq('user_id', user_id)
        .select()
        .single();

      if (error) {
        throw new InternalServerErrorException('Failed to purchase tickets');
      }

      // 트랜잭션 기록
      await this.recordTransaction(
        user_id,
        TransactionType.PURCHASED,
        TicketType.PAID,
        amount,
        description || `Purchased ${amount} tickets`,
      );

      return {
        user_id: user_id,
        free_tickets: data.free_tickets,
        paid_tickets: data.paid_tickets,
        total_tickets: data.free_tickets + data.paid_tickets,
        total_purchased_tickets: data.total_purchased_tickets,
        last_free_ticket_date: data.last_free_ticket_date,
        can_get_free_ticket: this.canGetFreeTicketToday(
          data.last_free_ticket_date,
          data.free_tickets,
        ),
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      console.error('Purchase tickets error:', error);
      throw new InternalServerErrorException('Failed to purchase tickets');
    }
  }

  // 티켓 사용 (검색 시 호출)
  async useTicket(
    useTicketDto: UseTicketDto,
  ): Promise<TicketBalanceResponseDto> {
    const { user_id, description, reference_id } = useTicketDto;

    try {
      // 현재 티켓 정보 조회
      const currentBalance = await this.getTicketBalance(user_id);

      // 티켓이 부족한지 확인
      if (currentBalance.total_tickets <= 0) {
        throw new BadRequestException('Insufficient tickets');
      }

      // 무료 티켓을 먼저 사용하고, 없으면 유료 티켓 사용
      let ticketTypeUsed: TicketType;
      let updateData: any;

      if (currentBalance.free_tickets > 0) {
        // 무료 티켓 사용
        ticketTypeUsed = TicketType.FREE;
        updateData = {
          free_tickets: currentBalance.free_tickets - 1,
        };
      } else {
        // 유료 티켓 사용
        ticketTypeUsed = TicketType.PAID;
        updateData = {
          paid_tickets: currentBalance.paid_tickets - 1,
        };
      }

      // 티켓 차감
      const { data, error } = await this.supabase
        .from('user_tickets')
        .update(updateData)
        .eq('user_id', user_id)
        .select()
        .single();

      if (error) {
        throw new InternalServerErrorException('Failed to use ticket');
      }

      // 트랜잭션 기록
      await this.recordTransaction(
        user_id,
        TransactionType.USED,
        ticketTypeUsed,
        -1,
        description || `Used ${ticketTypeUsed} ticket for search`,
        reference_id,
      );

      return {
        user_id: user_id,
        free_tickets: data.free_tickets,
        paid_tickets: data.paid_tickets,
        total_tickets: data.free_tickets + data.paid_tickets,
        total_purchased_tickets: data.total_purchased_tickets,
        last_free_ticket_date: data.last_free_ticket_date,
        can_get_free_ticket: this.canGetFreeTicketToday(
          data.last_free_ticket_date,
          data.free_tickets,
        ),
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      console.error('Use ticket error:', error);
      throw new InternalServerErrorException('Failed to use ticket');
    }
  }

  // 티켓 사용 내역 조회
  async getTicketHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<TicketHistoryResponseDto> {
    try {
      // 전체 개수 조회
      const { count, error: countError } = await this.supabase
        .from('ticket_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (countError) {
        throw new InternalServerErrorException(
          'Failed to get transaction count',
        );
      }

      // 페이지네이션 계산
      const offset = (page - 1) * limit;
      const totalPages = Math.ceil((count || 0) / limit);

      // 트랜잭션 내역 조회
      const { data, error } = await this.supabase
        .from('ticket_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new InternalServerErrorException(
          'Failed to fetch ticket history',
        );
      }

      const transactions: TicketTransactionResponseDto[] = data.map((tx) => ({
        id: tx.id,
        user_id: tx.user_id,
        transaction_type: tx.transaction_type as TransactionType,
        ticket_type: tx.ticket_type as TicketType,
        amount: tx.amount,
        description: tx.description,
        reference_id: tx.reference_id,
        created_at: tx.created_at,
      }));

      return {
        transactions,
        total_count: count || 0,
        current_page: page,
        total_pages: totalPages,
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      console.error('Get ticket history error:', error);
      throw new InternalServerErrorException('Failed to get ticket history');
    }
  }

  // 사용자 티켓 정보 초기화
  private async initializeUserTickets(userId: string) {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await this.supabase
      .from('user_tickets')
      .insert({
        user_id: userId,
        free_tickets: 1, // 기본 무료 티켓 1개 지급
        paid_tickets: 0,
        total_purchased_tickets: 0,
        last_free_ticket_date: today,
      })
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException(
        'Failed to initialize user tickets',
      );
    }

    // 초기 티켓 지급 트랜잭션 기록
    await this.recordTransaction(
      userId,
      TransactionType.EARNED_FREE,
      TicketType.FREE,
      1,
      'Initial free ticket',
    );

    return data;
  }

  // 오늘 무료 티켓을 받을 수 있는지 확인 (무료 티켓이 0개이고 오늘 아직 안받았을 때만)
  private canGetFreeTicketToday(
    lastFreeTicketDate: string | null,
    freeTickets: number,
  ): boolean {
    // 현재 무료 티켓이 있으면 무료 티켓을 받을 수 없음
    if (freeTickets > 0) return false;

    if (!lastFreeTicketDate) return true;

    const today = new Date().toISOString().split('T')[0];
    return lastFreeTicketDate !== today;
  }

  // 트랜잭션 기록
  private async recordTransaction(
    userId: string,
    type: TransactionType,
    ticketType: TicketType,
    amount: number,
    description: string,
    referenceId?: string,
  ): Promise<void> {
    const { error } = await this.supabase.from('ticket_transactions').insert({
      user_id: userId,
      transaction_type: type,
      ticket_type: ticketType,
      amount: amount,
      description: description,
      reference_id: referenceId || null,
    });

    if (error) {
      console.error('Failed to record transaction:', error);
      // 트랜잭션 기록 실패는 주요 기능을 막지 않음
    }
  }

  // 사용자가 충분한 티켓을 가지고 있는지 확인
  async hasEnoughTickets(
    userId: string,
    requiredTickets: number = 1,
  ): Promise<boolean> {
    try {
      const balance = await this.getTicketBalance(userId);
      return balance.total_tickets >= requiredTickets;
    } catch (error) {
      console.error('Check tickets error:', error);
      return false;
    }
  }
}
