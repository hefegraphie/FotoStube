
-- Migration: Add branding settings table
CREATE TABLE IF NOT EXISTS branding_settings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'PhotoGallery',
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Insert default branding
INSERT INTO branding_settings (company_name) VALUES ('PhotoGallery')
ON CONFLICT DO NOTHING;
