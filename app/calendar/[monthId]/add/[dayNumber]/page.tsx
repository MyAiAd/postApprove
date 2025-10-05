'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, Calendar } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export default function AddPostToDay() {
  const params = useParams()
  const router = useRouter()
  const monthId = params.monthId as string
  const dayNumber = parseInt(params.dayNumber as string)
  
  const [calendar, setCalendar] = useState<Calendar | null>(null)
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [postTitle, setPostTitle] = useState('')
  const [postBody, setPostBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadCalendarAndCampaign()
  }, [monthId, dayNumber])

  const loadCalendarAndCampaign = async () => {
    try {
      // Load calendar info
      const { data: calendarData, error: calendarError } = await supabase
        .from('calendars')
        .select('*')
        .eq('id', monthId)
        .single()

      if (calendarError) throw calendarError
      setCalendar(calendarData)

      // Find the campaign for this day
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .select('id')
        .eq('calendar_id', monthId)
        .eq('day_number', dayNumber)
        .single()

      if (campaignError) throw campaignError
      setCampaignId(campaign.id)

    } catch (error: any) {
      console.error('Error loading data:', error)
      setMessage(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!postTitle.trim() || !postBody.trim() || files.length === 0) {
      setMessage('Please fill in all fields and select at least one image.')
      return
    }

    if (!campaignId) {
      setMessage('Error: Campaign not found.')
      return
    }

    setSaving(true)
    setMessage('')

    try {
      // Update the campaign with title and body
      const { error: updateError } = await supabase
        .from('campaigns')
        .update({
          name: postTitle.trim(),
          instructions: postBody.trim(),
          title_approved: null, // Reset approval since we're adding content
          body_approved: null
        })
        .eq('id', campaignId)

      if (updateError) throw updateError

      // Upload images
      const uploadPromises = files.map(async (file) => {
        const fileExt = file.name.split('.').pop()
        const fileName = `${uuidv4()}.${fileExt}`
        const filePath = `${monthId}/${fileName}`

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
            campaign_id: campaignId,
            filename: file.name,
            url: publicUrl
          })

        if (insertError) throw insertError
      })

      await Promise.all(uploadPromises)

      setMessage('Post added successfully! Redirecting...')
      
      // Redirect back to calendar after a short delay
      setTimeout(() => {
        router.push(`/calendar/${monthId}`)
      }, 1500)

    } catch (error: any) {
      console.error('Error:', error)
      setMessage(`Error: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  if (!calendar) {
    return <div className="error">Calendar not found.</div>
  }

  return (
    <div className="container">
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem', textAlign: 'center' }}>
        Add Post to Calendar
      </h1>
      
      <div style={{ textAlign: 'center', marginBottom: '2rem', color: '#6b7280' }}>
        <p style={{ fontSize: '1.1rem' }}>
          <strong>{calendar.name}</strong> - Day {dayNumber}
        </p>
        <p style={{ fontSize: '0.9rem' }}>
          {calendar.month}
        </p>
      </div>

      {message && (
        <div className={message.includes('Error') ? 'error' : 'success'}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="upload-form" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div className="form-group">
          <label htmlFor="postTitle">Post Title:</label>
          <input
            type="text"
            id="postTitle"
            value={postTitle}
            onChange={(e) => setPostTitle(e.target.value)}
            placeholder="Enter post title"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="postBody">Post Body:</label>
          <textarea
            id="postBody"
            value={postBody}
            onChange={(e) => setPostBody(e.target.value)}
            placeholder="Enter the text content for this social media post"
            required
            rows={6}
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

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
          <button 
            type="button" 
            onClick={() => router.push(`/calendar/${monthId}`)}
            className="btn"
            style={{ backgroundColor: '#6b7280', flex: 1 }}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="btn" 
            disabled={saving}
            style={{ flex: 1 }}
          >
            {saving ? 'Saving...' : 'Add Post'}
          </button>
        </div>
      </form>
    </div>
  )
}

