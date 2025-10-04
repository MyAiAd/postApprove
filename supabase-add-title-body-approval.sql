-- Add approval fields for post title and body to campaigns table
-- This allows clients to approve/disapprove the title and body separately

DO $$ 
BEGIN
    -- Add title_approved column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'campaigns' AND column_name = 'title_approved'
    ) THEN
        ALTER TABLE campaigns ADD COLUMN title_approved BOOLEAN DEFAULT NULL;
        RAISE NOTICE 'Added title_approved column to campaigns table';
    END IF;

    -- Add title_comments column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'campaigns' AND column_name = 'title_comments'
    ) THEN
        ALTER TABLE campaigns ADD COLUMN title_comments TEXT DEFAULT NULL;
        RAISE NOTICE 'Added title_comments column to campaigns table';
    END IF;

    -- Add body_approved column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'campaigns' AND column_name = 'body_approved'
    ) THEN
        ALTER TABLE campaigns ADD COLUMN body_approved BOOLEAN DEFAULT NULL;
        RAISE NOTICE 'Added body_approved column to campaigns table';
    END IF;

    -- Add body_comments column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'campaigns' AND column_name = 'body_comments'
    ) THEN
        ALTER TABLE campaigns ADD COLUMN body_comments TEXT DEFAULT NULL;
        RAISE NOTICE 'Added body_comments column to campaigns table';
    END IF;
END $$;

-- Verification
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'campaigns' 
  AND column_name IN ('title_approved', 'title_comments', 'body_approved', 'body_comments')
ORDER BY column_name;

