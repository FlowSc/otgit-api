import { Module } from '@nestjs/common';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { LikesModule } from '../likes/likes.module';
import { TicketsModule } from '../tickets/tickets.module';

@Module({
  imports: [LikesModule, TicketsModule],
  controllers: [PhotosController],
  providers: [PhotosService],
})
export class PhotosModule {}
