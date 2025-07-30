import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PhotosModule } from './photos/photos.module';
import { LikesModule } from './likes/likes.module';
import { ChatModule } from './chat/chat.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TicketsModule } from './tickets/tickets.module';
import { FirebaseModule } from './config/firebase.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1초
        limit: 3, // 1초에 3번
      },
      {
        name: 'medium',
        ttl: 10000, // 10초
        limit: 20, // 10초에 20번
      },
      {
        name: 'long',
        ttl: 60000, // 1분
        limit: 100, // 1분에 100번
      },
    ]),
    FirebaseModule,
    AuthModule,
    PhotosModule,
    LikesModule,
    ChatModule,
    NotificationsModule,
    TicketsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
