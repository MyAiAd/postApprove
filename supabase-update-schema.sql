-- Add approval tracking columns to campaigns table (idempotent)
DO $$ 
BEGIN
    -- Add approval_completed column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'campaigns' AND column_name = 'approval_completed'
    ) THEN
        ALTER TABLE campaigns ADD COLUMN approval_completed BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add approval_completed_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'campaigns' AND column_name = 'approval_completed_at'
    ) THEN
        ALTER TABLE campaigns ADD COLUMN approval_completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    END IF;
END $$; 