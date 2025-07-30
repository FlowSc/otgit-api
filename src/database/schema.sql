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

-- Enable PostGIS extension for efficient geo-spatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geometry columns for travel_photos
ALTER TABLE travel_photos ADD COLUMN IF NOT EXISTS geom GEOMETRY(POINT, 4326);

-- Create spatial index for travel_photos
CREATE INDEX IF NOT EXISTS idx_travel_photos_geom ON travel_photos USING GIST (geom);

-- Function to update geometry column when lat/lng changes
CREATE OR REPLACE FUNCTION update_travel_photos_geom()
RETURNS TRIGGER AS $$
BEGIN
  NEW.geom = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update geometry column
DROP TRIGGER IF EXISTS update_travel_photos_geom_trigger ON travel_photos;
CREATE TRIGGER update_travel_photos_geom_trigger BEFORE INSERT OR UPDATE
  ON travel_photos FOR EACH ROW EXECUTE FUNCTION update_travel_photos_geom();

-- Update existing records with geometry data
UPDATE travel_photos SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) 
WHERE geom IS NULL AND longitude IS NOT NULL AND latitude IS NOT NULL;

-- Phone verification table for secure signup process
CREATE TABLE phone_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  verification_code VARCHAR(6) NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create indexes for phone verifications
CREATE INDEX idx_phone_verifications_phone ON phone_verifications(phone);
CREATE INDEX idx_phone_verifications_expires ON phone_verifications(expires_at);
CREATE INDEX idx_phone_verifications_verified ON phone_verifications(phone, is_verified);

-- Create updated_at trigger for phone_verifications
CREATE TRIGGER update_phone_verifications_updated_at BEFORE UPDATE
  ON phone_verifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Likes table for the dating app like system
CREATE TABLE likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  
  -- Prevent self-likes and duplicate likes
  CONSTRAINT no_self_like CHECK (sender_id != receiver_id),
  CONSTRAINT unique_like UNIQUE (sender_id, receiver_id)
);

-- Create indexes for likes
CREATE INDEX idx_likes_sender_receiver ON likes(sender_id, receiver_id);
CREATE INDEX idx_likes_receiver_status ON likes(receiver_id, status);
CREATE INDEX idx_likes_created_at ON likes(created_at);

-- Create updated_at trigger for likes
CREATE TRIGGER update_likes_updated_at BEFORE UPDATE
  ON likes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Matches table for successful mutual likes
CREATE TABLE matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  matched_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  
  -- Ensure consistent user ordering (user1_id < user2_id) and uniqueness
  CONSTRAINT check_user_order CHECK (user1_id < user2_id),
  CONSTRAINT unique_match UNIQUE (user1_id, user2_id)
);

-- Create indexes for matches
CREATE INDEX idx_matches_users ON matches(user1_id, user2_id);
CREATE INDEX idx_matches_active ON matches(is_active, matched_at);
CREATE INDEX idx_matches_user1 ON matches(user1_id);
CREATE INDEX idx_matches_user2 ON matches(user2_id);

-- Create updated_at trigger for matches
CREATE TRIGGER update_matches_updated_at BEFORE UPDATE
  ON matches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Chat rooms table for messaging between matched users
CREATE TABLE chat_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  
  -- Ensure consistent user ordering and uniqueness
  CONSTRAINT check_chatroom_user_order CHECK (user1_id < user2_id),
  CONSTRAINT unique_chatroom UNIQUE (user1_id, user2_id)
);

-- Create indexes for chat_rooms
CREATE INDEX idx_chat_rooms_users ON chat_rooms(user1_id, user2_id);
CREATE INDEX idx_chat_rooms_updated ON chat_rooms(updated_at);
CREATE INDEX idx_chat_rooms_user1 ON chat_rooms(user1_id);
CREATE INDEX idx_chat_rooms_user2 ON chat_rooms(user2_id);

-- Create updated_at trigger for chat_rooms
CREATE TRIGGER update_chat_rooms_updated_at BEFORE UPDATE
  ON chat_rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Messages table for chat system
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file')),
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create indexes for messages
CREATE INDEX idx_messages_chatroom_created ON messages(chat_room_id, created_at);
CREATE INDEX idx_messages_sender_read ON messages(sender_id, is_read);
CREATE INDEX idx_messages_chatroom_unread ON messages(chat_room_id, is_read) WHERE is_read = FALSE;

-- Create updated_at trigger for messages
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE
  ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seen users table to track which users have been shown to each user (prevent duplicates)
CREATE TABLE seen_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  searcher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seen_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seen_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  
  -- Prevent self-records and ensure uniqueness
  CONSTRAINT no_self_seen CHECK (searcher_id != seen_user_id),
  CONSTRAINT unique_seen_user UNIQUE (searcher_id, seen_user_id)
);

-- Create indexes for seen_users
CREATE INDEX idx_seen_users_searcher ON seen_users(searcher_id, seen_at);
CREATE INDEX idx_seen_users_seen_user ON seen_users(seen_user_id);

