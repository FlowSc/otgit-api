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

-- Drop existing notification_history table and recreate as partitioned (WARNING: DATA LOSS)
-- Comment out the following lines if you have existing data that needs to be preserved
DROP TABLE IF EXISTS notification_history CASCADE;

-- Create partitioned notification_history table
CREATE TABLE notification_history (
  id UUID DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('new_message', 'new_match', 'new_like', 'chat_message', 'system')),
  is_sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  
  -- Check constraint
  CONSTRAINT check_notification_type_values CHECK (notification_type IN ('new_message', 'new_match', 'new_like', 'chat_message', 'system')),
  
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for notification_history (2025)
CREATE TABLE notification_history_2025_01 PARTITION OF notification_history
    FOR VALUES FROM ('2025-01-01 00:00:00+00') TO ('2025-02-01 00:00:00+00');

CREATE TABLE notification_history_2025_02 PARTITION OF notification_history
    FOR VALUES FROM ('2025-02-01 00:00:00+00') TO ('2025-03-01 00:00:00+00');

CREATE TABLE notification_history_2025_03 PARTITION OF notification_history
    FOR VALUES FROM ('2025-03-01 00:00:00+00') TO ('2025-04-01 00:00:00+00');

CREATE TABLE notification_history_2025_04 PARTITION OF notification_history
    FOR VALUES FROM ('2025-04-01 00:00:00+00') TO ('2025-05-01 00:00:00+00');

CREATE TABLE notification_history_2025_05 PARTITION OF notification_history
    FOR VALUES FROM ('2025-05-01 00:00:00+00') TO ('2025-06-01 00:00:00+00');

CREATE TABLE notification_history_2025_06 PARTITION OF notification_history
    FOR VALUES FROM ('2025-06-01 00:00:00+00') TO ('2025-07-01 00:00:00+00');

CREATE TABLE notification_history_2025_07 PARTITION OF notification_history
    FOR VALUES FROM ('2025-07-01 00:00:00+00') TO ('2025-08-01 00:00:00+00');

CREATE TABLE notification_history_2025_08 PARTITION OF notification_history
    FOR VALUES FROM ('2025-08-01 00:00:00+00') TO ('2025-09-01 00:00:00+00');

CREATE TABLE notification_history_2025_09 PARTITION OF notification_history
    FOR VALUES FROM ('2025-09-01 00:00:00+00') TO ('2025-10-01 00:00:00+00');

CREATE TABLE notification_history_2025_10 PARTITION OF notification_history
    FOR VALUES FROM ('2025-10-01 00:00:00+00') TO ('2025-11-01 00:00:00+00');

CREATE TABLE notification_history_2025_11 PARTITION OF notification_history
    FOR VALUES FROM ('2025-11-01 00:00:00+00') TO ('2025-12-01 00:00:00+00');

CREATE TABLE notification_history_2025_12 PARTITION OF notification_history
    FOR VALUES FROM ('2025-12-01 00:00:00+00') TO ('2026-01-01 00:00:00+00');

-- Create default partition for future dates
CREATE TABLE notification_history_default PARTITION OF notification_history DEFAULT;

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

-- User profile additional fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS mbti VARCHAR(4);
ALTER TABLE users ADD COLUMN IF NOT EXISTS personality TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS job VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;

-- Create user_tickets table for ticket management
CREATE TABLE IF NOT EXISTS user_tickets (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    free_tickets INTEGER NOT NULL DEFAULT 0 CHECK (free_tickets >= 0),
    paid_tickets INTEGER NOT NULL DEFAULT 0 CHECK (paid_tickets >= 0),
    total_purchased_tickets INTEGER NOT NULL DEFAULT 0 CHECK (total_purchased_tickets >= 0),
    last_free_ticket_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create ticket_transactions table for transaction history
CREATE TABLE IF NOT EXISTS ticket_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('earned_free', 'purchased', 'used', 'expired')),
    ticket_type VARCHAR(10) NOT NULL DEFAULT 'free' CHECK (ticket_type IN ('free', 'paid')),
    amount INTEGER NOT NULL,
    description TEXT,
    reference_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for ticket tables
CREATE INDEX IF NOT EXISTS idx_user_tickets_free_date ON user_tickets(last_free_ticket_date, free_tickets);
CREATE INDEX IF NOT EXISTS idx_ticket_transactions_user_type ON ticket_transactions(user_id, transaction_type, created_at);
CREATE INDEX IF NOT EXISTS idx_ticket_transactions_created_at ON ticket_transactions(created_at);

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

