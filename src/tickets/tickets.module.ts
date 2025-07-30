import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { TicketsSchedulerService } from './tickets-scheduler.service';

@Module({
  imports: [ConfigModule, ScheduleModule.forRoot()],
  controllers: [TicketsController],
  providers: [TicketsService, TicketsSchedulerService],
  exports: [TicketsService, TicketsSchedulerService], // 다른 모듈에서 사용할 수 있도록 export
})
export class TicketsModule {}
