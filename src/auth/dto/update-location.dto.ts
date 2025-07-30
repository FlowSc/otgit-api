import { IsNotEmpty, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

export class UpdateLocationDto {
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsString()
  @IsOptional()
  location_name?: string;
}

export class LocationResponseDto {
  latitude: number;
  longitude: number;
  location_name?: string;
  updated_at: string;
}