import { Module } from '@nestjs/common';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { LikesModule } from '../likes/likes.module';

@Module({
  imports: [LikesModule],
  controllers: [PhotosController],
  providers: [PhotosService],
})
export class PhotosModule {}