-- FCM tokens table for push notifications
CREATE TABLE fcm_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) NOT NULL,
  device_type VARCHAR(20) NOT NULL CHECK (device_type IN ('ios', 'android', 'web')),
  device_id VARCHAR(255),
  app_version VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  
  -- Ensure token uniqueness
  CONSTRAINT unique_token UNIQUE (token)
);

-- Create indexes for fcm_tokens
CREATE INDEX idx_fcm_tokens_user_active ON fcm_tokens(user_id, is_active);
CREATE INDEX idx_fcm_tokens_device ON fcm_tokens(device_id);
CREATE INDEX idx_fcm_tokens_user ON fcm_tokens(user_id);

-- Create updated_at trigger for fcm_tokens
CREATE TRIGGER update_fcm_tokens_updated_at BEFORE UPDATE
  ON fcm_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Notification settings table for user preferences
CREATE TABLE notification_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  new_messages BOOLEAN DEFAULT TRUE,
  new_matches BOOLEAN DEFAULT TRUE,
  new_likes BOOLEAN DEFAULT TRUE,
  chat_messages BOOLEAN DEFAULT TRUE,
  marketing BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  
  -- One setting record per user
  CONSTRAINT unique_user_settings UNIQUE (user_id)
);

-- Create indexes for notification_settings
CREATE INDEX idx_notification_settings_user ON notification_settings(user_id);

-- Create updated_at trigger for notification_settings
CREATE TRIGGER update_notification_settings_updated_at BEFORE UPDATE
  ON notification_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Notification history table to track sent notifications
CREATE TABLE notification_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('new_message', 'new_match', 'new_like', 'chat_message', 'system')),
  is_sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create indexes for notification_history
CREATE INDEX idx_notification_history_user_created ON notification_history(user_id, created_at);
CREATE INDEX idx_notification_history_type ON notification_history(notification_type);
CREATE INDEX idx_notification_history_sent ON notification_history(is_sent, sent_at);

-- Add missing columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_latitude DECIMAL(10, 8);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_longitude DECIMAL(11, 8);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_location_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_location_updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_type VARCHAR(20) DEFAULT 'email';
ALTER TABLE users ADD COLUMN IF NOT EXISTS social_provider VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS social_id VARCHAR(255);

-- Add geometry column for users (for current location)
ALTER TABLE users ADD COLUMN IF NOT EXISTS geom GEOMETRY(POINT, 4326);

-- Create spatial index for users
CREATE INDEX IF NOT EXISTS idx_users_geom ON users USING GIST (geom) WHERE geom IS NOT NULL;

-- Function to update user geometry column when location changes
CREATE OR REPLACE FUNCTION update_users_geom()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.last_latitude IS NOT NULL AND NEW.last_longitude IS NOT NULL THEN
    NEW.geom = ST_SetSRID(ST_MakePoint(NEW.last_longitude, NEW.last_latitude), 4326);
  ELSE
    NEW.geom = NULL;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update user geometry column
DROP TRIGGER IF EXISTS update_users_geom_trigger ON users;
CREATE TRIGGER update_users_geom_trigger BEFORE INSERT OR UPDATE
  ON users FOR EACH ROW EXECUTE FUNCTION update_users_geom();

-- Update existing user records with geometry data
UPDATE users SET geom = ST_SetSRID(ST_MakePoint(last_longitude, last_latitude), 4326) 
WHERE geom IS NULL AND last_longitude IS NOT NULL AND last_latitude IS NOT NULL;

-- Create additional indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_location ON users(last_latitude, last_longitude) WHERE last_latitude IS NOT NULL AND last_longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_gender_age ON users(gender, age);
CREATE INDEX IF NOT EXISTS idx_users_login_type ON users(login_type);
CREATE INDEX IF NOT EXISTS idx_users_social ON users(social_provider, social_id) WHERE social_provider IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_phone_verified ON users(phone_verified);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Additional performance indexes for profile_photos
CREATE INDEX IF NOT EXISTS idx_profile_photos_created_at ON profile_photos(created_at);

-- Additional performance indexes for travel_photos  
CREATE INDEX IF NOT EXISTS idx_travel_photos_user_public ON travel_photos(user_id, is_public) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_travel_photos_created_at ON travel_photos(created_at);
CREATE INDEX IF NOT EXISTS idx_travel_photos_location_public ON travel_photos(latitude, longitude, is_public) WHERE is_deleted = FALSE;

-- Performance indexes for phone_verifications
CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone_verified ON phone_verifications(phone, is_verified, expires_at);

-- Cleanup function for expired phone verifications
CREATE OR REPLACE FUNCTION cleanup_expired_verifications()
RETURNS void AS $$
BEGIN
  DELETE FROM phone_verifications 
  WHERE expires_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Cleanup function for old seen_users records
CREATE OR REPLACE FUNCTION cleanup_old_seen_users()
RETURNS void AS $$
BEGIN
  DELETE FROM seen_users 
  WHERE seen_at < NOW() - INTERVAL '6 months';
END;
$$ LANGUAGE plpgsql;

