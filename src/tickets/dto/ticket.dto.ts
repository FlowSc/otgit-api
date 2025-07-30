import {
  IsInt,
  IsOptional,
  IsEnum,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export enum TransactionType {
  EARNED_FREE = 'earned_free',
  PURCHASED = 'purchased',
  USED = 'used',
  EXPIRED = 'expired',
}

export enum TicketType {
  FREE = 'free',
  PAID = 'paid',
}

export class UseTicketDto {
  @IsUUID()
  user_id: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  reference_id?: string; // 검색 ID 등
}

export class PurchaseTicketDto {
  @IsUUID()
  user_id: string;

  @IsInt()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class TicketBalanceResponseDto {
  user_id: string;
  free_tickets: number;
  paid_tickets: number;
  total_tickets: number; // free_tickets + paid_tickets
  total_purchased_tickets: number;
  last_free_ticket_date: string | null;
  can_get_free_ticket: boolean;
}

export class TicketTransactionResponseDto {
  id: string;
  user_id: string;
  transaction_type: TransactionType;
  ticket_type: TicketType;
  amount: number;
  description: string | null;
  reference_id: string | null;
  created_at: string;
}

export class TicketHistoryResponseDto {
  transactions: TicketTransactionResponseDto[];
  total_count: number;
  current_page: number;
  total_pages: number;
}
