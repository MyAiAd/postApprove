# PostApprove - Social Media Post Approval System

A simple Next.js application for client social media post approval workflows using Supabase and Resend.

## Features

- **Upload Page**: Upload campaign social media posts with name and instructions
- **Approval Page**: Client-friendly interface for approving/disapproving posts
- **Email Notifications**: Automatic email notifications when reviews are complete
- **Comments System**: Clients can provide feedback on disapproved posts

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Email Configuration (using Resend)
RESEND_API_KEY=your_resend_api_key

# App Configuration
ADMIN_EMAIL=Jenny@MyAi.ad
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Supabase Setup

1. Create a new Supabase project
2. Run the SQL commands provided in `supabase-schema.sql` in your Supabase SQL Editor
3. Set up storage bucket for images (see Storage Setup section below)

### 4. Resend Setup

1. Sign up for [Resend](https://resend.com)
2. Add your API key to the environment variables
3. Verify your sending domain in Resend dashboard

### 5. Run the Application

```bash
npm run dev
```

Visit `http://localhost:3000` to access the upload page.

## Usage

### For Admins (Upload Page)
1. Enter campaign name and client instructions
2. Upload social media posts for approval
3. Share the generated approval link with your client

### For Clients (Approval Page)
1. Visit the approval link provided
2. Review each post with Yes/No radio buttons
3. Add comments for disapproved posts
4. Submit all approvals when complete

## Deployment

This app is ready for deployment on Vercel:

1. Push your code to GitHub
2. Connect your GitHub repo to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

## Storage Setup in Supabase

1. Go to Storage in your Supabase dashboard
2. Create a new bucket called `posts`
3. Set the bucket to public
4. Add this RLS policy for the posts bucket:

```sql
-- Allow public read access to posts
CREATE POLICY "Public read access" ON storage.objects
FOR SELECT USING (bucket_id = 'posts');

-- Allow authenticated insert access to posts
CREATE POLICY "Authenticated insert access" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'posts');
``` # Deployment trigger Sun Oct  5 12:52:18 PM WEST 2025
