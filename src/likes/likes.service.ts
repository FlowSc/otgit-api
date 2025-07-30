import { Injectable, BadRequestException, InternalServerErrorException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '../config/supabase.config';
import { SendLikeDto, LikeResponseDto, GetLikesDto, LikesListResponseDto, LikeWithUserDto, MatchResponseDto, GetMatchesDto, AcceptLikeDto, AcceptLikeResponseDto } from './dto/like.dto';
import { ChatService } from '../chat/chat.service';
import { NotificationsService, NotificationType } from '../notifications/notifications.service';

@Injectable()
export class LikesService {
  private supabase: SupabaseClient;

  constructor(
    private configService: ConfigService,
    private chatService: ChatService,
    private notificationsService: NotificationsService,
  ) {
    this.supabase = createSupabaseClient(this.configService);
  }

  async sendLike(sendLikeDto: SendLikeDto): Promise<LikeResponseDto> {
    const { sender_id, receiver_id } = sendLikeDto;

    try {
      // 자기 자신에게 좋아요 방지
      if (sender_id === receiver_id) {
        throw new BadRequestException('Cannot like yourself');
      }

      // 수신자 존재 확인
      const { data: receiverExists, error: receiverError } = await this.supabase
        .from('users')
        .select('id')
        .eq('id', receiver_id)
        .single();

      if (receiverError || !receiverExists) {
        throw new BadRequestException('Receiver not found');
      }

      // 좋아요 생성 (중복 방지는 UNIQUE 제약으로 처리)
      const { data: like, error: likeError } = await this.supabase
        .from('likes')
        .insert([{ sender_id, receiver_id }])
        .select()
        .single();

      if (likeError) {
        if (likeError.code === '23505') { // UNIQUE 제약 위반
          throw new ConflictException('Already liked this user');
        }
        throw new InternalServerErrorException('Failed to send like');
      }

      // 상호 좋아요 확인 (매칭 체크)
      const { data: mutualLike } = await this.supabase
        .from('likes')
        .select('id')
        .eq('sender_id', receiver_id)
        .eq('receiver_id', sender_id)
        .single();

      let isMatch = false;
      
      if (mutualLike) {
        // 매칭 생성 (user1_id < user2_id 규칙 적용)
        const [user1_id, user2_id] = sender_id < receiver_id ? [sender_id, receiver_id] : [receiver_id, sender_id];
        
        const { error: matchError } = await this.supabase
          .from('matches')
          .insert([{ user1_id, user2_id }]);

        if (!matchError) {
          isMatch = true;
          
          // 매칭 성공 시 양쪽 사용자에게 알림 전송
          try {
            // 발신자 정보 조회
            const { data: sender } = await this.supabase
              .from('users')
              .select('name')
              .eq('id', sender_id)
              .single();

            // 수신자 정보 조회  
            const { data: receiver } = await this.supabase
              .from('users')
              .select('name')
              .eq('id', receiver_id)
              .single();

            // 발신자에게 매칭 알림
            await this.notificationsService.sendPushNotification({
              userId: sender_id,
              title: '새로운 매치! 🎉',
              body: `${receiver?.name || 'Unknown'}님과 매치되었습니다!`,
              data: {
                matchedUserName: receiver?.name || 'Unknown',
                matchedUserId: receiver_id,
              },
              type: NotificationType.NEW_MATCH,
            });

            // 수신자에게 매칭 알림
            await this.notificationsService.sendPushNotification({
              userId: receiver_id,
              title: '새로운 매치! 🎉',
              body: `${sender?.name || 'Unknown'}님과 매치되었습니다!`,
              data: {
                matchedUserName: sender?.name || 'Unknown',
                matchedUserId: sender_id,
              },
              type: NotificationType.NEW_MATCH,
            });
          } catch (notificationError) {
            console.error('Failed to send match notifications:', notificationError);
          }
        }
      } else {
        // 단순 좋아요인 경우 수신자에게만 알림
        try {
          // 발신자 정보 조회
          const { data: sender } = await this.supabase
            .from('users')
            .select('name')
            .eq('id', sender_id)
            .single();

          await this.notificationsService.sendPushNotification({
            userId: receiver_id,
            title: '누군가 당신을 좋아해요! ❤️',
            body: '새로운 좋아요를 받았습니다.',
            data: {
              likedBy: sender?.name || 'Unknown',
            },
            type: NotificationType.NEW_LIKE,
          });
        } catch (notificationError) {
          console.error('Failed to send like notification:', notificationError);
        }
      }

      return {
        id: like.id,
        sender_id: like.sender_id,
        receiver_id: like.receiver_id,
        created_at: like.created_at,
        status: 'pending',
        is_match: isMatch,
      };

    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ConflictException || error instanceof InternalServerErrorException) {
        throw error;
      }
      console.error('Send like error:', error);
      throw new InternalServerErrorException('Failed to send like');
    }
  }

  async getLikes(getLikesDto: GetLikesDto): Promise<LikesListResponseDto> {
    const { user_id, type = 'received', page = 1, limit = 20 } = getLikesDto;
    const offset = (page - 1) * limit;

    try {
      let query;
      
      if (type === 'sent') {
        // 보낸 좋아요
        query = this.supabase
          .from('likes')
          .select(`
            id,
            sender_id,
            receiver_id,
            created_at,
            status,
            responded_at,
            users!likes_receiver_id_fkey(id, name, age, gender)
          `, { count: 'exact' })
          .eq('sender_id', user_id);
      } else {
        // 받은 좋아요
        query = this.supabase
          .from('likes')
          .select(`
            id,
            sender_id,
            receiver_id,
            created_at,
            status,
            responded_at,
            users!likes_sender_id_fkey(id, name, age, gender)
          `, { count: 'exact' })
          .eq('receiver_id', user_id);
      }

      const { data: likes, error: likesError, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (likesError) {
        throw new InternalServerErrorException('Failed to fetch likes');
      }

      // 프로필 사진 조회
      const userIds = likes?.map(like => 
        type === 'sent' ? like.receiver_id : like.sender_id
      ) || [];

      const profilePhotosMap = new Map();
      if (userIds.length > 0) {
        const { data: profilePhotos } = await this.supabase
          .from('profile_photos')
          .select('user_id, id, file_url, file_name')
          .in('user_id', userIds)
          .eq('is_active', true);

        for (const photo of profilePhotos || []) {
          profilePhotosMap.set(photo.user_id, photo);
        }
      }

      // 매칭 상태 확인
      const matchesMap = new Map();
      if (userIds.length > 0) {
        const matchQueries = userIds.map(async (otherId) => {
          const [user1_id, user2_id] = user_id < otherId ? [user_id, otherId] : [otherId, user_id];
          const { data } = await this.supabase
            .from('matches')
            .select('id')
            .eq('user1_id', user1_id)
            .eq('user2_id', user2_id)
            .eq('is_active', true)
            .single();
          
          if (data) {
            matchesMap.set(otherId, true);
          }
        });

        await Promise.all(matchQueries);
      }

      const likesWithUser: LikeWithUserDto[] = (likes || []).map(like => {
        const targetUser = like.users;
        const targetUserId = type === 'sent' ? like.receiver_id : like.sender_id;
        const profilePhoto = profilePhotosMap.get(targetUserId);

        return {
          id: like.id,
          sender_id: like.sender_id,
          receiver_id: like.receiver_id,
          created_at: like.created_at,
          status: like.status,
          responded_at: like.responded_at,
          user: {
            id: targetUser.id,
            name: targetUser.name,
            age: targetUser.age,
            gender: targetUser.gender,
            profile_photo: profilePhoto ? {
              id: profilePhoto.id,
              file_url: profilePhoto.file_url,
              file_name: profilePhoto.file_name,
            } : undefined,
          },
          is_match: matchesMap.get(targetUserId) || false,
        };
      });

      return {
        likes: likesWithUser,
        total: count || 0,
        page,
        limit,
        type,
      };

    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      console.error('Get likes error:', error);
      throw new InternalServerErrorException('Failed to get likes');
    }
  }

  async getMatches(getMatchesDto: GetMatchesDto): Promise<{ matches: any[], total: number, page: number, limit: number }> {
    const { user_id, page = 1, limit = 20, active_only = true } = getMatchesDto;
    const offset = (page - 1) * limit;

    try {
      let query = this.supabase
        .from('matches')
        .select(`
          id,
          user1_id,
          user2_id,
          matched_at,
          is_active
        `, { count: 'exact' });

      // 해당 사용자가 포함된 매칭만 조회
      query = query.or(`user1_id.eq.${user_id},user2_id.eq.${user_id}`);

      if (active_only) {
        query = query.eq('is_active', true);
      }

      const { data: matches, error: matchesError, count } = await query
        .order('matched_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (matchesError) {
        throw new InternalServerErrorException('Failed to fetch matches');
      }

      // 상대방 사용자 정보 조회
      const otherUserIds = (matches || []).map(match => 
        match.user1_id === user_id ? match.user2_id : match.user1_id
      );

      const usersMap = new Map();
      const profilePhotosMap = new Map();

      if (otherUserIds.length > 0) {
        // 사용자 정보 조회
        const { data: users } = await this.supabase
          .from('users')
          .select('id, name, age, gender')
          .in('id', otherUserIds);

        for (const user of users || []) {
          usersMap.set(user.id, user);
        }

        // 프로필 사진 조회
        const { data: profilePhotos } = await this.supabase
          .from('profile_photos')
          .select('user_id, id, file_url, file_name')
          .in('user_id', otherUserIds)
          .eq('is_active', true);

        for (const photo of profilePhotos || []) {
          profilePhotosMap.set(photo.user_id, photo);
        }
      }

      const matchesWithUser = (matches || []).map(match => {
        const otherUserId = match.user1_id === user_id ? match.user2_id : match.user1_id;
        const otherUser = usersMap.get(otherUserId);
        const profilePhoto = profilePhotosMap.get(otherUserId);

        return {
          id: match.id,
          user1_id: match.user1_id,
          user2_id: match.user2_id,
          matched_at: match.matched_at,
          is_active: match.is_active,
          other_user: otherUser ? {
            id: otherUser.id,
            name: otherUser.name,
            age: otherUser.age,
            gender: otherUser.gender,
            profile_photo: profilePhoto ? {
              id: profilePhoto.id,
              file_url: profilePhoto.file_url,
              file_name: profilePhoto.file_name,
            } : undefined,
          } : null,
        };
      });

      return {
        matches: matchesWithUser,
        total: count || 0,
        page,
        limit,
      };

    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      console.error('Get matches error:', error);
      throw new InternalServerErrorException('Failed to get matches');
    }
  }

  // 검색된 사용자 기록
  async markUserAsSeen(searcherId: string, seenUserId: string): Promise<void> {
    try {
      if (searcherId === seenUserId) {
        return; // 자기 자신은 기록하지 않음
      }

      // UPSERT 방식으로 seen_users 테이블 업데이트
      const { error } = await this.supabase
        .from('seen_users')
        .upsert([{
          searcher_id: searcherId,
          seen_user_id: seenUserId,
          last_seen_at: new Date().toISOString(),
          seen_count: 1
        }], {
          onConflict: 'searcher_id,seen_user_id',
          ignoreDuplicates: false
        });

      if (error) {
        // seen_count 증가를 위한 별도 업데이트
        await this.supabase
          .from('seen_users')
          .update({
            last_seen_at: new Date().toISOString(),
            seen_count: this.supabase.rpc('increment_seen_count', { 
              searcher_id: searcherId, 
              seen_user_id: seenUserId 
            })
          })
          .eq('searcher_id', searcherId)
          .eq('seen_user_id', seenUserId);
      }

    } catch (error) {
      // 에러가 발생해도 메인 로직에 영향을 주지 않도록 로그만 기록
      console.error('Mark user as seen error:', error);
    }
  }

  // 이미 본 사용자들 ID 목록 조회
  async getSeenUserIds(searcherId: string): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('seen_users')
        .select('seen_user_id')
        .eq('searcher_id', searcherId);

      if (error) {
        console.error('Get seen users error:', error);
        return [];
      }

      return (data || []).map(row => row.seen_user_id);
    } catch (error) {
      console.error('Get seen users error:', error);
      return [];
    }
  }

  // 좋아요 승락
  async acceptLike(acceptLikeDto: AcceptLikeDto): Promise<AcceptLikeResponseDto> {
    const { like_id, user_id } = acceptLikeDto;

    try {
      // 좋아요 조회 및 권한 확인
      const { data: like, error: likeError } = await this.supabase
        .from('likes')
        .select('*')
        .eq('id', like_id)
        .single();

      if (likeError || !like) {
        throw new BadRequestException('Like not found');
      }

      // 받은 사용자가 맞는지 확인
      if (like.receiver_id !== user_id) {
        throw new BadRequestException('You can only accept likes sent to you');
      }

      // 이미 응답한 좋아요인지 확인
      if (like.status !== 'pending') {
        throw new BadRequestException(`Like already ${like.status}`);
      }

      // 좋아요 상태를 accepted로 업데이트
      const { data: updatedLike, error: updateError } = await this.supabase
        .from('likes')
        .update({
          status: 'accepted',
          responded_at: new Date().toISOString(),
        })
        .eq('id', like_id)
        .select()
        .single();

      if (updateError) {
        throw new InternalServerErrorException('Failed to accept like');
      }

      // 채팅방 생성
      const chatRoom = await this.chatService.createChatRoom({
        user1_id: like.sender_id,
        user2_id: like.receiver_id,
      });

      // 매칭 생성 (user1_id < user2_id 규칙 적용)
      const [user1_id, user2_id] = like.sender_id < like.receiver_id 
        ? [like.sender_id, like.receiver_id] 
        : [like.receiver_id, like.sender_id];
      
      const { error: matchError } = await this.supabase
        .from('matches')
        .upsert([{ user1_id, user2_id }], {
          onConflict: 'user1_id,user2_id',
          ignoreDuplicates: true
        });

      if (matchError) {
        console.error('Failed to create match:', matchError);
      }

      return {
        like: {
          id: updatedLike.id,
          sender_id: updatedLike.sender_id,
          receiver_id: updatedLike.receiver_id,
          created_at: updatedLike.created_at,
          status: updatedLike.status,
          responded_at: updatedLike.responded_at,
        },
        chat_room: {
          id: chatRoom.id,
          user1_id: chatRoom.user1_id,
          user2_id: chatRoom.user2_id,
          created_at: chatRoom.created_at,
        },
        message: 'Like accepted successfully! Chat room created.',
      };

    } catch (error) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
      console.error('Accept like error:', error);
      throw new InternalServerErrorException('Failed to accept like');
    }
  }
}