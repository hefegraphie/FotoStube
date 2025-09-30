
-- Migration: Add notifications table
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  gallery_id UUID REFERENCES galleries(id),
  photo_id UUID REFERENCES photos(id),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  actor_name TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
