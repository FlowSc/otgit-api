import {
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QueryTravelPhotosDto {
  // Pagination
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  // Geolocation filtering (bounding box)
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minLatitude?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxLatitude?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minLongitude?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxLongitude?: number;

  // Radius search (center point + radius in kilometers)
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  centerLatitude?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  centerLongitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(10000) // Max 10,000 km radius
  @Type(() => Number)
  radiusKm?: number;

  // Other filters
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isPublic?: boolean;

  @IsOptional()
  @IsString()
  locationName?: string;

  // Sorting
  @IsOptional()
  @IsString()
  sortBy?: 'created_at' | 'taken_at' | 'distance' = 'created_at';

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
