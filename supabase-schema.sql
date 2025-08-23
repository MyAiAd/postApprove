-- Create campaigns table
CREATE TABLE campaigns (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    instructions TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create images table
CREATE TABLE images (
    id UUID PRIMARY KEY,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    url TEXT NOT NULL,
    approved BOOLEAN DEFAULT NULL,
    comments TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_images_campaign_id ON images(campaign_id);
CREATE INDEX idx_campaigns_created_at ON campaigns(created_at);
CREATE INDEX idx_images_created_at ON images(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE images ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is a simple app without auth)
-- In a production environment, you might want to add proper authentication

-- Allow all operations on campaigns table
CREATE POLICY "Allow all operations on campaigns" ON campaigns
FOR ALL USING (true) WITH CHECK (true);

-- Allow all operations on images table
CREATE POLICY "Allow all operations on images" ON images
FOR ALL USING (true) WITH CHECK (true);

-- Create storage bucket for images (run this in the Supabase Storage section)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('images', 'images', true);

-- Storage policies (add these in the Storage > Policies section)
-- CREATE POLICY "Public read access" ON storage.objects
-- FOR SELECT USING (bucket_id = 'images');

-- CREATE POLICY "Public insert access" ON storage.objects
-- FOR INSERT WITH CHECK (bucket_id = 'images'); 