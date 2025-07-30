export interface TravelPhoto {
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