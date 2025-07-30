import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TicketsModule } from '../tickets/tickets.module';

@Module({
  imports: [ConfigModule, TicketsModule],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
