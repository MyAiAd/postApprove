'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export default function UploadPage() {
  const [campaignName, setCampaignName] = useState('')
  const [instructions, setInstructions] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [campaignId, setCampaignId] = useState<string | null>(null)

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

      // Upload images
      const imagePromises = files.map(async (file) => {
        const fileExt = file.name.split('.').pop()
        const fileName = `${uuidv4()}.${fileExt}`
        const filePath = `${newCampaignId}/${fileName}`

        // Upload file to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('images')
          .upload(filePath, file)

        if (uploadError) throw uploadError

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('images')
          .getPublicUrl(filePath)

        // Insert image record
        const { error: insertError } = await supabase
          .from('images')
          .insert({
            id: uuidv4(),
            campaign_id: newCampaignId,
            filename: file.name,
            url: publicUrl
          })

        if (insertError) throw insertError
      })

      await Promise.all(imagePromises)

      setCampaignId(newCampaignId)
      setMessage('Campaign created successfully!')
      setCampaignName('')
      setInstructions('')
      setFiles([])
      
      // Reset file input
      const fileInput = document.getElementById('files') as HTMLInputElement
      if (fileInput) fileInput.value = ''

    } catch (error: any) {
      console.error('Error:', error)
      setMessage(`Error: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="container">
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem', textAlign: 'center' }}>
        Upload Campaign Images
      </h1>

      {message && (
        <div className={message.includes('Error') ? 'error' : 'success'}>
          {message}
        </div>
      )}

      {campaignId && (
        <div className="success">
          <p>Campaign created! Share this approval link with your client:</p>
          <p style={{ fontWeight: 'bold', marginTop: '0.5rem' }}>
            {window.location.origin}/approve/{campaignId}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="upload-form">
        <div className="form-group">
          <label htmlFor="campaignName">Campaign Name:</label>
          <input
            type="text"
            id="campaignName"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            placeholder="Enter campaign name"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="instructions">Instructions for Client:</label>
          <textarea
            id="instructions"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Enter instructions for the client"
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
          {uploading ? 'Uploading...' : 'Create Campaign'}
        </button>
      </form>
    </div>
  )
} 