-- Additional check constraints for data integrity
ALTER TABLE users ADD CONSTRAINT IF NOT EXISTS check_age_range CHECK (age >= 18 AND age <= 100);
ALTER TABLE users ADD CONSTRAINT IF NOT EXISTS check_gender_values CHECK (gender IN ('male', 'female'));
ALTER TABLE users ADD CONSTRAINT IF NOT EXISTS check_login_type_values CHECK (login_type IN ('email', 'google', 'apple'));

-- Additional check constraints for travel_photos
ALTER TABLE travel_photos ADD CONSTRAINT IF NOT EXISTS check_latitude_range CHECK (latitude >= -90 AND latitude <= 90);
ALTER TABLE travel_photos ADD CONSTRAINT IF NOT EXISTS check_longitude_range CHECK (longitude >= -180 AND longitude <= 180);
ALTER TABLE travel_photos ADD CONSTRAINT IF NOT EXISTS check_file_size CHECK (file_size > 0 AND file_size <= 10485760); -- 10MB max

-- Additional check constraints for profile_photos
ALTER TABLE profile_photos ADD CONSTRAINT IF NOT EXISTS check_profile_file_size CHECK (file_size > 0 AND file_size <= 5242880); -- 5MB max

-- Check constraint for phone_verifications
ALTER TABLE phone_verifications ADD CONSTRAINT IF NOT EXISTS check_verification_code_format CHECK (verification_code ~ '^[0-9]{6}$');
ALTER TABLE phone_verifications ADD CONSTRAINT IF NOT EXISTS check_phone_format CHECK (phone ~ '^010-[0-9]{4}-[0-9]{4}$');
ALTER TABLE phone_verifications ADD CONSTRAINT IF NOT EXISTS check_attempts_range CHECK (attempts >= 0 AND attempts <= max_attempts);

-- Check constraints for likes table
ALTER TABLE likes ADD CONSTRAINT IF NOT EXISTS check_like_status CHECK (status IN ('pending', 'accepted', 'rejected'));

-- Check constraints for messages
ALTER TABLE messages ADD CONSTRAINT IF NOT EXISTS check_message_type CHECK (message_type IN ('text', 'image', 'file'));
ALTER TABLE messages ADD CONSTRAINT IF NOT EXISTS check_message_not_empty CHECK (length(trim(message_text)) > 0);

-- Check constraints for FCM tokens
ALTER TABLE fcm_tokens ADD CONSTRAINT IF NOT EXISTS check_device_type CHECK (device_type IN ('ios', 'android', 'web'));
ALTER TABLE fcm_tokens ADD CONSTRAINT IF NOT EXISTS check_token_not_empty CHECK (length(trim(token)) > 0);

-- Check constraints for notification_history
ALTER TABLE notification_history ADD CONSTRAINT IF NOT EXISTS check_notification_type_values 
CHECK (notification_type IN ('new_message', 'new_match', 'new_like', 'chat_message', 'system'));

-- Data integrity verification function
CREATE OR REPLACE FUNCTION verify_data_integrity()
RETURNS TABLE(check_name TEXT, status TEXT, details TEXT) AS $$
BEGIN
  -- Check for orphaned profile photos
  RETURN QUERY SELECT 'orphaned_profile_photos'::TEXT, 
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END::TEXT,
    ('Found ' || COUNT(*) || ' orphaned profile photos')::TEXT
  FROM profile_photos p 
  LEFT JOIN users u ON p.user_id = u.id 
  WHERE u.id IS NULL;
  
  -- Check for orphaned travel photos
  RETURN QUERY SELECT 'orphaned_travel_photos'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END::TEXT,
    ('Found ' || COUNT(*) || ' orphaned travel photos')::TEXT
  FROM travel_photos t 
  LEFT JOIN users u ON t.user_id = u.id 
  WHERE u.id IS NULL;
  
  -- Check for invalid matches (should have corresponding accepted likes)
  RETURN QUERY SELECT 'invalid_matches'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END::TEXT,
    ('Found ' || COUNT(*) || ' invalid matches')::TEXT
  FROM matches m
  WHERE NOT EXISTS (
    SELECT 1 FROM likes l1 
    WHERE l1.sender_id = m.user1_id AND l1.receiver_id = m.user2_id AND l1.status = 'accepted'
  ) OR NOT EXISTS (
    SELECT 1 FROM likes l2
    WHERE l2.sender_id = m.user2_id AND l2.receiver_id = m.user1_id AND l2.status = 'accepted'
  );
  
  -- Check for orphaned messages
  RETURN QUERY SELECT 'orphaned_messages'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END::TEXT,
    ('Found ' || COUNT(*) || ' orphaned messages')::TEXT
  FROM messages msg
  LEFT JOIN chat_rooms cr ON msg.chat_room_id = cr.id
  WHERE cr.id IS NULL;
  
  -- Check for orphaned FCM tokens
  RETURN QUERY SELECT 'orphaned_fcm_tokens'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END::TEXT,
    ('Found ' || COUNT(*) || ' orphaned FCM tokens')::TEXT
  FROM fcm_tokens f
  LEFT JOIN users u ON f.user_id = u.id
  WHERE u.id IS NULL;
END;
$$ LANGUAGE plpgsql;