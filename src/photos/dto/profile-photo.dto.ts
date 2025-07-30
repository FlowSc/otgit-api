import { IsNotEmpty, IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class UploadProfilePhotoDto {
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
}

export class ProfilePhotoResponseDto {
  id: string;
  user_id: string;
  file_url: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_path?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}