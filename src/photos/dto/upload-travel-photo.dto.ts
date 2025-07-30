import { 
  IsNotEmpty, 
  IsString, 
  IsOptional, 
  IsInt, 
  Min, 
  IsDecimal, 
  IsBoolean,
  IsDateString,
  MaxLength,
  IsNumber
} from 'class-validator';
import { Type } from 'class-transformer';

export class UploadTravelPhotoDto {
  @IsNotEmpty()
  @IsString()
  fileName: string;

  @IsNotEmpty()
  @IsString()
  mimeType: string;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  fileSize: number;

  // Required geolocation
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  latitude: number;

  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  longitude: number;

  // Optional metadata
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  locationName?: string;

  @IsOptional()
  @IsDateString()
  takenAt?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isPublic?: boolean = true;

  @IsOptional()
  @IsString()
  storagePath?: string; // Will be set by the service
}