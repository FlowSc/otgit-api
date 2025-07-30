import { IsNotEmpty, IsString, IsOptional, IsInt, Min } from 'class-validator';

export class UploadProfilePhotoDto {
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

  @IsOptional()
  @IsString()
  storagePath?: string; // Will be set by the service
}