'use client'

import { useState, useEffect } from 'react'
import { supabase, Campaign, Image } from '@/lib/supabase'
import { useParams } from 'next/navigation'

interface ImageApproval {
  imageId: string
  approved: boolean | null
  comments: string
}

export default function ApprovePage() {
  const params = useParams()
  const campaignId = params.campaignId as string
  
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [images, setImages] = useState<Image[]>([])
  const [approvals, setApprovals] = useState<Record<string, ImageApproval>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (campaignId) {
      loadCampaignData()
    }
  }, [campaignId])

  const loadCampaignData = async () => {
    try {
      // Load campaign
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single()

      if (campaignError) throw campaignError
      setCampaign(campaignData)

      // Load images
      const { data: imagesData, error: imagesError } = await supabase
        .from('images')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at')

      if (imagesError) throw imagesError
      setImages(imagesData)

      // Initialize approvals state
      const initialApprovals: Record<string, ImageApproval> = {}
      imagesData.forEach((image) => {
        initialApprovals[image.id] = {
          imageId: image.id,
          approved: image.approved,
          comments: image.comments || ''
        }
      })
      setApprovals(initialApprovals)

    } catch (error: any) {
      console.error('Error loading campaign:', error)
      setMessage(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleApprovalChange = (imageId: string, approved: boolean) => {
    setApprovals(prev => ({
      ...prev,
      [imageId]: {
        ...prev[imageId],
        approved,
        comments: approved ? '' : prev[imageId]?.comments || ''
      }
    }))
  }

  const handleCommentsChange = (imageId: string, comments: string) => {
    setApprovals(prev => ({
      ...prev,
      [imageId]: {
        ...prev[imageId],
        comments
      }
    }))
  }

  const allImagesReviewed = () => {
    return images.every(image => approvals[image.id]?.approved !== null)
  }

  const handleSubmit = async () => {
    if (!allImagesReviewed()) {
      setMessage('Please review all images before submitting.')
      return
    }

    setSubmitting(true)
    setMessage('')

    try {
      // Update all images with approval status
      const updatePromises = images.map(async (image) => {
        const approval = approvals[image.id]
        const { error } = await supabase
          .from('images')
          .update({
            approved: approval.approved,
            comments: approval.comments || null
          })
          .eq('id', image.id)

        if (error) throw error
      })

      await Promise.all(updatePromises)

      // Send notification email
      const response = await fetch('/api/send-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaignId,
          campaignName: campaign?.name
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send notification email')
      }

      setMessage('Thank you! Your approvals have been submitted and the team has been notified.')
      
      // Reload data to show updated state
      loadCampaignData()

    } catch (error: any) {
      console.error('Error submitting approvals:', error)
      setMessage(`Error: ${error.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="loading">Loading campaign...</div>
  }

  if (!campaign) {
    return <div className="error">Campaign not found.</div>
  }

  return (
    <div className="container">
      <div className="campaign-header">
        <h2 className="campaign-title">{campaign.name}</h2>
        <p className="campaign-instructions">{campaign.instructions}</p>
      </div>

      {message && (
        <div className={message.includes('Error') ? 'error' : 'success'}>
          {message}
        </div>
      )}

      <div className="image-grid">
        {images.map((image) => (
          <div key={image.id} className="image-card">
            <img src={image.url} alt={image.filename} />
            <div className="image-controls">
              <div className="radio-group">
                <label className="radio-option">
                  <input
                    type="radio"
                    name={`approval-${image.id}`}
                    value="yes"
                    checked={approvals[image.id]?.approved === true}
                    onChange={() => handleApprovalChange(image.id, true)}
                  />
                  Yes
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name={`approval-${image.id}`}
                    value="no"
                    checked={approvals[image.id]?.approved === false}
                    onChange={() => handleApprovalChange(image.id, false)}
                  />
                  No
                </label>
              </div>
              
              {approvals[image.id]?.approved === false && (
                <textarea
                  className="comments-textarea"
                  placeholder="Please explain why you disapprove this image..."
                  value={approvals[image.id]?.comments || ''}
                  onChange={(e) => handleCommentsChange(image.id, e.target.value)}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="submit-section">
        <button 
          onClick={handleSubmit} 
          className="btn" 
          disabled={!allImagesReviewed() || submitting}
        >
          {submitting ? 'Submitting...' : 'Submit All Approvals'}
        </button>
        {!allImagesReviewed() && (
          <p style={{ marginTop: '1rem', color: '#6b7280' }}>
            Please review all images before submitting.
          </p>
        )}
      </div>
    </div>
  )
} 