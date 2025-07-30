-- Users table for 옷깃 dating app
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  phone_verified BOOLEAN DEFAULT FALSE,
  gender VARCHAR(10) CHECK (gender IN ('male', 'female')) NOT NULL,
  age INTEGER CHECK (age >= 18 AND age <= 100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create index for email and phone lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE
  ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Profile photos table (one per user)
CREATE TABLE profile_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url VARCHAR(500) NOT NULL, -- URL to the stored image file
  file_name VARCHAR(255) NOT NULL, -- Original filename
  file_size INTEGER NOT NULL, -- File size in bytes
  mime_type VARCHAR(50) NOT NULL, -- e.g., 'image/jpeg', 'image/png'
  storage_path VARCHAR(500) NOT NULL, -- Path in storage bucket
  is_active BOOLEAN DEFAULT TRUE, -- For soft deletion/replacement
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  
  -- Ensure only one active profile photo per user
  CONSTRAINT unique_active_profile_photo UNIQUE (user_id, is_active) 
    DEFERRABLE INITIALLY DEFERRED
);

-- Create indexes for profile photos
CREATE INDEX idx_profile_photos_user_id ON profile_photos(user_id);
CREATE INDEX idx_profile_photos_active ON profile_photos(user_id, is_active);

-- Create updated_at trigger for profile_photos
CREATE TRIGGER update_profile_photos_updated_at BEFORE UPDATE
  ON profile_photos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Travel photos table (multiple per user with geolocation)
CREATE TABLE travel_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url VARCHAR(500) NOT NULL, -- URL to the stored image file
  file_name VARCHAR(255) NOT NULL, -- Original filename
  file_size INTEGER NOT NULL, -- File size in bytes
  mime_type VARCHAR(50) NOT NULL, -- e.g., 'image/jpeg', 'image/png'
  storage_path VARCHAR(500) NOT NULL, -- Path in storage bucket
  
  -- Geolocation data (required)
  latitude DECIMAL(10, 8) NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
  longitude DECIMAL(11, 8) NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
  
  -- Optional metadata
  title VARCHAR(200), -- User-provided title for the photo
  description TEXT, -- User-provided description
  location_name VARCHAR(255), -- Human-readable location name (e.g., "Paris, France")
  taken_at TIMESTAMP WITH TIME ZONE, -- When the photo was taken (from EXIF or user input)
  
  -- Photo status
  is_public BOOLEAN DEFAULT TRUE, -- Whether photo is visible to other users
  is_deleted BOOLEAN DEFAULT FALSE, -- Soft deletion
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create indexes for travel photos
CREATE INDEX idx_travel_photos_user_id ON travel_photos(user_id);
CREATE INDEX idx_travel_photos_location ON travel_photos(latitude, longitude);
CREATE INDEX idx_travel_photos_public ON travel_photos(is_public, is_deleted);
CREATE INDEX idx_travel_photos_taken_at ON travel_photos(taken_at);

-- Create updated_at trigger for travel_photos
CREATE TRIGGER update_travel_photos_updated_at BEFORE UPDATE
  ON travel_photos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create a spatial index for efficient geo-queries (requires PostGIS extension)
-- Uncomment the following lines if PostGIS is available:
-- CREATE EXTENSION IF NOT EXISTS postgis;
-- ALTER TABLE travel_photos ADD COLUMN geom GEOMETRY(POINT, 4326);
-- CREATE INDEX idx_travel_photos_geom ON travel_photos USING GIST (geom);

-- Function to update geometry column when lat/lng changes (requires PostGIS)
-- CREATE OR REPLACE FUNCTION update_travel_photos_geom()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   NEW.geom = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
--   RETURN NEW;
-- END;
-- $$ language 'plpgsql';

-- CREATE TRIGGER update_travel_photos_geom_trigger BEFORE INSERT OR UPDATE
--   ON travel_photos FOR EACH ROW EXECUTE FUNCTION update_travel_photos_geom();