-- ============================================================================
-- PARTITIONING SETUP FOR HIGH-VOLUME TABLES
-- ============================================================================

-- Convert messages table to partitioned table (for new installations)
-- Note: For existing installations, this requires data migration
-- 
-- Steps for existing data:
-- 1. Rename existing messages table: ALTER TABLE messages RENAME TO messages_backup;
-- 2. Create new partitioned table with same structure
-- 3. Migrate data from backup to new partitioned table
-- 4. Drop backup table after verification

-- Drop existing messages table and recreate as partitioned (WARNING: DATA LOSS)
-- Comment out the following lines if you have existing data that needs to be preserved
DROP TABLE IF EXISTS messages CASCADE;

-- Create partitioned messages table
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid(),
  chat_room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file')),
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  
  -- Check constraints
  CONSTRAINT check_message_type CHECK (message_type IN ('text', 'image', 'file')),
  CONSTRAINT check_message_not_empty CHECK (length(trim(message_text)) > 0),
  
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for messages (2025)
CREATE TABLE messages_2025_01 PARTITION OF messages
    FOR VALUES FROM ('2025-01-01 00:00:00+00') TO ('2025-02-01 00:00:00+00');

CREATE TABLE messages_2025_02 PARTITION OF messages
    FOR VALUES FROM ('2025-02-01 00:00:00+00') TO ('2025-03-01 00:00:00+00');

CREATE TABLE messages_2025_03 PARTITION OF messages
    FOR VALUES FROM ('2025-03-01 00:00:00+00') TO ('2025-04-01 00:00:00+00');

CREATE TABLE messages_2025_04 PARTITION OF messages
    FOR VALUES FROM ('2025-04-01 00:00:00+00') TO ('2025-05-01 00:00:00+00');

CREATE TABLE messages_2025_05 PARTITION OF messages
    FOR VALUES FROM ('2025-05-01 00:00:00+00') TO ('2025-06-01 00:00:00+00');

CREATE TABLE messages_2025_06 PARTITION OF messages
    FOR VALUES FROM ('2025-06-01 00:00:00+00') TO ('2025-07-01 00:00:00+00');

CREATE TABLE messages_2025_07 PARTITION OF messages
    FOR VALUES FROM ('2025-07-01 00:00:00+00') TO ('2025-08-01 00:00:00+00');

CREATE TABLE messages_2025_08 PARTITION OF messages
    FOR VALUES FROM ('2025-08-01 00:00:00+00') TO ('2025-09-01 00:00:00+00');

CREATE TABLE messages_2025_09 PARTITION OF messages
    FOR VALUES FROM ('2025-09-01 00:00:00+00') TO ('2025-10-01 00:00:00+00');

CREATE TABLE messages_2025_10 PARTITION OF messages
    FOR VALUES FROM ('2025-10-01 00:00:00+00') TO ('2025-11-01 00:00:00+00');

CREATE TABLE messages_2025_11 PARTITION OF messages
    FOR VALUES FROM ('2025-11-01 00:00:00+00') TO ('2025-12-01 00:00:00+00');

CREATE TABLE messages_2025_12 PARTITION OF messages
    FOR VALUES FROM ('2025-12-01 00:00:00+00') TO ('2026-01-01 00:00:00+00');

-- Create default partition for future dates
CREATE TABLE messages_default PARTITION OF messages DEFAULT;

-- Create indexes on partitioned messages table
CREATE INDEX idx_messages_chatroom_created ON messages(chat_room_id, created_at);
CREATE INDEX idx_messages_sender_read ON messages(sender_id, is_read);
CREATE INDEX idx_messages_chatroom_unread ON messages(chat_room_id, is_read) WHERE is_read = FALSE;

-- Create updated_at trigger for partitioned messages
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE
  ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- CACHING TABLES FOR PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Matching candidates pre-computation cache table
-- This table stores pre-calculated matching candidates to improve performance
CREATE TABLE matching_candidates_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  searcher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  distance_km DECIMAL(8, 3) NOT NULL,
  match_score INTEGER DEFAULT 0 CHECK (match_score >= 0 AND match_score <= 100),
  compatibility_factors JSONB, -- Store factors that contribute to matching score
  computed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW() + INTERVAL '24 hours'),
  is_valid BOOLEAN DEFAULT TRUE,
  
  -- Prevent self-matching and ensure uniqueness
  CONSTRAINT no_self_match CHECK (searcher_id != candidate_id),
  CONSTRAINT unique_match_candidate UNIQUE (searcher_id, candidate_id)
);

