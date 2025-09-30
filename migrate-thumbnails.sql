
-- Add thumbnail path columns to existing photos
ALTER TABLE photos 
ADD COLUMN IF NOT EXISTS thumbnail_path TEXT,
ADD COLUMN IF NOT EXISTS medium_path TEXT;
