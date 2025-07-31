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
  UploadProfilePhotoDto,
  ProfilePhotoResponseDto,
} from './dto/profile-photo.dto';
import {
  UploadTravelPhotoDto,
  UpdateTravelPhotoDto,
  QueryTravelPhotosDto,
  TravelPhotoResponseDto,
} from './dto/travel-photo.dto';
import {
  FindNearbyUsersDto,
  FindNearbyUsersResponseDto,
  NearbyUserDto,
  NearbyUserPhotoDto,
} from './dto/nearby-users.dto';
import { LikesService } from '../likes/likes.service';
import { TicketsService } from '../tickets/tickets.service';

@Injectable()
export class PhotosService {
  private supabase: SupabaseClient;

  constructor(
    private configService: ConfigService,
    private likesService: LikesService,
    private ticketsService: TicketsService,
  ) {
    this.supabase = createSupabaseClient(this.configService);
  }

  // Profile Photo Methods
  async uploadProfilePhoto(
    userId: string,
    uploadDto: UploadProfilePhotoDto,
    file: Express.Multer.File,
  ): Promise<ProfilePhotoResponseDto> {
    try {
      // Validate file
      if (!file) {
        throw new BadRequestException('No file provided');
      }

      // Validate image type
      if (!file.mimetype.startsWith('image/')) {
        throw new BadRequestException('File must be an image');
      }

      // Upload file to Supabase Storage (profile-photos bucket)
      const fileName = `${userId}/${Date.now()}-${file.originalname}`;
      const { data: uploadData, error: uploadError } =
        await this.supabase.storage
          .from('profile-photos')
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
          });

