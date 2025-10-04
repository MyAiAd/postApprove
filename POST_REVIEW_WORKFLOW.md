# PostApprove - Post Review Workflow Guide

## 🎯 Complete Step-by-Step Process for Adding Posts for Client Review

### 📋 **PHASE 1: Admin Creates Campaign (You)**

1. **Access Admin Dashboard**
   - Go to your PostApprove homepage: `https://your-app-url.vercel.app`
   - You'll see the admin interface with two sections:
     - Left: "Existing Campaigns" (shows previous campaigns)
     - Right: "Create New Campaign" (form to add new posts)

2. **Create New Campaign**
   - **Campaign Name**: Enter a descriptive name (e.g., "Q1 Social Media Posts", "Instagram Feed - January")
   - **Instructions for Client**: Write clear instructions for your client
     ```
     Example: "Please review these social media posts for our Q1 campaign. 
     Approve posts you're happy with, and provide specific feedback on any 
     posts that need changes. Focus on brand voice, visual consistency, and 
     message clarity."
     ```
   - **Select Posts**: Click "Choose Files" and select your social media post images
     - Supports multiple file selection (Ctrl/Cmd + click)
     - Accepts common image formats (JPG, PNG, GIF, etc.)
     - Upload all posts for the campaign at once

3. **Submit Campaign**
   - Click "Create Campaign" button
   - System will upload all posts and create the campaign
   - **Important**: You'll immediately get a shareable approval URL

4. **Get Approval Link**
   - After successful creation, you'll see:
     ```
     Campaign created! Share this approval link with your client:
     https://your-app-url.vercel.app/approve/[campaign-id]
     ```
   - **Copy this URL** - this is what you send to your client

### 📧 **PHASE 2: Share with Client**

5. **Send Approval Link to Client**
   - Email/message the approval URL to your client
   - Include any additional context they might need
   - Example email:
     ```
     Hi [Client Name],
     
     Your Q1 social media posts are ready for review! Please visit the link below 
     to approve or request changes:
     
     https://your-app-url.vercel.app/approve/abc123
     
     Instructions: [Your campaign instructions will appear on the page]
     
     Please review each post and let me know your feedback.
     
     Thanks!
     ```

### 👀 **PHASE 3: Client Reviews Posts**

6. **Client Opens Approval Page**
   - Client clicks the link and sees:
     - Campaign name and your instructions
     - All uploaded posts in a grid layout
     - For each post: Yes/No radio buttons + comment box

7. **Client Reviews Each Post**
   - **Approve**: Client selects "Yes" 
   - **Request Changes**: Client selects "No" and adds specific feedback
   - **Optional Comments**: Client can add comments even on approved posts
   - **Submit**: Once all posts are reviewed, client clicks "Submit All Approvals"

### 📬 **PHASE 4: You Get Notified**

8. **Automatic Email Notification**
   - When client submits, you automatically receive an email with:
     - Campaign name and completion date
     - Summary: X approved, Y disapproved out of Z total
     - Specific comments for each post
     - Link back to the approval page

### 📊 **PHASE 5: Admin Reviews Results**

9. **Check Campaign Status**
   - Return to your admin dashboard
   - In "Existing Campaigns" section, you'll see updated status:
     - ✅ **Client Review Complete**: Shows approval breakdown
     - **Approved with comments**: Lists specific feedback
     - **Disapproved with comments**: Shows what needs changes

10. **Take Action Based on Results**
    - **Approved posts**: Ready to publish/use
    - **Disapproved posts**: Make requested changes and create new campaign if needed
    - **Mixed results**: Proceed with approved posts, revise others

## 🔄 **ONGOING MANAGEMENT**

### **Campaign Dashboard Features**
- **View All Campaigns**: See chronological list of all campaigns
- **Campaign Status Indicators**:
  - 📷 "No images uploaded yet" - Empty campaign
  - ⏳ "Awaiting Client Review" - Client hasn't finished reviewing
  - 📝 "Review Complete - Awaiting Email Notification" - All reviewed, email sending
  - ✅ "Client Review Complete" - Fully processed with results
- **Approval URLs**: Always visible for easy re-sharing
- **Delete Campaigns**: Remove old campaigns (deletes posts from storage too)

### **Best Practices**

**For Campaign Names:**
- Use descriptive, dated names: "Instagram Posts - March 2024"
- Include client name if managing multiple clients: "ABC Corp - Q1 Campaign"

**For Instructions:**
- Be specific about what you want feedback on
- Set expectations: "Please focus on brand voice and visual consistency"
- Include deadlines: "Please review by Friday, March 15th"

**For File Organization:**
- Name your post files descriptively before upload
- Group related posts in single campaigns
- Consider separate campaigns for different platforms (Instagram vs LinkedIn)

## ⚡ **Quick Reference: Admin Workflow**

```
1. Go to PostApprove homepage
2. Fill out "Create New Campaign" form:
   - Campaign name
   - Client instructions  
   - Upload post files
3. Click "Create Campaign"
4. Copy the approval URL
5. Share URL with client
6. Wait for email notification
7. Review results in dashboard
8. Take action on feedback
```

## 🚨 **Important Notes**

- **One Campaign = One Review Cycle**: Each campaign is a single review session
- **All Posts Together**: Client must review all posts in a campaign before submitting
- **Permanent Links**: Approval URLs don't expire (bookmark for reference)
- **File Limits**: Check your hosting limits for file sizes/storage
- **Email Delivery**: Ensure `ADMIN_EMAIL` in your environment is correct

## 🔧 **Troubleshooting**

**If client can't access approval link:**
- Check the URL is complete and unbroken
- Verify your app is deployed and accessible
- Try opening in incognito/private browser window

**If you don't receive email notifications:**
- Check your spam folder
- Verify `RESEND_API_KEY` and `ADMIN_EMAIL` environment variables
- Check Resend dashboard for delivery status

**If posts don't upload:**
- Check file formats (should be image files)
- Verify Supabase storage bucket is set up correctly
- Check browser console for error messages

This workflow supports multiple clients, multiple campaigns, and provides a complete audit trail of all approvals and feedback!
