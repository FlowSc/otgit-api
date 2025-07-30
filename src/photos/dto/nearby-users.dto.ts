import { IsNotEmpty, IsString, IsOptional, IsNumber, Min, Max, IsBoolean } from 'class-validator';

export class FindNearbyUsersDto {
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @IsNumber()
  @Min(0.1)
  @Max(100) // 최대 100km
  @IsOptional()
  radius_km?: number = 10;

  // 나이 필터링
  @IsNumber()
  @Min(18)
  @Max(100)
  @IsOptional()
  min_age?: number;

  @IsNumber()
  @Min(18)
  @Max(100)
  @IsOptional()
  max_age?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @IsBoolean()
  @IsOptional()
  include_profile_photo?: boolean = true;

  @IsBoolean()
  @IsOptional()
  include_travel_photos?: boolean = true;

  @IsBoolean()
  @IsOptional()
  include_direct_distance?: boolean = true;

  @IsBoolean()
  @IsOptional()
  include_last_location?: boolean = false;
}

export class NearbyUserPhotoDto {
  id: string;
  file_url: string;
  file_name: string;
  latitude?: number;
  longitude?: number;
  title?: string;
  description?: string;
  location_name?: string;
  taken_at?: string;
  created_at: string;
}

export class NearbyUserDto {
  id: string;
  name: string;
  age: number;
  gender: string;
  profile_photo?: NearbyUserPhotoDto;
  travel_photos: NearbyUserPhotoDto[];
  common_locations_count: number; // 공통 위치(반경 내) 개수
  closest_distance_km: number; // 가장 가까운 거리(km)
  direct_distance_km?: number; // 사용자 간 직접 거리(km)
  last_location?: {
    latitude: number;
    longitude: number;
    location_name?: string;
    updated_at: string;
  };
}

export class FindNearbyUsersResponseDto {
  users: NearbyUserDto[];
  total: number;
  page: number;
  limit: number;
  user_photos_count: number; // 검색 기준이 된 사용자의 사진 개수
  search_radius_km: number;
  age_filter?: {
    min_age?: number;
    max_age?: number;
  };
}