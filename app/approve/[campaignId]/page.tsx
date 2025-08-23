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
  const [submitted, setSubmitted] = useState(false)

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
        comments: prev[imageId]?.comments || ''
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
      setSubmitted(true)
      
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

  // Show thank you page after submission
  if (submitted) {
    return (
      <div className="container">
        <div className="thank-you-page">
          <div className="thank-you-content">
            <h1 className="thank-you-title">Thank You!</h1>
            <div className="thank-you-icon">✅</div>
            <h2 className="thank-you-subtitle">Your review has been submitted</h2>
            <p className="thank-you-message">
              We've received your feedback on the <strong>{campaign.name}</strong> campaign. 
              The team has been notified and will review your responses.
            </p>
            <div className="thank-you-summary">
              <p>Review Summary:</p>
              <ul>
                <li>Total images reviewed: {images.length}</li>
                <li>Images approved: {images.filter(img => approvals[img.id]?.approved === true).length}</li>
                <li>Images requiring changes: {images.filter(img => approvals[img.id]?.approved === false).length}</li>
              </ul>
            </div>
            <p className="thank-you-footer">
              You can now close this page. We'll be in touch soon!
            </p>
          </div>
        </div>
      </div>
    )
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
                     value="approve"
                     checked={approvals[image.id]?.approved === true}
                     onChange={() => handleApprovalChange(image.id, true)}
                   />
                   Approve
                 </label>
                 <label className="radio-option">
                   <input
                     type="radio"
                     name={`approval-${image.id}`}
                     value="disapprove"
                     checked={approvals[image.id]?.approved === false}
                     onChange={() => handleApprovalChange(image.id, false)}
                   />
                   Disapprove
                 </label>
               </div>
              
                             <textarea
                 className="comments-textarea"
                 placeholder={
                   approvals[image.id]?.approved === true 
                     ? "Optional: Share your thoughts on why you approve this image..."
                     : approvals[image.id]?.approved === false
                     ? "Please explain why you disapprove this image..."
                     : "Optional: Add any comments about this image..."
                 }
                 value={approvals[image.id]?.comments || ''}
                 onChange={(e) => handleCommentsChange(image.id, e.target.value)}
               />
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
          {submitting ? 'Submitting...' : 'Submit All'}
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