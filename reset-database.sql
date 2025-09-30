
-- Drop all tables in correct order (respecting foreign key constraints)
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS photo_likes CASCADE;
DROP TABLE IF EXISTS photos CASCADE;
DROP TABLE IF EXISTS galleries CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT NOT NULL
);

-- Create galleries table with parent_id for sub-galleries
CREATE TABLE galleries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  parent_id UUID REFERENCES galleries(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create photos table
CREATE TABLE photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  alt TEXT NOT NULL,
  file_path TEXT,
  gallery_id UUID NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
  rating INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create photo_likes table
CREATE TABLE photo_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_id UUID NOT NULL REFERENCES photos(id),
  is_liked BOOLEAN NOT NULL DEFAULT false
);

-- Create comments table
CREATE TABLE comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_id UUID NOT NULL REFERENCES photos(id),
  commenter_name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert demo user
INSERT INTO users (username, email, password, name) 
VALUES ('demo', 'demo@example.com', 'demo123', 'Demo User');
