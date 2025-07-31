-- Migration to remove unused fields from travel_photos table
-- Run this migration to clean up the schema

-- Remove unused columns from travel_photos table
ALTER TABLE travel_photos DROP COLUMN IF EXISTS file_name;
ALTER TABLE travel_photos DROP COLUMN IF EXISTS file_size;
ALTER TABLE travel_photos DROP COLUMN IF EXISTS mime_type;
ALTER TABLE travel_photos DROP COLUMN IF EXISTS storage_path;
ALTER TABLE travel_photos DROP COLUMN IF EXISTS location_name;
ALTER TABLE travel_photos DROP COLUMN IF EXISTS taken_at;
ALTER TABLE travel_photos DROP COLUMN IF EXISTS is_public;
ALTER TABLE travel_photos DROP COLUMN IF EXISTS is_deleted;
ALTER TABLE travel_photos DROP COLUMN IF EXISTS updated_at;

-- Remove the updated_at trigger since the column is removed
DROP TRIGGER IF EXISTS update_travel_photos_updated_at ON travel_photos;

-- Remove indexes that are no longer needed
DROP INDEX IF EXISTS idx_travel_photos_public;
DROP INDEX IF EXISTS idx_travel_photos_taken_at;
DROP INDEX IF EXISTS idx_travel_photos_user_public;
DROP INDEX IF EXISTS idx_travel_photos_location_public;

-- Remove check constraint that's no longer relevant
ALTER TABLE travel_photos DROP CONSTRAINT IF EXISTS check_file_size;

-- Update the schema to reflect the simplified structure
COMMENT ON TABLE travel_photos IS 'Simplified travel photos table with only essential fields: user_id, file_url, latitude, longitude, title, description, created_at';