-- Create indexes for matching_candidates_cache
CREATE INDEX idx_matching_candidates_searcher ON matching_candidates_cache(searcher_id, expires_at, is_valid);
CREATE INDEX idx_matching_candidates_score ON matching_candidates_cache(searcher_id, match_score DESC) WHERE is_valid = TRUE;
CREATE INDEX idx_matching_candidates_distance ON matching_candidates_cache(searcher_id, distance_km) WHERE is_valid = TRUE;
CREATE INDEX idx_matching_candidates_expires ON matching_candidates_cache(expires_at) WHERE is_valid = TRUE;

-- User search results cache table
-- This table caches search results to avoid repeated location-based queries
CREATE TABLE user_search_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  searcher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  search_latitude DECIMAL(10, 8) NOT NULL,
  search_longitude DECIMAL(11, 8) NOT NULL,
  search_radius_km INTEGER NOT NULL CHECK (search_radius_km > 0 AND search_radius_km <= 100),
  gender_filter VARCHAR(10) CHECK (gender_filter IN ('male', 'female')),
  age_min INTEGER CHECK (age_min >= 18),
  age_max INTEGER CHECK (age_max <= 100),
  result_user_ids UUID[] NOT NULL, -- Array of user IDs found in search
  total_results INTEGER NOT NULL DEFAULT 0,
  search_hash VARCHAR(64) NOT NULL, -- Hash of search parameters for quick lookup
  computed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW() + INTERVAL '1 hour'),
  is_valid BOOLEAN DEFAULT TRUE,
  
  -- Ensure search parameters are valid
  CONSTRAINT check_age_range CHECK (age_min IS NULL OR age_max IS NULL OR age_min <= age_max)
);

-- Create indexes for user_search_cache
CREATE INDEX idx_user_search_cache_searcher ON user_search_cache(searcher_id, expires_at, is_valid);
CREATE INDEX idx_user_search_cache_hash ON user_search_cache(search_hash, expires_at) WHERE is_valid = TRUE;
CREATE INDEX idx_user_search_cache_location ON user_search_cache(search_latitude, search_longitude, search_radius_km) WHERE is_valid = TRUE;
CREATE INDEX idx_user_search_cache_expires ON user_search_cache(expires_at) WHERE is_valid = TRUE;

-- User activity radius cache table
-- This table caches user's typical activity areas for location-based optimizations
CREATE TABLE user_activity_radius_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  center_latitude DECIMAL(10, 8) NOT NULL,
  center_longitude DECIMAL(11, 8) NOT NULL,
  activity_radius_km DECIMAL(8, 3) NOT NULL CHECK (activity_radius_km > 0),
  location_count INTEGER NOT NULL DEFAULT 1,
  first_activity_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  computed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW() + INTERVAL '7 days'),
  is_active BOOLEAN DEFAULT TRUE,
  
  -- One active radius per user
  CONSTRAINT unique_active_user_radius UNIQUE (user_id, is_active) DEFERRABLE INITIALLY DEFERRED
);

-- Create indexes for user_activity_radius_cache
CREATE INDEX idx_user_activity_radius_user ON user_activity_radius_cache(user_id, is_active);
CREATE INDEX idx_user_activity_radius_location ON user_activity_radius_cache(center_latitude, center_longitude, activity_radius_km) WHERE is_active = TRUE;
CREATE INDEX idx_user_activity_radius_expires ON user_activity_radius_cache(expires_at) WHERE is_active = TRUE;

-- ============================================================================
-- AUTOMATED PARTITION AND CACHE MANAGEMENT FUNCTIONS
-- ============================================================================

-- Function to automatically create monthly partitions for the next N months
CREATE OR REPLACE FUNCTION create_monthly_partitions(
  table_name TEXT,
  months_ahead INTEGER DEFAULT 3
)
RETURNS void AS $$
DECLARE
  start_date DATE;
  end_date DATE;
  partition_name TEXT;
  i INTEGER;
BEGIN
  -- Start from the first day of next month
  start_date := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
  
  FOR i IN 1..months_ahead LOOP
    end_date := start_date + INTERVAL '1 month';
    partition_name := table_name || '_' || TO_CHAR(start_date, 'YYYY_MM');
    
    -- Check if partition already exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c 
      JOIN pg_namespace n ON n.oid = c.relnamespace 
      WHERE c.relname = partition_name AND n.nspname = 'public'
    ) THEN
      EXECUTE format('CREATE TABLE %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
        partition_name, table_name, start_date, end_date);
      
      RAISE NOTICE 'Created partition % for table %', partition_name, table_name;
    END IF;
    
    start_date := end_date;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically create partitions for messages and notification_history
