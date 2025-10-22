
-- Migration: Add gallery assignments table
CREATE TABLE IF NOT EXISTS gallery_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id UUID NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(gallery_id, user_id)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_gallery_assignments_gallery_id ON gallery_assignments(gallery_id);
CREATE INDEX IF NOT EXISTS idx_gallery_assignments_user_id ON gallery_assignments(user_id);
