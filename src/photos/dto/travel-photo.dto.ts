import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsBoolean,
  IsDateString,
} from 'class-validator';

export class UploadTravelPhotoDto {
  @IsString()
  @IsNotEmpty()
  file_name: string;

  @IsNumber()
  @Min(1)
  file_size: number;

  @IsString()
  @IsNotEmpty()
  mime_type: string;

  @IsString()
  @IsOptional()
  storage_path?: string;

  // Required geolocation
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  // Optional metadata
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  location_name?: string;

  @IsDateString()
  @IsOptional()
  taken_at?: string;

  @IsBoolean()
  @IsOptional()
  is_public?: boolean;
}

export class UpdateTravelPhotoDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  location_name?: string;

  @IsDateString()
  @IsOptional()
  taken_at?: string;

  @IsBoolean()
  @IsOptional()
  is_public?: boolean;

  @IsNumber()
  @Min(-90)
  @Max(90)
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  @IsOptional()
  longitude?: number;
}

export class QueryTravelPhotosDto {
  @IsNumber()
  @IsOptional()
  @Min(1)
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsString()
  @IsOptional()
  user_id?: string;

  @IsBoolean()
  @IsOptional()
  is_public?: boolean;

  // Bounding box search
  @IsNumber()
  @Min(-90)
  @Max(90)
  @IsOptional()
  min_latitude?: number;

  @IsNumber()
  @Min(-90)
  @Max(90)
  @IsOptional()
  max_latitude?: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  @IsOptional()
  min_longitude?: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  @IsOptional()
  max_longitude?: number;

  // Radius search (requires center_latitude and center_longitude)
  @IsNumber()
  @Min(-90)
  @Max(90)
  @IsOptional()
  center_latitude?: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  @IsOptional()
  center_longitude?: number;

  @IsNumber()
  @Min(0.001)
  @Max(20000) // Max 20,000 km radius
  @IsOptional()
  radius_km?: number;
}

export class TravelPhotoResponseDto {
  id: string;
  user_id: string;
  file_url: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_path?: string;
  latitude: number;
  longitude: number;
  title?: string;
  description?: string;
  location_name?: string;
  taken_at?: string;
  is_public: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}
