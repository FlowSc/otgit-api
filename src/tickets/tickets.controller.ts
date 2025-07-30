import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  ValidationPipe,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TicketsService } from './tickets.service';
import {
  UseTicketDto,
  PurchaseTicketDto,
  TicketBalanceResponseDto,
  TicketHistoryResponseDto,
} from './dto/ticket.dto';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  // 사용자 티켓 잔액 조회
  @Get('balance/:userId')
  async getTicketBalance(
    @Param('userId') userId: string,
  ): Promise<TicketBalanceResponseDto> {
    return this.ticketsService.getTicketBalance(userId);
  }

  // 매일 무료 티켓 1개 지급
  @Post('claim-free/:userId')
  @Throttle({
    short: { limit: 1, ttl: 1000 },
    medium: { limit: 3, ttl: 86400000 },
  }) // 1초에 1번, 하루에 3번
  async claimFreeTicket(
    @Param('userId') userId: string,
  ): Promise<TicketBalanceResponseDto> {
    return this.ticketsService.claimFreeTicket(userId);
  }

  // 티켓 구매
  @Post('purchase')
  @Throttle({
    short: { limit: 1, ttl: 1000 },
    medium: { limit: 10, ttl: 60000 },
  }) // 1초에 1번, 1분에 10번
  async purchaseTickets(
    @Body(ValidationPipe) purchaseTicketDto: PurchaseTicketDto,
  ): Promise<TicketBalanceResponseDto> {
    return this.ticketsService.purchaseTickets(purchaseTicketDto);
  }

  // 티켓 사용 (주로 내부적으로 호출되지만 직접 호출도 가능)
  @Post('use')
  @Throttle({
    short: { limit: 2, ttl: 1000 },
    medium: { limit: 100, ttl: 60000 },
  }) // 1초에 2번, 1분에 100번
  async useTicket(
    @Body(ValidationPipe) useTicketDto: UseTicketDto,
  ): Promise<TicketBalanceResponseDto> {
    return this.ticketsService.useTicket(useTicketDto);
  }

  // 티켓 사용 내역 조회
  @Get('history/:userId')
  async getTicketHistory(
    @Param('userId') userId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
  ): Promise<TicketHistoryResponseDto> {
    return this.ticketsService.getTicketHistory(userId, page, limit);
  }

  // 티켓 보유 여부 확인
  @Get('check/:userId')
  async checkTickets(
    @Param('userId') userId: string,
    @Query('required', new ParseIntPipe({ optional: true }))
    required: number = 1,
  ): Promise<{
    has_enough_tickets: boolean;
    current_tickets: number;
    required_tickets: number;
  }> {
    const hasEnough = await this.ticketsService.hasEnoughTickets(
      userId,
      required,
    );
    const balance = await this.ticketsService.getTicketBalance(userId);

    return {
      has_enough_tickets: hasEnough,
      current_tickets: balance.total_tickets,
      required_tickets: required,
    };
  }
}
