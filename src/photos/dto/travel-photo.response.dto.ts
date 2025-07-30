export class TravelPhotoResponseDto {
  id: string;
  userId: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  latitude: number;
  longitude: number;
  title?: string;
  description?: string;
  locationName?: string;
  takenAt?: Date;
  isPublic: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Optional computed fields
  distance?: number; // Distance from query point in kilometers

  constructor(partial: Partial<TravelPhotoResponseDto>) {
    Object.assign(this, partial);
  }
}
