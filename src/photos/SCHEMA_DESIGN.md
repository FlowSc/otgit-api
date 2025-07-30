# Photo Database Schema Design

This document outlines the database schema design for profile photos and travel photos in the dating app.

## Overview

The photo system consists of two main tables:
1. **`profile_photos`** - One profile picture per user
2. **`travel_photos`** - Multiple travel photos per user with geolocation data

## Schema Details

### Profile Photos Table (`profile_photos`)

Stores one profile picture per user with the ability to replace/update.

**Key Features:**
- One active profile photo per user (enforced by unique constraint)
- Soft deletion/replacement using `is_active` flag
- CASCADE deletion when user is deleted
- File metadata storage (size, type, storage path)

**Important Constraints:**
- `UNIQUE (user_id, is_active)` - Ensures only one active profile photo per user
- Foreign key to `users.id` with CASCADE delete

### Travel Photos Table (`travel_photos`)

Stores multiple travel photos per user with required geolocation data.

**Key Features:**
- Required latitude/longitude coordinates with validation
- Optional metadata (title, description, location name, taken date)
- Privacy controls (`is_public` flag)
- Soft deletion (`is_deleted` flag)
- Optimized for geo-queries with spatial indexing

**Geolocation Constraints:**
- `latitude` between -90 and 90 degrees
- `longitude` between -180 and 180 degrees
- Indexed for efficient location-based queries

## Indexes

### Profile Photos
- `idx_profile_photos_user_id` - Fast user lookup
- `idx_profile_photos_active` - Fast active photo lookup

### Travel Photos
- `idx_travel_photos_user_id` - Fast user lookup
- `idx_travel_photos_location` - Geolocation queries (lat, lng)
- `idx_travel_photos_public` - Public/deleted status filtering
- `idx_travel_photos_taken_at` - Chronological sorting

## Optional PostGIS Enhancement

For advanced geospatial queries, PostGIS extension can be enabled:
- Adds `geom GEOMETRY(POINT, 4326)` column
- Enables radius searches, distance calculations
- Provides GIST spatial indexing for better performance

## API Design Considerations

### Profile Photos
- **Upload**: Replace existing active photo (set old to inactive)
- **Delete**: Set `is_active = false` (soft delete)
- **Get**: Return only active photo per user

### Travel Photos
- **Upload**: Require lat/lng coordinates
- **Query**: Support bounding box and radius searches
- **Update**: Allow metadata updates, location changes
- **Delete**: Soft delete using `is_deleted = true`

## Storage Integration

Both tables include:
- `file_url` - Public URL for accessing the image
- `storage_path` - Internal storage bucket path
- `file_name` - Original filename
- `file_size` - File size in bytes
- `mime_type` - Image MIME type validation

## Security Considerations

1. **File Upload Validation**:
   - Validate MIME types (only allow image types)
   - Limit file sizes
   - Sanitize file names

2. **Privacy Controls**:
   - `is_public` flag for travel photos
   - User-specific access controls
   - Soft deletion for data retention

3. **Geolocation Privacy**:
   - Consider precision limitations for privacy
   - Allow users to adjust location accuracy
   - Respect user privacy settings

## Performance Optimizations

1. **Database Indexes**: Optimized for common query patterns
2. **Spatial Indexing**: Optional PostGIS for advanced geo-queries
3. **Soft Deletion**: Maintains referential integrity
4. **Trigger Functions**: Automatic timestamp updates

## Migration Strategy

1. Run the SQL schema in Supabase Dashboard
2. Test with sample data
3. Implement API endpoints using provided DTOs
4. Add file upload/storage integration
5. Consider PostGIS upgrade for advanced features