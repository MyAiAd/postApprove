'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, Campaign, Calendar } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

interface CampaignStats {
  total: number
  approved: number
  disapproved: number
  pending: number
  approvedWithComments: any[]
  disapprovedWithComments: any[]
}

interface CalendarStats {
  total: number
  approved: number
  disapproved: number
  pending: number
}

export default function UploadPage() {
  const router = useRouter()
  
  // Single Post state
  const [campaignName, setCampaignName] = useState('')
  const [instructions, setInstructions] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [campaignId, setCampaignId] = useState<string | null>(null)
  
  // Calendar state
  const [calendarName, setCalendarName] = useState('')
  const [calendarMonth, setCalendarMonth] = useState('2025-10')
  const [calendarText, setCalendarText] = useState('')
  const [creatingCalendar, setCreatingCalendar] = useState(false)
  const [calendarMessage, setCalendarMessage] = useState('')
  
  // AI Calendar state
  const [aiCalendarName, setAiCalendarName] = useState('')
  const [aiCalendarMonth, setAiCalendarMonth] = useState('2025-10')
  const [aiPrompt, setAiPrompt] = useState('')
  const [generatingTopics, setGeneratingTopics] = useState(false)
  const [generatedTopics, setGeneratedTopics] = useState<string[]>([])
  const [aiCalendarMessage, setAiCalendarMessage] = useState('')
  const [creatingAiCalendar, setCreatingAiCalendar] = useState(false)
  
  // Helper function to get days in month
  const getDaysInMonth = (yearMonth: string): number => {
    const [year, month] = yearMonth.split('-').map(Number)
    return new Date(year, month, 0).getDate()
  }
  
  const expectedDays = getDaysInMonth(calendarMonth)
  
  // Data state
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [loadingCampaigns, setLoadingCampaigns] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [campaignStats, setCampaignStats] = useState<Record<string, CampaignStats>>({})
  const [calendarStats, setCalendarStats] = useState<Record<string, CalendarStats>>({})

  useEffect(() => {
    loadCampaigns()
    loadCalendars()
  }, [])

  const loadCalendars = async () => {
    try {
      const { data, error } = await supabase
        .from('calendars')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setCalendars(data || [])

      // Load stats for each calendar
      if (data) {
        const statsPromises = data.map(async (calendar) => {
          const stats = await getCalendarStats(calendar.id)
          return { calendarId: calendar.id, stats }
        })

        const statsResults = await Promise.all(statsPromises)
        const statsMap: Record<string, CalendarStats> = {}
        statsResults.forEach(({ calendarId, stats }) => {
          statsMap[calendarId] = stats
        })
        setCalendarStats(statsMap)
      }
    } catch (error: any) {
      console.error('Error loading calendars:', error)
    }
  }

  const getCalendarStats = async (calendarId: string) => {
    try {
      const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select('title_approved, name')
        .eq('calendar_id', calendarId)

      if (error) throw error

      // Exclude "blank" campaigns from stats
      const realCampaigns = campaigns.filter(c => c.name !== 'blank')
      const total = realCampaigns.length
      const approved = realCampaigns.filter(c => c.title_approved === true).length
      const disapproved = realCampaigns.filter(c => c.title_approved === false).length
      const pending = realCampaigns.filter(c => c.title_approved === null).length

      return { total, approved, disapproved, pending }
    } catch (error) {
      console.error('Error getting calendar stats:', error)
      return { total: 0, approved: 0, disapproved: 0, pending: 0 }
    }
  }

  const loadCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .is('calendar_id', null)
        .order('created_at', { ascending: false })

      if (error) throw error
      setCampaigns(data || [])

      // Load stats for each campaign
      if (data) {
        const statsPromises = data.map(async (campaign) => {
          const stats = await getCampaignStats(campaign.id)
          return { campaignId: campaign.id, stats }
        })

        const statsResults = await Promise.all(statsPromises)
        const statsMap: Record<string, CampaignStats> = {}
        statsResults.forEach(({ campaignId, stats }) => {
          statsMap[campaignId] = stats
        })
        setCampaignStats(statsMap)
      }
    } catch (error: any) {
      console.error('Error loading campaigns:', error)
    } finally {
      setLoadingCampaigns(false)
    }
  }

  const getCampaignStats = async (campaignId: string) => {
    try {
      const { data: posts, error } = await supabase
        .from('posts')
        .select('approved, comments, filename')
        .eq('campaign_id', campaignId)

      if (error) throw error

      const total = posts.length
      const approved = posts.filter(post => post.approved === true).length
      const disapproved = posts.filter(post => post.approved === false).length
      const pending = posts.filter(post => post.approved === null).length

      // Get comments for display
      const approvedWithComments = posts.filter(post => post.approved === true && post.comments)
      const disapprovedWithComments = posts.filter(post => post.approved === false && post.comments)

      return { 
        total, 
        approved, 
        disapproved, 
        pending, 
        approvedWithComments, 
        disapprovedWithComments 
      }
    } catch (error) {
      console.error('Error getting campaign stats:', error)
      return { 
        total: 0, 
        approved: 0, 
        disapproved: 0, 
        pending: 0, 
        approvedWithComments: [], 
        disapprovedWithComments: [] 
      }
    }
  }

  const deleteCampaign = async (campaignToDelete: Campaign) => {
    if (!confirm(`Are you sure you want to delete the post "${campaignToDelete.name}"? This will also delete all associated images and cannot be undone.`)) {
      return
    }

    setDeleting(campaignToDelete.id)

    try {
      // Delete all posts from storage first
      const { data: posts } = await supabase
        .from('posts')
        .select('url')
        .eq('campaign_id', campaignToDelete.id)

      if (posts) {
        const deletePromises = posts.map(async (post) => {
          const filePath = post.url.split('/').pop() // Extract file path from URL
          if (filePath) {
            await supabase.storage
              .from('posts')
              .remove([`${campaignToDelete.id}/${filePath}`])
          }
        })
        await Promise.all(deletePromises)
      }

      // Delete campaign (this will cascade delete posts due to foreign key)
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignToDelete.id)

      if (error) throw error

      setMessage('Post deleted successfully!')
      loadCampaigns() // Reload campaigns list

    } catch (error: any) {
      console.error('Error deleting campaign:', error)
      setMessage(`Error deleting post: ${error.message}`)
    } finally {
      setDeleting(null)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!campaignName.trim() || !instructions.trim() || files.length === 0) {
      setMessage('Please fill in all fields and select at least one image.')
      return
    }

    setUploading(true)
    setMessage('')

    try {
      // Create campaign
      const newCampaignId = uuidv4()
      const { error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          id: newCampaignId,
          name: campaignName.trim(),
          instructions: instructions.trim()
        })

      if (campaignError) throw campaignError

      // Upload posts
      const postPromises = files.map(async (file) => {
        const fileExt = file.name.split('.').pop()
        const fileName = `${uuidv4()}.${fileExt}`
        const filePath = `${newCampaignId}/${fileName}`

        // Upload file to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(filePath, file)

        if (uploadError) throw uploadError

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('posts')
          .getPublicUrl(filePath)

        // Insert post record
        const { error: insertError } = await supabase
          .from('posts')
          .insert({
            id: uuidv4(),
            campaign_id: newCampaignId,
            filename: file.name,
            url: publicUrl
          })

        if (insertError) throw insertError
      })

      await Promise.all(postPromises)

      setCampaignId(newCampaignId)
      setMessage('Post created successfully!')
      setCampaignName('')
      setInstructions('')
      setFiles([])
      
      // Reset file input
      const fileInput = document.getElementById('files') as HTMLInputElement
      if (fileInput) fileInput.value = ''

      // Reload campaigns list
      loadCampaigns()

    } catch (error: any) {
      console.error('Error:', error)
      setMessage(`Error: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleCalendarSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!calendarName.trim() || !calendarMonth.trim() || !calendarText.trim()) {
      setCalendarMessage('Please fill in all fields.')
      return
    }

    setCreatingCalendar(true)
    setCalendarMessage('')

    try {
      // Parse the text into lines
      const lines = calendarText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)

      // Allow 1-31 titles, fill the rest with "blank"
      if (lines.length > 31) {
        setCalendarMessage(`Error: Too many titles (${lines.length}). Maximum is 31.`)
        setCreatingCalendar(false)
        return
      }

      // Create calendar
      const newCalendarId = uuidv4()
      const { error: calendarError } = await supabase
        .from('calendars')
        .insert({
          id: newCalendarId,
          name: calendarName.trim(),
          month: calendarMonth.trim()
        })

      if (calendarError) throw calendarError

      // Create 31 campaigns - use provided titles or "blank"
      const campaignPromises = Array.from({ length: 31 }, async (_, index) => {
        const title = lines[index] || 'blank'
        const isBlank = !lines[index]
        
        const { error: campaignError } = await supabase
          .from('campaigns')
          .insert({
            id: uuidv4(),
            calendar_id: newCalendarId,
            day_number: index + 1,
            name: title,
            instructions: '', // Empty body initially
            title_approved: isBlank ? true : null, // Auto-approve blanks
            body_approved: isBlank ? true : null
          })

        if (campaignError) throw campaignError
      })

      await Promise.all(campaignPromises)

      setCalendarMessage('Calendar created successfully!')
      setCalendarName('')
      setCalendarMonth('')
      setCalendarText('')
      
      // Reload data
      loadCalendars()
      
      // Redirect to calendar page
      setTimeout(() => {
        router.push(`/calendar/${newCalendarId}`)
      }, 1000)

    } catch (error: any) {
      console.error('Error:', error)
      setCalendarMessage(`Error: ${error.message}`)
    } finally {
      setCreatingCalendar(false)
    }
  }

  const deleteCalendar = async (calendar: Calendar) => {
    if (!confirm(`Are you sure you want to delete the calendar "${calendar.name}"? This will also delete all 31 associated posts and cannot be undone.`)) {
      return
    }

    setDeleting(calendar.id)

    try {
      // Delete calendar (will cascade delete campaigns due to foreign key)
      const { error } = await supabase
        .from('calendars')
        .delete()
        .eq('id', calendar.id)

      if (error) throw error

      setMessage('Calendar deleted successfully!')
      loadCalendars()

    } catch (error: any) {
      console.error('Error deleting calendar:', error)
      setMessage(`Error deleting calendar: ${error.message}`)
    } finally {
      setDeleting(null)
    }
  }

  const handleGenerateTopics = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!aiPrompt.trim()) {
      setAiCalendarMessage('Please enter a prompt.')
      return
    }

    // Check if API key is available
    const apiKey = typeof window !== 'undefined' ? localStorage.getItem('openai_api_key') : null
    if (!apiKey) {
      setAiCalendarMessage('Error: Please configure your OpenAI API key in Settings.')
      return
    }

    setGeneratingTopics(true)
    setAiCalendarMessage('')
    setGeneratedTopics([])

    try {
      const daysInMonth = getDaysInMonth(aiCalendarMonth)
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a helpful assistant that creates social media content calendars. Generate exactly ${daysInMonth} post topics, one per line, numbered from 1 to ${daysInMonth}. Each topic should be concise and engaging.`
            },
            {
              role: 'user',
              content: aiPrompt
            }
          ],
          temperature: 0.7
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to generate topics')
      }

      const data = await response.json()
      const content = data.choices[0]?.message?.content || ''
      
      // Parse the topics - remove numbering if present
      const topics = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => line.replace(/^\d+[\.\)\:]?\s*/, '')) // Remove leading numbers
        .slice(0, daysInMonth) // Ensure we only get the right number

      if (topics.length !== daysInMonth) {
        setAiCalendarMessage(`Warning: Generated ${topics.length} topics, expected ${daysInMonth}. Proceeding with available topics.`)
      } else {
        setAiCalendarMessage(`Generated ${topics.length} topics successfully!`)
      }

      setGeneratedTopics(topics)

    } catch (error: any) {
      console.error('Error generating topics:', error)
      setAiCalendarMessage(`Error: ${error.message}`)
    } finally {
      setGeneratingTopics(false)
    }
  }

  const handleCreateAiCalendar = async () => {
    if (!aiCalendarName.trim()) {
      setAiCalendarMessage('Error: Please enter a calendar name.')
      return
    }

    if (generatedTopics.length === 0) {
      setAiCalendarMessage('Error: No topics generated yet.')
      return
    }

    setCreatingAiCalendar(true)

    try {
      // Create calendar
      const newCalendarId = uuidv4()
      const { error: calendarError } = await supabase
        .from('calendars')
        .insert({
          id: newCalendarId,
          name: aiCalendarName.trim(),
          month: aiCalendarMonth.trim()
        })

      if (calendarError) throw calendarError

      // Create campaigns for each day
      const daysInMonth = getDaysInMonth(aiCalendarMonth)
      const campaignPromises = Array.from({ length: daysInMonth }, async (_, index) => {
        const title = generatedTopics[index] || 'blank'
        const isBlank = !generatedTopics[index]
        
        const { error: campaignError } = await supabase
          .from('campaigns')
          .insert({
            id: uuidv4(),
            calendar_id: newCalendarId,
            day_number: index + 1,
            name: title,
            instructions: '', // Empty body initially
            title_approved: isBlank ? true : null,
            body_approved: isBlank ? true : null
          })

        if (campaignError) throw campaignError
      })

      await Promise.all(campaignPromises)

      setAiCalendarMessage('Calendar created successfully!')
      
      // Clear form
      setAiCalendarName('')
      setAiPrompt('')
      setGeneratedTopics([])
      
      // Reload data
      loadCalendars()
      
      // Redirect to calendar page
      setTimeout(() => {
        router.push(`/calendar/${newCalendarId}`)
      }, 1000)

    } catch (error: any) {
      console.error('Error creating calendar:', error)
      setAiCalendarMessage(`Error: ${error.message}`)
    } finally {
      setCreatingAiCalendar(false)
    }
  }

  return (
    <div className="container">
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem', textAlign: 'center' }}>
        Social Media Posts
      </h1>

      {message && (
        <div className={message.includes('Error') ? 'error' : 'success'}>
          {message}
        </div>
      )}

      {campaignId && (
        <div className="success">
          <p>Post created! Share this approval link with your client:</p>
          <p style={{ fontWeight: 'bold', marginTop: '0.5rem' }}>
            {window.location.origin}/approve/{campaignId}
          </p>
        </div>
      )}

      {/* TOP ROW: Create Calendar and Create Single Post */}
      <div className="two-column-layout" style={{ marginBottom: '2rem' }}>
        {/* Create Calendar Section */}
        <form onSubmit={handleCalendarSubmit} className="upload-form column-left">
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Create Manual Calendar
          </h2>
          
          {calendarMessage && (
            <div className={calendarMessage.includes('Error') ? 'error' : 'success'} style={{ marginBottom: '1rem' }}>
              {calendarMessage}
            </div>
          )}
          
          <div className="form-group">
            <label htmlFor="calendarName">Calendar Name:</label>
            <input
              type="text"
              id="calendarName"
              value={calendarName}
              onChange={(e) => setCalendarName(e.target.value)}
              placeholder="e.g., January 2025 Content"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="calendarMonth">Month:</label>
            <select
              id="calendarMonth"
              value={calendarMonth}
              onChange={(e) => setCalendarMonth(e.target.value)}
              required
              style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
            >
              <option value="2025-10">October 2025 (31 days)</option>
              <option value="2025-11">November 2025 (30 days)</option>
              <option value="2025-12">December 2025 (31 days)</option>
              <option value="2026-01">January 2026 (31 days)</option>
              <option value="2026-02">February 2026 (28 days)</option>
              <option value="2026-03">March 2026 (31 days)</option>
              <option value="2026-04">April 2026 (30 days)</option>
              <option value="2026-05">May 2026 (31 days)</option>
              <option value="2026-06">June 2026 (30 days)</option>
              <option value="2026-07">July 2026 (31 days)</option>
              <option value="2026-08">August 2026 (31 days)</option>
              <option value="2026-09">September 2026 (30 days)</option>
              <option value="2026-10">October 2026 (31 days)</option>
              <option value="2026-11">November 2026 (30 days)</option>
              <option value="2026-12">December 2026 (31 days)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="calendarText">
              Paste Post Titles (one per line, 1-31 titles):
            </label>
            <textarea
              id="calendarText"
              value={calendarText}
              onChange={(e) => setCalendarText(e.target.value)}
              placeholder={`Paste up to 31 lines of text from ChatGPT...\nLine 1: First post title\nLine 2: Second post title\n...\n\nRemaining days will be marked as "blank" and can be filled in later.`}
              rows={10}
              style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
            />
            <p style={{ marginTop: '0.5rem', color: '#6b7280', fontSize: '0.85rem' }}>
              {calendarText.split('\n').filter(l => l.trim()).length} titles entered (blank days will be auto-filled)
            </p>
          </div>

          <button type="submit" className="btn" disabled={creatingCalendar}>
            {creatingCalendar ? 'Creating Calendar...' : '📅 Create Calendar'}
          </button>
        </form>

        {/* Create Single Post Section */}
        <form onSubmit={handleSubmit} className="upload-form column-right">
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Create Single Post
          </h2>
          <div className="form-group">
            <label htmlFor="campaignName">Post Title:</label>
            <input
              type="text"
              id="campaignName"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Enter post title"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="instructions">Post Body:</label>
            <textarea
              id="instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Enter the text content for this social media post"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="files">Select Images:</label>
            <input
              type="file"
              id="files"
              multiple
              accept="image/*"
              onChange={handleFileChange}
              className="file-input"
              required
            />
            {files.length > 0 && (
              <p style={{ marginTop: '0.5rem', color: '#6b7280' }}>
                {files.length} file(s) selected
              </p>
            )}
          </div>

          <button type="submit" className="btn" disabled={uploading}>
            {uploading ? 'Uploading...' : 'Create Post'}
          </button>
        </form>
      </div>

      {/* AI-POWERED CALENDAR CREATION */}
      <div className="upload-form" style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          🤖 AI-Powered Calendar Creation
        </h2>
        
        {aiCalendarMessage && (
          <div className={aiCalendarMessage.includes('Error') ? 'error' : 'success'} style={{ marginBottom: '1rem' }}>
            {aiCalendarMessage}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* Left: Generate Topics */}
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem', color: '#1f2937' }}>
              Step 1: Generate Topics with AI
            </h3>
            
            <form onSubmit={handleGenerateTopics}>
              <div className="form-group">
                <label htmlFor="aiCalendarMonth">Month:</label>
                <select
                  id="aiCalendarMonth"
                  value={aiCalendarMonth}
                  onChange={(e) => setAiCalendarMonth(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                >
                  <option value="2025-10">October 2025 (31 days)</option>
                  <option value="2025-11">November 2025 (30 days)</option>
                  <option value="2025-12">December 2025 (31 days)</option>
                  <option value="2026-01">January 2026 (31 days)</option>
                  <option value="2026-02">February 2026 (28 days)</option>
                  <option value="2026-03">March 2026 (31 days)</option>
                  <option value="2026-04">April 2026 (30 days)</option>
                  <option value="2026-05">May 2026 (31 days)</option>
                  <option value="2026-06">June 2026 (30 days)</option>
                  <option value="2026-07">July 2026 (31 days)</option>
                  <option value="2026-08">August 2026 (31 days)</option>
                  <option value="2026-09">September 2026 (30 days)</option>
                  <option value="2026-10">October 2026 (31 days)</option>
                  <option value="2026-11">November 2026 (30 days)</option>
                  <option value="2026-12">December 2026 (31 days)</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="aiPrompt">
                  Describe your content calendar:
                </label>
                <textarea
                  id="aiPrompt"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="E.g., Create a social media calendar for a fitness brand targeting millennials. Focus on workout tips, motivation, nutrition, and success stories."
                  rows={6}
                  required
                />
                <p style={{ marginTop: '0.5rem', color: '#6b7280', fontSize: '0.85rem' }}>
                  ChatGPT will generate {getDaysInMonth(aiCalendarMonth)} post topics based on your prompt.
                </p>
              </div>

              <button type="submit" className="btn" disabled={generatingTopics}>
                {generatingTopics ? '🔄 Generating...' : '✨ Generate Topics'}
              </button>
            </form>
          </div>

          {/* Right: Preview and Create */}
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem', color: '#1f2937' }}>
              Step 2: Review & Create Calendar
            </h3>
            
            {generatedTopics.length > 0 ? (
              <>
                <div className="form-group">
                  <label htmlFor="aiCalendarName">Calendar Name:</label>
                  <input
                    type="text"
                    id="aiCalendarName"
                    value={aiCalendarName}
                    onChange={(e) => setAiCalendarName(e.target.value)}
                    placeholder="e.g., January 2026 AI Calendar"
                  />
                </div>

                <div style={{ 
                  maxHeight: '300px', 
                  overflowY: 'auto', 
                  border: '1px solid #d1d5db', 
                  borderRadius: '4px', 
                  padding: '1rem',
                  backgroundColor: '#f9fafb',
                  marginBottom: '1rem'
                }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: '#6b7280' }}>
                    Generated Topics ({generatedTopics.length}):
                  </h4>
                  <ol style={{ paddingLeft: '1.5rem', margin: 0 }}>
                    {generatedTopics.map((topic, index) => (
                      <li key={index} style={{ fontSize: '0.85rem', marginBottom: '0.25rem', color: '#374151' }}>
                        {topic}
                      </li>
                    ))}
                  </ol>
                </div>

                <button 
                  onClick={handleCreateAiCalendar} 
                  className="btn" 
                  disabled={creatingAiCalendar || !aiCalendarName.trim()}
                  style={{ width: '100%' }}
                >
                  {creatingAiCalendar ? 'Creating Calendar...' : '📅 Create Calendar'}
                </button>
              </>
            ) : (
              <div style={{ 
                padding: '2rem', 
                textAlign: 'center', 
                color: '#9ca3af',
                border: '2px dashed #e5e7eb',
                borderRadius: '8px'
              }}>
                <p style={{ fontSize: '3rem', margin: '0 0 0.5rem 0' }}>💡</p>
                <p>Generate topics first to see them here</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM ROW: Existing Content (Full Width) */}
      <div style={{ width: '100%' }}>
        {/* Calendars Section */}
        {calendars.length > 0 && (
          <div className="upload-form" style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              📅 Content Calendars
            </h2>
            <div className="campaigns-list">
              {calendars.map((calendar) => {
                const stats = calendarStats[calendar.id] || { 
                  total: 0, 
                  approved: 0, 
                  disapproved: 0, 
                  pending: 0 
                }
                return (
                  <div key={calendar.id} className="campaign-item">
                    <div className="campaign-info">
                      <h3>{calendar.name}</h3>
                      <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                        Month: {calendar.month} | Created: {new Date(calendar.created_at).toLocaleDateString()}
                      </p>
                      
                      {/* Calendar Stats */}
                      <div style={{ marginTop: '0.75rem', padding: '0.5rem', backgroundColor: '#ede9fe', borderRadius: '4px', border: '1px solid #c4b5fd' }}>
                        <p style={{ color: '#7c3aed', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                          📊 Calendar: {stats.total} posts
                        </p>
                        <p style={{ color: '#7c3aed', fontSize: '0.85rem' }}>
                          Approved: {stats.approved} | Disapproved: {stats.disapproved} | Pending: {stats.pending}
                        </p>
                      </div>

                      <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                        <span style={{ color: '#6b7280' }}>Calendar URL: </span>
                        <a 
                          href={`${window.location.origin}/calendar/${calendar.id}`}
                          style={{ 
                            color: '#3b82f6', 
                            textDecoration: 'underline',
                            wordBreak: 'break-all'
                          }}
                        >
                          {window.location.origin}/calendar/{calendar.id}
                        </a>
                      </p>
                    </div>
                    <button
                      onClick={() => deleteCalendar(calendar)}
                      disabled={deleting === calendar.id}
                      className="delete-btn"
                    >
                      {deleting === calendar.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Single Posts Section */}
        <div className="upload-form">
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            📄 Individual Posts
          </h2>
          
          {loadingCampaigns ? (
            <div className="loading">Loading posts...</div>
          ) : campaigns.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No individual posts yet.</p>
          ) : (
            <div className="campaigns-list">
              {campaigns.map((campaign) => {
                const stats = campaignStats[campaign.id] || { 
                  total: 0, 
                  approved: 0, 
                  disapproved: 0, 
                  pending: 0, 
                  approvedWithComments: [], 
                  disapprovedWithComments: [] 
                }
                return (
                  <div key={campaign.id} className="campaign-item">
                    <div className="campaign-info">
                      <h3>{campaign.name}</h3>
                      <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                        Created: {new Date(campaign.created_at).toLocaleDateString()}
                      </p>
                      <p style={{ color: '#374151', fontSize: '0.95rem', marginTop: '0.5rem', lineHeight: '1.5' }}>
                        {campaign.instructions}
                      </p>
                      
                      {/* Approval Status */}
                      {campaign.approval_completed ? (
                        <div style={{ marginTop: '0.75rem', padding: '0.5rem', backgroundColor: '#f0fdf4', borderRadius: '4px', border: '1px solid #bbf7d0' }}>
                          <p style={{ color: '#16a34a', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                            ✅ Client Review Complete ({new Date(campaign.approval_completed_at!).toLocaleDateString()})
                          </p>
                          <p style={{ color: '#16a34a', fontSize: '0.85rem' }}>
                            Total: {stats.total} | Approved: {stats.approved} | Disapproved: {stats.disapproved}
                          </p>
                          {(stats.approvedWithComments.length > 0 || stats.disapprovedWithComments.length > 0) && (
                            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#16a34a' }}>
                              {stats.approvedWithComments.length > 0 && (
                                <div>
                                  <strong>Approved with comments:</strong>
                                  {stats.approvedWithComments.map((img: any, idx: number) => (
                                    <div key={idx} style={{ marginLeft: '0.5rem' }}>• {img.filename}: {img.comments}</div>
                                  ))}
                                </div>
                              )}
                              {stats.disapprovedWithComments.length > 0 && (
                                <div style={{ marginTop: stats.approvedWithComments.length > 0 ? '0.5rem' : '0' }}>
                                  <strong>Disapproved with comments:</strong>
                                  {stats.disapprovedWithComments.map((img: any, idx: number) => (
                                    <div key={idx} style={{ marginLeft: '0.5rem' }}>• {img.filename}: {img.comments}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : stats.total > 0 && stats.pending > 0 ? (
                        <div style={{ marginTop: '0.75rem', padding: '0.5rem', backgroundColor: '#fef3c7', borderRadius: '4px', border: '1px solid #fde68a' }}>
                          <p style={{ color: '#d97706', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                            ⏳ Awaiting Client Review
                          </p>
                          <p style={{ color: '#d97706', fontSize: '0.85rem' }}>
                            Total: {stats.total} | Pending: {stats.pending} | Reviewed: {stats.approved + stats.disapproved}
                          </p>
                        </div>
                      ) : stats.total > 0 && stats.pending === 0 ? (
                        <div style={{ marginTop: '0.75rem', padding: '0.5rem', backgroundColor: '#dbeafe', borderRadius: '4px', border: '1px solid #93c5fd' }}>
                          <p style={{ color: '#1d4ed8', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                            📝 Review Complete - Awaiting Email Notification
                          </p>
                          <p style={{ color: '#1d4ed8', fontSize: '0.85rem' }}>
                            Total: {stats.total} | Approved: {stats.approved} | Disapproved: {stats.disapproved}
                          </p>
                        </div>
                      ) : (
                        <div style={{ marginTop: '0.75rem', padding: '0.5rem', backgroundColor: '#f3f4f6', borderRadius: '4px', border: '1px solid #d1d5db' }}>
                          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                            📄 No images uploaded yet
                          </p>
                        </div>
                      )}

                      <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                        <span style={{ color: '#6b7280' }}>Approval URL: </span>
                        <a 
                          href={`${window.location.origin}/approve/${campaign.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ 
                            color: '#3b82f6', 
                            textDecoration: 'underline',
                            wordBreak: 'break-all'
                          }}
                        >
                          {window.location.origin}/approve/{campaign.id}
                        </a>
                      </p>
                    </div>
                    <button
                      onClick={() => deleteCampaign(campaign)}
                      disabled={deleting === campaign.id}
                      className="delete-btn"
                    >
                      {deleting === campaign.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 