CREATE OR REPLACE FUNCTION maintain_table_partitions()
RETURNS void AS $$
BEGIN
  -- Create partitions for messages table
  PERFORM create_monthly_partitions('messages', 6);
  
  -- Create partitions for notification_history table
  PERFORM create_monthly_partitions('notification_history', 6);
  
  RAISE NOTICE 'Partition maintenance completed';
END;
$$ LANGUAGE plpgsql;

-- Function to drop old partitions (older than specified months)
CREATE OR REPLACE FUNCTION drop_old_partitions(
  table_name TEXT,
  months_to_keep INTEGER DEFAULT 12
)
RETURNS void AS $$
DECLARE
  cutoff_date DATE;
  partition_record RECORD;
  dropped_count INTEGER := 0;
BEGIN
  cutoff_date := DATE_TRUNC('month', CURRENT_DATE - (months_to_keep * INTERVAL '1 month'));
  
  -- Find and drop old partitions
  FOR partition_record IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename LIKE table_name || '_%'
    AND tablename ~ '\d{4}_\d{2}$'
    AND TO_DATE(RIGHT(tablename, 7), 'YYYY_MM') < cutoff_date
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS %I.%I CASCADE', 
      partition_record.schemaname, partition_record.tablename);
    
    dropped_count := dropped_count + 1;
    RAISE NOTICE 'Dropped old partition: %', partition_record.tablename;
  END LOOP;
  
  RAISE NOTICE 'Dropped % old partitions for table %', dropped_count, table_name;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_caches()
RETURNS void AS $$
DECLARE
  cleaned_matching INTEGER := 0;
  cleaned_search INTEGER := 0;
  cleaned_activity INTEGER := 0;
BEGIN
  -- Clean up expired matching candidates cache
  DELETE FROM matching_candidates_cache 
  WHERE expires_at < TIMEZONE('utc', NOW()) OR is_valid = FALSE;
  
  GET DIAGNOSTICS cleaned_matching = ROW_COUNT;
  
  -- Clean up expired user search cache
  DELETE FROM user_search_cache 
  WHERE expires_at < TIMEZONE('utc', NOW()) OR is_valid = FALSE;
  
  GET DIAGNOSTICS cleaned_search = ROW_COUNT;
  
  -- Clean up expired user activity radius cache
  DELETE FROM user_activity_radius_cache 
  WHERE expires_at < TIMEZONE('utc', NOW()) OR is_active = FALSE;
  
  GET DIAGNOSTICS cleaned_activity = ROW_COUNT;
  
  RAISE NOTICE 'Cache cleanup completed - Matching: %, Search: %, Activity: %', 
    cleaned_matching, cleaned_search, cleaned_activity;
END;
$$ LANGUAGE plpgsql;

-- Function to invalidate user-specific caches (when user data changes)
CREATE OR REPLACE FUNCTION invalidate_user_caches(target_user_id UUID)
RETURNS void AS $$
BEGIN
  -- Invalidate matching candidates cache for this user
  UPDATE matching_candidates_cache 
  SET is_valid = FALSE, expires_at = TIMEZONE('utc', NOW())
  WHERE searcher_id = target_user_id OR candidate_id = target_user_id;
  
  -- Invalidate search cache for this user
  UPDATE user_search_cache 
  SET is_valid = FALSE, expires_at = TIMEZONE('utc', NOW())
  WHERE searcher_id = target_user_id;
  
  -- Invalidate activity radius cache for this user
  UPDATE user_activity_radius_cache 
  SET is_active = FALSE, expires_at = TIMEZONE('utc', NOW())
  WHERE user_id = target_user_id;
  
  RAISE NOTICE 'Invalidated caches for user: %', target_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh matching candidates cache for a user
CREATE OR REPLACE FUNCTION refresh_matching_candidates_cache(target_user_id UUID)
RETURNS void AS $$
BEGIN
  -- First invalidate existing cache
  PERFORM invalidate_user_caches(target_user_id);
  
  -- Note: The actual cache population would be handled by the application
  -- This function just prepares the cache for refresh
  
  RAISE NOTICE 'Matching candidates cache prepared for refresh for user: %', target_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SCHEDULER SETUP FOR AUTOMATED MAINTENANCE
-- ============================================================================

