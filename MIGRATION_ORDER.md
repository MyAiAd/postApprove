# Database Migration Order

Run these SQL scripts in your Supabase SQL Editor in this exact order:

## 1. Base Schema (if not already run)
**File:** `supabase-schema-idempotent.sql`
- Creates `campaigns` and `posts` tables
- Basic structure

## 2. Title/Body Approval Fields
**File:** `supabase-add-title-body-approval.sql`
- Adds `title_approved`, `title_comments`
- Adds `body_approved`, `body_comments`
- Required for detail page approval

## 3. Calendar Feature
**File:** `supabase-calendar-schema.sql`
- Creates `calendars` table
- Adds `calendar_id`, `day_number`, `assigned_date` to campaigns
- Required for calendar feature

---

## Quick Fix for Your Current Error:

You're missing the title/body approval columns. Run this SQL now:

```sql
-- Add title and body approval fields to campaigns table

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
```

After running this, your error should be fixed!

