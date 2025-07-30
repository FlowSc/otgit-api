export class ProfilePhotoResponseDto {
  id: string;
  userId: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<ProfilePhotoResponseDto>) {
    Object.assign(this, partial);
  }
}
