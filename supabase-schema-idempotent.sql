-- PostApprove - Idempotent Database Schema Setup
-- This script can be run multiple times safely without errors
-- Updated for social media post approval (instead of image approval)

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create campaigns table (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns') THEN
        CREATE TABLE campaigns (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name TEXT NOT NULL,
            instructions TEXT NOT NULL,
            approval_completed BOOLEAN DEFAULT FALSE,
            approval_completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Create index for campaigns
        CREATE INDEX idx_campaigns_created_at ON campaigns(created_at);
        
        -- Enable RLS on campaigns
        ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
        
        -- Create policy for campaigns (public access for simplicity)
        CREATE POLICY "Allow all operations on campaigns" ON campaigns
        FOR ALL USING (true) WITH CHECK (true);
        
        RAISE NOTICE 'Created campaigns table with indexes and policies';
    ELSE
        RAISE NOTICE 'Campaigns table already exists, skipping creation';
    END IF;
END $$;

-- Create posts table (updated from images) (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'posts') THEN
        CREATE TABLE posts (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
            filename TEXT NOT NULL,
            url TEXT NOT NULL,
            approved BOOLEAN DEFAULT NULL,
            comments TEXT DEFAULT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Create indexes for posts
        CREATE INDEX idx_posts_campaign_id ON posts(campaign_id);
        CREATE INDEX idx_posts_created_at ON posts(created_at);
        
        -- Enable RLS on posts
        ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
        
        -- Create policy for posts (public access for simplicity)
        CREATE POLICY "Allow all operations on posts" ON posts
        FOR ALL USING (true) WITH CHECK (true);
        
        RAISE NOTICE 'Created posts table with indexes and policies';
    ELSE
        RAISE NOTICE 'Posts table already exists, skipping creation';
    END IF;
END $$;

-- Add missing columns to campaigns table if they don't exist (idempotent)
DO $$ 
BEGIN
    -- Add approval_completed column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'campaigns' AND column_name = 'approval_completed'
    ) THEN
        ALTER TABLE campaigns ADD COLUMN approval_completed BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added approval_completed column to campaigns table';
    END IF;

    -- Add approval_completed_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'campaigns' AND column_name = 'approval_completed_at'
    ) THEN
        ALTER TABLE campaigns ADD COLUMN approval_completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
        RAISE NOTICE 'Added approval_completed_at column to campaigns table';
    END IF;
END $$;

-- Migration: Handle existing 'images' table if it exists
DO $$ 
BEGIN
    -- If images table exists but posts table doesn't, rename it
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'images') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'posts') THEN
        
        -- Rename the table
        ALTER TABLE images RENAME TO posts;
        
        -- Rename the index
        ALTER INDEX IF EXISTS idx_images_campaign_id RENAME TO idx_posts_campaign_id;
        ALTER INDEX IF EXISTS idx_images_created_at RENAME TO idx_posts_created_at;
        
        -- Update the policy name (drop old, create new)
        DROP POLICY IF EXISTS "Allow all operations on images" ON posts;
        CREATE POLICY "Allow all operations on posts" ON posts
        FOR ALL USING (true) WITH CHECK (true);
        
        RAISE NOTICE 'Migrated images table to posts table';
        
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'images') 
          AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'posts') THEN
        
        RAISE WARNING 'Both images and posts tables exist. Manual intervention may be required.';
        
    END IF;
END $$;

-- Create storage bucket for posts (idempotent)
-- Note: This needs to be run in Supabase Storage section or via API
DO $$ 
BEGIN
    -- Check if bucket exists and create if not
    IF NOT EXISTS (
        SELECT 1 FROM storage.buckets WHERE id = 'posts'
    ) THEN
        INSERT INTO storage.buckets (id, name, public) VALUES ('posts', 'posts', true);
        RAISE NOTICE 'Created posts storage bucket';
    ELSE
        RAISE NOTICE 'Posts storage bucket already exists';
    END IF;
    
    -- Remove old images bucket if it exists and posts bucket is created
    IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'images') 
       AND EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'posts') THEN
        RAISE WARNING 'Both images and posts buckets exist. Consider migrating files and removing images bucket manually.';
    END IF;
END $$;

-- Storage policies for posts bucket (idempotent)
DO $$ 
BEGIN
    -- Create read policy if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Public read access to posts'
    ) THEN
        CREATE POLICY "Public read access to posts" ON storage.objects
        FOR SELECT USING (bucket_id = 'posts');
        RAISE NOTICE 'Created read policy for posts bucket';
    END IF;
    
    -- Create insert policy if it doesn't exist  
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Public insert access to posts'
    ) THEN
        CREATE POLICY "Public insert access to posts" ON storage.objects
        FOR INSERT WITH CHECK (bucket_id = 'posts');
        RAISE NOTICE 'Created insert policy for posts bucket';
    END IF;
    
    -- Clean up old image policies if they exist
    DROP POLICY IF EXISTS "Public read access" ON storage.objects;
    DROP POLICY IF EXISTS "Public insert access" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated insert access" ON storage.objects;
END $$;

-- Final verification and summary
DO $$ 
DECLARE
    campaign_count INTEGER;
    posts_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO campaign_count FROM information_schema.tables WHERE table_name = 'campaigns';
    SELECT COUNT(*) INTO posts_count FROM information_schema.tables WHERE table_name = 'posts';
    
    RAISE NOTICE '=== PostApprove Database Setup Complete ===';
    RAISE NOTICE 'Campaigns table exists: %', CASE WHEN campaign_count > 0 THEN 'YES' ELSE 'NO' END;
    RAISE NOTICE 'Posts table exists: %', CASE WHEN posts_count > 0 THEN 'YES' ELSE 'NO' END;
    RAISE NOTICE 'Schema is ready for PostApprove application';
    RAISE NOTICE '==========================================';
END $$;
