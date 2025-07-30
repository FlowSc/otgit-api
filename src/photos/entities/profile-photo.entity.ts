export interface ProfilePhoto {
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