-- Note: PostgreSQL does not have built-in job scheduling like SQL Server or Oracle.
-- For production environments, you should use one of the following approaches:
--
-- 1. pg_cron extension (if available):
--    CREATE EXTENSION IF NOT EXISTS pg_cron;
--    SELECT cron.schedule('partition-maintenance', '0 2 1 * *', 'SELECT maintain_table_partitions();');
--    SELECT cron.schedule('cache-cleanup', '0 3 * * *', 'SELECT cleanup_expired_caches();');
--    SELECT cron.schedule('old-partition-cleanup', '0 4 1 * *', 'SELECT drop_old_partitions(''messages'', 12); SELECT drop_old_partitions(''notification_history'', 6);');
--
-- 2. External cron job calling psql:
--    # Add to system crontab (crontab -e):
--    # 0 2 1 * * psql -d otgit_db -c "SELECT maintain_table_partitions();"
--    # 0 3 * * * psql -d otgit_db -c "SELECT cleanup_expired_caches();"
--    # 0 4 1 * * psql -d otgit_db -c "SELECT drop_old_partitions('messages', 12); SELECT drop_old_partitions('notification_history', 6);"
--
-- 3. Application-level scheduling (NestJS with @nestjs/schedule):
--    - Create a scheduled service that calls these functions periodically
--    - This is the recommended approach for this project
--
-- For now, we create a convenience function to run all maintenance tasks manually:

CREATE OR REPLACE FUNCTION run_maintenance_tasks()
RETURNS void AS $$
BEGIN
  -- Create new partitions
  PERFORM maintain_table_partitions();
  
  -- Clean up expired caches
  PERFORM cleanup_expired_caches();
  
  -- Clean up old phone verifications
  PERFORM cleanup_expired_verifications();
  
  -- Clean up old seen_users records
  PERFORM cleanup_old_seen_users();
  
  RAISE NOTICE 'All maintenance tasks completed successfully';
END;
$$ LANGUAGE plpgsql;

-- Function to get maintenance status and statistics
CREATE OR REPLACE FUNCTION get_maintenance_status()
RETURNS TABLE(
  task_name TEXT,
  status TEXT,
  details TEXT
) AS $$
BEGIN
  -- Check partition count
  RETURN QUERY SELECT 
    'Messages Partitions'::TEXT,
    'INFO'::TEXT,
    ('Total: ' || COUNT(*)::TEXT)
  FROM pg_tables 
  WHERE schemaname = 'public' AND tablename LIKE 'messages_%';
  
  RETURN QUERY SELECT 
    'Notification History Partitions'::TEXT,
    'INFO'::TEXT,
    ('Total: ' || COUNT(*)::TEXT)
  FROM pg_tables 
  WHERE schemaname = 'public' AND tablename LIKE 'notification_history_%';
  
  -- Check cache sizes
  RETURN QUERY SELECT 
    'Matching Candidates Cache'::TEXT,
    'INFO'::TEXT,
    ('Valid entries: ' || COUNT(*)::TEXT)
  FROM matching_candidates_cache 
  WHERE is_valid = TRUE AND expires_at > TIMEZONE('utc', NOW());
  
  RETURN QUERY SELECT 
    'User Search Cache'::TEXT,
    'INFO'::TEXT,
    ('Valid entries: ' || COUNT(*)::TEXT)
  FROM user_search_cache 
  WHERE is_valid = TRUE AND expires_at > TIMEZONE('utc', NOW());
  
  RETURN QUERY SELECT 
    'User Activity Radius Cache'::TEXT,
    'INFO'::TEXT,
    ('Active entries: ' || COUNT(*)::TEXT)
  FROM user_activity_radius_cache 
  WHERE is_active = TRUE AND expires_at > TIMEZONE('utc', NOW());
  
  -- Check for expired entries that need cleanup
  RETURN QUERY SELECT 
    'Expired Caches'::TEXT,
    CASE WHEN COUNT(*) > 100 THEN 'WARNING' ELSE 'OK' END::TEXT,
    ('Expired entries needing cleanup: ' || COUNT(*)::TEXT)
  FROM (
    SELECT 1 FROM matching_candidates_cache WHERE is_valid = FALSE OR expires_at <= TIMEZONE('utc', NOW())
    UNION ALL
    SELECT 1 FROM user_search_cache WHERE is_valid = FALSE OR expires_at <= TIMEZONE('utc', NOW())
    UNION ALL
    SELECT 1 FROM user_activity_radius_cache WHERE is_active = FALSE OR expires_at <= TIMEZONE('utc', NOW())
  ) expired_entries;
END;
$$ LANGUAGE plpgsql;