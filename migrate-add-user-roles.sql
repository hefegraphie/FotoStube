
-- Migration: Add role column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'User';

-- Set existing demo user as Admin
UPDATE users SET role = 'Admin' WHERE email = 'demo@example.com';
