-- PostApprove - Calendar Feature Database Schema
-- Idempotent migration script for calendar-based content approval system
-- This script can be run multiple times safely without errors

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- CREATE CALENDARS TABLE
-- =====================================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calendars') THEN
        CREATE TABLE calendars (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name TEXT NOT NULL,
            month TEXT NOT NULL,  -- Format: 'YYYY-MM' e.g., '2025-01'
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            approval_completed BOOLEAN DEFAULT FALSE,
            approval_completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
        );
        
        -- Create indexes for calendars
        CREATE INDEX idx_calendars_month ON calendars(month);
        CREATE INDEX idx_calendars_created_at ON calendars(created_at);
        
        -- Enable RLS on calendars
        ALTER TABLE calendars ENABLE ROW LEVEL SECURITY;
        
        -- Create policy for calendars (public access for simplicity)
        CREATE POLICY "Allow all operations on calendars" ON calendars
        FOR ALL USING (true) WITH CHECK (true);
        
        RAISE NOTICE 'Created calendars table with indexes and policies';
    ELSE
        RAISE NOTICE 'Calendars table already exists, skipping creation';
    END IF;
END $$;

-- =====================================================
-- ADD CALENDAR-RELATED COLUMNS TO CAMPAIGNS TABLE
-- =====================================================
DO $$ 
BEGIN
    -- Add calendar_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'campaigns' AND column_name = 'calendar_id'
    ) THEN
        ALTER TABLE campaigns ADD COLUMN calendar_id UUID REFERENCES calendars(id) ON DELETE CASCADE;
        CREATE INDEX idx_campaigns_calendar_id ON campaigns(calendar_id);
        RAISE NOTICE 'Added calendar_id column to campaigns table with index';
    ELSE
        RAISE NOTICE 'calendar_id column already exists in campaigns table';
    END IF;

    -- Add day_number column if it doesn't exist (1-31 for day of month)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'campaigns' AND column_name = 'day_number'
    ) THEN
        ALTER TABLE campaigns ADD COLUMN day_number INTEGER CHECK (day_number >= 1 AND day_number <= 31);
        RAISE NOTICE 'Added day_number column to campaigns table';
    ELSE
        RAISE NOTICE 'day_number column already exists in campaigns table';
    END IF;

    -- Add assigned_date column if it doesn't exist (for drag-drop date assignment)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'campaigns' AND column_name = 'assigned_date'
    ) THEN
        ALTER TABLE campaigns ADD COLUMN assigned_date DATE;
        CREATE INDEX idx_campaigns_assigned_date ON campaigns(assigned_date);
        RAISE NOTICE 'Added assigned_date column to campaigns table with index';
    ELSE
        RAISE NOTICE 'assigned_date column already exists in campaigns table';
    END IF;
END $$;

-- =====================================================
-- HELPER FUNCTION: Get calendar statistics
-- =====================================================
CREATE OR REPLACE FUNCTION get_calendar_stats(p_calendar_id UUID)
RETURNS TABLE (
    total_posts INTEGER,
    approved_titles INTEGER,
    disapproved_titles INTEGER,
    pending_titles INTEGER,
    posts_with_detail INTEGER,
    fully_approved INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER AS total_posts,
        COUNT(CASE WHEN c.title_approved = true THEN 1 END)::INTEGER AS approved_titles,
        COUNT(CASE WHEN c.title_approved = false THEN 1 END)::INTEGER AS disapproved_titles,
        COUNT(CASE WHEN c.title_approved IS NULL THEN 1 END)::INTEGER AS pending_titles,
        COUNT(CASE WHEN EXISTS (
            SELECT 1 FROM posts p WHERE p.campaign_id = c.id
        ) THEN 1 END)::INTEGER AS posts_with_detail,
        COUNT(CASE WHEN c.title_approved = true 
            AND c.body_approved = true 
            AND NOT EXISTS (
                SELECT 1 FROM posts p 
                WHERE p.campaign_id = c.id AND p.approved = false
            )
            AND (NOT EXISTS (SELECT 1 FROM posts p WHERE p.campaign_id = c.id)
                OR EXISTS (SELECT 1 FROM posts p WHERE p.campaign_id = c.id AND p.approved = true))
            THEN 1 END)::INTEGER AS fully_approved
    FROM campaigns c
    WHERE c.calendar_id = p_calendar_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================
COMMENT ON TABLE calendars IS 'Monthly content calendars containing 31 posts';
COMMENT ON COLUMN calendars.month IS 'Month identifier in YYYY-MM format';
COMMENT ON COLUMN campaigns.calendar_id IS 'Links campaign to a calendar (NULL for standalone posts)';
COMMENT ON COLUMN campaigns.day_number IS 'Day of month (1-31) for calendar posts';
COMMENT ON COLUMN campaigns.assigned_date IS 'Specific date assigned via drag-drop (flexible scheduling)';

-- =====================================================
-- VERIFICATION AND SUMMARY
-- =====================================================
DO $$ 
DECLARE
    calendars_count INTEGER;
    campaigns_count INTEGER;
    calendar_id_exists BOOLEAN;
    day_number_exists BOOLEAN;
    assigned_date_exists BOOLEAN;
BEGIN
    SELECT COUNT(*) INTO calendars_count FROM information_schema.tables WHERE table_name = 'calendars';
    SELECT COUNT(*) INTO campaigns_count FROM information_schema.tables WHERE table_name = 'campaigns';
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'campaigns' AND column_name = 'calendar_id'
    ) INTO calendar_id_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'campaigns' AND column_name = 'day_number'
    ) INTO day_number_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'campaigns' AND column_name = 'assigned_date'
    ) INTO assigned_date_exists;
    
    RAISE NOTICE '========================================================';
    RAISE NOTICE 'PostApprove Calendar Feature - Database Setup Complete';
    RAISE NOTICE '========================================================';
    RAISE NOTICE 'Calendars table exists: %', CASE WHEN calendars_count > 0 THEN 'YES ✓' ELSE 'NO ✗' END;
    RAISE NOTICE 'Campaigns table exists: %', CASE WHEN campaigns_count > 0 THEN 'YES ✓' ELSE 'NO ✗' END;
    RAISE NOTICE 'calendar_id column: %', CASE WHEN calendar_id_exists THEN 'YES ✓' ELSE 'NO ✗' END;
    RAISE NOTICE 'day_number column: %', CASE WHEN day_number_exists THEN 'YES ✓' ELSE 'NO ✗' END;
    RAISE NOTICE 'assigned_date column: %', CASE WHEN assigned_date_exists THEN 'YES ✓' ELSE 'NO ✗' END;
    RAISE NOTICE '========================================================';
    RAISE NOTICE 'Schema is ready for calendar-based content approval';
    RAISE NOTICE '========================================================';
END $$;