      if (uploadError) {
        throw new InternalServerErrorException(
          'Failed to upload file to storage',
        );
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = this.supabase.storage.from('profile-photos').getPublicUrl(fileName);

      // Deactivate existing profile photo
      await this.supabase
        .from('profile_photos')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('is_active', true);

      // Save photo info to database
      const { data, error } = await this.supabase
        .from('profile_photos')
        .insert([
          {
            user_id: userId,
            file_url: publicUrl,
            file_name: file.originalname,
            file_size: file.size,
            mime_type: file.mimetype,
            storage_path: fileName,
            is_active: true,
          },
        ])
        .select()
        .single();

      if (error) {
        // Clean up uploaded file if database save fails
        await this.supabase.storage.from('profile-photos').remove([fileName]);
        throw new InternalServerErrorException(
          'Failed to save photo information',
        );
      }

      return data;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Profile photo upload failed');
    }
  }

  async getProfilePhoto(
    userId: string,
  ): Promise<ProfilePhotoResponseDto | null> {
    try {
      const { data, error } = await this.supabase
        .from('profile_photos')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new InternalServerErrorException('Failed to fetch profile photo');
      }

      return data || null;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get profile photo');
    }
  }

  async deleteProfilePhoto(userId: string): Promise<{ message: string }> {
    try {
      const existingPhoto = await this.getProfilePhoto(userId);
      if (!existingPhoto) {
        throw new NotFoundException('No active profile photo found');
      }

      // Delete from storage
      if (existingPhoto.storage_path) {
        await this.supabase.storage
          .from('profile-photos')
          .remove([existingPhoto.storage_path]);
      }

      // Delete from database
      const { error } = await this.supabase
        .from('profile_photos')
        .delete()
        .eq('id', existingPhoto.id);

      if (error) {
        throw new InternalServerErrorException(
          'Failed to delete profile photo',
        );
      }

      return { message: 'Profile photo deleted successfully' };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Profile photo deletion failed');
    }
  }

  // Travel Photo Methods
  async uploadTravelPhoto(
    userId: string,
    uploadDto: UploadTravelPhotoDto,
    file: Express.Multer.File,
  ): Promise<TravelPhotoResponseDto> {
    try {
      // Validate file
      if (!file) {
        throw new BadRequestException('No file provided');
      }

      // Validate image type
      if (!file.mimetype.startsWith('image/')) {
        throw new BadRequestException('File must be an image');
      }

      // Upload file to Supabase Storage (travel-photos bucket)
      const fileName = `${userId}/${Date.now()}-${file.originalname}`;
      const { data: uploadData, error: uploadError } =
        await this.supabase.storage
          .from('travel-photos')
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
          });

      if (uploadError) {
        throw new InternalServerErrorException(
          'Failed to upload file to storage',
        );
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = this.supabase.storage.from('travel-photos').getPublicUrl(fileName);

      // Save photo info to database
      const { data, error } = await this.supabase
        .from('travel_photos')
        .insert([
          {
            user_id: userId,
            file_url: publicUrl,
            latitude: uploadDto.latitude,
            longitude: uploadDto.longitude,
            title: uploadDto.title,
            description: uploadDto.description,
          },
        ])
        .select()
        .single();

      if (error) {
        // Clean up uploaded file if database save fails
        await this.supabase.storage.from('travel-photos').remove([fileName]);
        throw new InternalServerErrorException(
          'Failed to save photo information',
        );
      }

      return data;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Travel photo upload failed');
    }
  }

  // 사용자별 여행사진 조회 (본인 것만)
  async getUserTravelPhotos(
    userId: string,
    queryDto: QueryTravelPhotosDto,
  ): Promise<{
    photos: TravelPhotoResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const { page = 1, limit = 20 } = queryDto;
      const offset = (page - 1) * limit;

      const {
        data: photos,
        error,
        count,
      } = await this.supabase
        .from('travel_photos')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new InternalServerErrorException('Failed to fetch travel photos');
      }

      return {
        photos: photos || [],
        total: count || 0,
        page,
        limit,
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to get user travel photos',
      );
    }
  }

  async getTravelPhotos(queryDto: QueryTravelPhotosDto): Promise<{
    photos: TravelPhotoResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const {
        page = 1,
        limit = 20,
        user_id,
        is_public,
        min_latitude,
        max_latitude,
        min_longitude,
        max_longitude,
        center_latitude,
        center_longitude,
        radius_km,
      } = queryDto;
      const offset = (page - 1) * limit;

      let query = this.supabase
        .from('travel_photos')
        .select('*', { count: 'exact' })
        .eq('is_deleted', false);

      // Apply filters
      if (user_id) {
        query = query.eq('user_id', user_id);
      }

      if (is_public !== undefined) {
        query = query.eq('is_public', is_public);
      }

      // Bounding box search
      if (
        min_latitude !== undefined &&
        max_latitude !== undefined &&
        min_longitude !== undefined &&
        max_longitude !== undefined
      ) {
        query = query
          .gte('latitude', min_latitude)
          .lte('latitude', max_latitude)
          .gte('longitude', min_longitude)
          .lte('longitude', max_longitude);
      }

      // For radius search, we'll use a simple bounding box approximation
      // (For more accurate results, PostGIS extension would be ideal)
      if (
        center_latitude !== undefined &&
        center_longitude !== undefined &&
        radius_km !== undefined
      ) {
        const latDelta = radius_km / 111; // Rough conversion: 1 degree ≈ 111 km
        const lngDelta =
          radius_km / (111 * Math.cos((center_latitude * Math.PI) / 180));

        query = query
          .gte('latitude', center_latitude - latDelta)
          .lte('latitude', center_latitude + latDelta)
          .gte('longitude', center_longitude - lngDelta)
          .lte('longitude', center_longitude + lngDelta);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new InternalServerErrorException('Failed to fetch travel photos');
      }

      return {
        photos: data || [],
        total: count || 0,
        page,
        limit,
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get travel photos');
    }
  }

  async getTravelPhoto(photoId: string): Promise<TravelPhotoResponseDto> {
    try {
      const { data, error } = await this.supabase
        .from('travel_photos')
        .select('*')
        .eq('id', photoId)
        .eq('is_deleted', false)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new InternalServerErrorException('Failed to fetch travel photo');
      }

      if (!data) {
        throw new NotFoundException('Travel photo not found');
      }

      return data;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get travel photo');
    }
  }

  async updateTravelPhoto(
    photoId: string,
    userId: string,
    updateDto: UpdateTravelPhotoDto,
  ): Promise<TravelPhotoResponseDto> {
    try {
      // Verify ownership
      const existingPhoto = await this.getTravelPhoto(photoId);
      if (existingPhoto.user_id !== userId) {
        throw new BadRequestException('You can only update your own photos');
      }

      const { data, error } = await this.supabase
        .from('travel_photos')
        .update({
          title: updateDto.title,
          description: updateDto.description,
          location_name: updateDto.location_name,
          taken_at: updateDto.taken_at,
          is_public: updateDto.is_public,
          latitude: updateDto.latitude,
          longitude: updateDto.longitude,
        })
        .eq('id', photoId)
        .select()
        .single();

      if (error) {
        throw new InternalServerErrorException('Failed to update travel photo');
      }

      return data;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Travel photo update failed');
    }
  }

  async deleteTravelPhoto(
    photoId: string,
    userId: string,
  ): Promise<{ message: string }> {
    try {
      // Verify ownership
      const existingPhoto = await this.getTravelPhoto(photoId);
      if (existingPhoto.user_id !== userId) {
        throw new BadRequestException('You can only delete your own photos');
      }

      // Soft delete (set is_deleted = true)
      const { error } = await this.supabase
        .from('travel_photos')
        .update({ is_deleted: true })
        .eq('id', photoId);

      if (error) {
        throw new InternalServerErrorException('Failed to delete travel photo');
      }

      return { message: 'Travel photo deleted successfully' };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Travel photo deletion failed');
    }
  }

  // 거리 계산 함수 (Haversine formula)
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  }

  async findNearbyUsers(
    findNearbyUsersDto: FindNearbyUsersDto,
  ): Promise<FindNearbyUsersResponseDto> {
    try {
      const {
        user_id,
        radius_km = 10,
        min_age,
        max_age,
        page = 1,
        limit = 20,
        include_profile_photo = true,
        include_travel_photos = true,
        include_direct_distance = true,
        include_last_location = false,
      } = findNearbyUsersDto;
      const offset = (page - 1) * limit;

      // 0. 티켓 확인 및 차감
      const hasTickets = await this.ticketsService.hasEnoughTickets(user_id, 1);
      if (!hasTickets) {
        throw new BadRequestException(
          'Insufficient tickets for search. Please purchase more tickets or claim your daily free ticket.',
        );
      }

      // 티켓 사용 (검색 실행)
      await this.ticketsService.useTicket({
        user_id,
        description: 'Used for nearby users search',
        reference_id: undefined, // 필요시 검색 ID 생성해서 추가
      });

      // 1. 검색 기준 사용자 정보 조회 (위치 정보 포함)
      const { data: searchUser, error: searchUserError } = await this.supabase
        .from('users')
        .select('id, name, gender, age, last_latitude, last_longitude')
        .eq('id', user_id)
        .single();

      if (searchUserError || !searchUser) {
        throw new BadRequestException('User not found');
      }

      // 반대 성별 확인
      const targetGender = searchUser.gender === 'male' ? 'female' : 'male';

      // 이미 본 사용자들 ID 목록 조회
      const seenUserIds = await this.likesService.getSeenUserIds(user_id);

      // 2. 검색 기준 사용자의 여행 사진 위치들 조회
      const { data: userPhotos, error: userPhotosError } = await this.supabase
        .from('travel_photos')
        .select('latitude, longitude')
        .eq('user_id', user_id)
        .eq('is_deleted', false)
        .eq('is_public', true);

      if (userPhotosError) {
        throw new InternalServerErrorException('Failed to fetch user photos');
      }

      if (!userPhotos || userPhotos.length === 0) {
        return {
          users: [],
          total: 0,
          page,
          limit,
          user_photos_count: 0,
          search_radius_km: radius_km,
        };
      }

      // 3. 다른 성별 사용자들의 여행 사진 조회 (나이 필터링 및 위치 정보 포함)
      let query = this.supabase
        .from('travel_photos')
        .select(
          `
          id,
          user_id,
          file_url,
          file_name,
          latitude,
          longitude,
          title,
          description,
          location_name,
          taken_at,
          created_at,
          users!inner(id, name, age, gender, last_latitude, last_longitude, last_location_name, last_location_updated_at)
        `,
        )
        .eq('is_deleted', false)
        .eq('is_public', true)
        .eq('users.gender', targetGender)
        .neq('user_id', user_id);

      // 나이 필터링 적용
      if (min_age !== undefined) {
        query = query.gte('users.age', min_age);
      }
      if (max_age !== undefined) {
        query = query.lte('users.age', max_age);
      }

      // 이미 본 사용자들 제외
      if (seenUserIds.length > 0) {
        query = query.not('user_id', 'in', `(${seenUserIds.join(',')})`);
      }

      const { data: otherUsersPhotos, error: otherPhotosError } = await query;

      if (otherPhotosError) {
        throw new InternalServerErrorException(
          'Failed to fetch other users photos',
        );
      }

      // 4. 거리 계산 및 필터링
      const nearbyUsersMap = new Map<
        string,
        {
          user: any;
          photos: any[];
          distances: number[];
        }
      >();

      for (const otherPhoto of otherUsersPhotos || []) {
        let isNearby = false;
        let minDistance = Infinity;

        // 검색 기준 사용자의 모든 사진 위치와 비교
        for (const userPhoto of userPhotos) {
          const distance = this.calculateDistance(
            userPhoto.latitude,
            userPhoto.longitude,
            otherPhoto.latitude,
            otherPhoto.longitude,
          );

          if (distance <= radius_km) {
            isNearby = true;
            minDistance = Math.min(minDistance, distance);
          }
        }

        if (isNearby) {
          const userId = otherPhoto.user_id;
          if (!nearbyUsersMap.has(userId)) {
            nearbyUsersMap.set(userId, {
              user: otherPhoto.users,
              photos: [],
              distances: [],
            });
          }

          nearbyUsersMap.get(userId)!.photos.push(otherPhoto);
          nearbyUsersMap.get(userId)!.distances.push(minDistance);
        }
      }

      // 5. 프로필 사진 조회 (필요한 경우)
      const profilePhotosMap = new Map<string, any>();
      if (include_profile_photo && nearbyUsersMap.size > 0) {
        const userIds = Array.from(nearbyUsersMap.keys());
        const { data: profilePhotos } = await this.supabase
          .from('profile_photos')
          .select('user_id, id, file_url, file_name, created_at')
          .in('user_id', userIds)
          .eq('is_active', true);

        for (const profilePhoto of profilePhotos || []) {
          profilePhotosMap.set(profilePhoto.user_id, profilePhoto);
        }
      }

      // 6. 결과 정리 및 정렬
      const nearbyUsers: NearbyUserDto[] = Array.from(nearbyUsersMap.entries())
        .map(([userId, data]) => {
          const closestDistance = Math.min(...data.distances);
          const profilePhoto = profilePhotosMap.get(userId);
          const user = data.user;

          // 사용자 간 직접 거리 계산
          let directDistance: number | undefined = undefined;
          if (
            include_direct_distance &&
            searchUser.last_latitude &&
            searchUser.last_longitude &&
            user.last_latitude &&
            user.last_longitude
          ) {
            directDistance = this.calculateDistance(
              searchUser.last_latitude,
              searchUser.last_longitude,
              user.last_latitude,
              user.last_longitude,
            );
            directDistance = Math.round(directDistance * 100) / 100; // 소수점 2자리
          }

          return {
            id: user.id,
            name: user.name,
            age: user.age,
            gender: user.gender,
            profile_photo: profilePhoto
              ? {
                  id: profilePhoto.id,
                  file_url: profilePhoto.file_url,
                  file_name: profilePhoto.file_name,
                  created_at: profilePhoto.created_at,
                }
              : undefined,
            travel_photos: include_travel_photos
              ? data.photos.map((photo) => ({
                  id: photo.id,
                  file_url: photo.file_url,
                  file_name: photo.file_name,
                  latitude: photo.latitude,
                  longitude: photo.longitude,
                  title: photo.title,
                  description: photo.description,
                  location_name: photo.location_name,
                  taken_at: photo.taken_at,
                  created_at: photo.created_at,
                }))
              : [],
            common_locations_count: data.photos.length,
            closest_distance_km: Math.round(closestDistance * 100) / 100, // 소수점 2자리
            direct_distance_km: directDistance,
            last_location:
              include_last_location && user.last_latitude && user.last_longitude
                ? {
                    latitude: user.last_latitude,
                    longitude: user.last_longitude,
                    location_name: user.last_location_name,
                    updated_at: user.last_location_updated_at,
                  }
                : undefined,
          };
        })
        .sort((a, b) => a.closest_distance_km - b.closest_distance_km); // 가까운 거리 순 정렬

      // 7. 검색된 사용자들을 seen_users에 기록
      const userIdsToMark = Array.from(nearbyUsersMap.keys());
      for (const userId of userIdsToMark) {
        await this.likesService.markUserAsSeen(user_id, userId);
      }

      // 8. 페이징 적용
      const paginatedUsers = nearbyUsers.slice(offset, offset + limit);

      return {
        users: paginatedUsers,
        total: nearbyUsers.length,
        page,
        limit,
        user_photos_count: userPhotos.length,
        search_radius_km: radius_km,
        age_filter:
          min_age !== undefined || max_age !== undefined
            ? {
                min_age,
                max_age,
              }
            : undefined,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      console.error('Find nearby users error:', error);
      throw new InternalServerErrorException('Failed to find nearby users');
    }
  }
}
