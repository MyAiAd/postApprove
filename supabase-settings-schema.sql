-- Idempotent script to create settings table for storing OpenAI API key
-- Run this in your Supabase SQL Editor

-- Create settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create or replace function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
CREATE TRIGGER update_settings_updated_at
    BEFORE UPDATE ON settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create index on key column for faster lookups
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- Enable Row Level Security
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust based on your auth requirements)
-- If you want to restrict access, modify these policies
DROP POLICY IF EXISTS "Allow all operations on settings" ON settings;
CREATE POLICY "Allow all operations on settings" ON settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Insert or update the OpenAI API key (example - you'll set the actual value via the app)
-- This is just a placeholder to show the structure
INSERT INTO settings (key, value)
VALUES ('openai_api_key', 'your-api-key-here')
ON CONFLICT (key)
DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- Helper function to get a setting value
CREATE OR REPLACE FUNCTION get_setting(setting_key TEXT)
RETURNS TEXT AS $$
DECLARE
  setting_value TEXT;
BEGIN
  SELECT value INTO setting_value
  FROM settings
  WHERE key = setting_key;
  
  RETURN setting_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to set a setting value
CREATE OR REPLACE FUNCTION set_setting(setting_key TEXT, setting_value TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO settings (key, value)
  VALUES (setting_key, setting_value)
  ON CONFLICT (key)
  DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON settings TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_setting(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION set_setting(TEXT, TEXT) TO anon, authenticated;

