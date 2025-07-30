import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TicketsModule } from '../tickets/tickets.module';
import { NCPSMSService } from '../config/ncp-sms.config';

@Module({
  imports: [ConfigModule, TicketsModule],
  providers: [AuthService, NCPSMSService],
  controllers: [AuthController],
})
export class AuthModule {}
