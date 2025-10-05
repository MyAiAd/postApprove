'use client'

import { useState, useEffect } from 'react'
import { supabase, Campaign, Post } from '@/lib/supabase'
import { useParams } from 'next/navigation'

interface PostApproval {
  postId: string
  approved: boolean | null
  comments: string
}

export default function ApprovePage() {
  const params = useParams()
  const campaignId = params.campaignId as string
  
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [approvals, setApprovals] = useState<Record<string, PostApproval>>({})
  const [titleApproved, setTitleApproved] = useState<boolean | null>(null)
  const [titleComments, setTitleComments] = useState('')
  const [bodyApproved, setBodyApproved] = useState<boolean | null>(null)
  const [bodyComments, setBodyComments] = useState('')
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
      
      // Initialize title and body approval states
      setTitleApproved(campaignData.title_approved)
      setTitleComments(campaignData.title_comments || '')
      setBodyApproved(campaignData.body_approved)
      setBodyComments(campaignData.body_comments || '')

      // Load posts
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at')

      if (postsError) throw postsError
      setPosts(postsData)

      // Initialize approvals state
      const initialApprovals: Record<string, PostApproval> = {}
      postsData.forEach((post) => {
        initialApprovals[post.id] = {
          postId: post.id,
          approved: post.approved,
          comments: post.comments || ''
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

  const handleApprovalChange = (postId: string, approved: boolean) => {
    setApprovals(prev => ({
      ...prev,
      [postId]: {
        ...prev[postId],
        approved,
        comments: prev[postId]?.comments || ''
      }
    }))
  }

  const handleCommentsChange = (postId: string, comments: string) => {
    setApprovals(prev => ({
      ...prev,
      [postId]: {
        ...prev[postId],
        comments
      }
    }))
  }

  const allPostsReviewed = () => {
    const allImagesReviewed = posts.every(post => approvals[post.id]?.approved !== null)
    const titleReviewed = titleApproved !== null
    const bodyReviewed = bodyApproved !== null
    return allImagesReviewed && titleReviewed && bodyReviewed
  }

  const handleSubmit = async () => {
    if (!allPostsReviewed()) {
      setMessage('Please review the title, body, and all images before submitting.')
      return
    }

    setSubmitting(true)
    setMessage('')

    try {
      // Update campaign with title and body approvals
      const { error: campaignError } = await supabase
        .from('campaigns')
        .update({
          title_approved: titleApproved,
          title_comments: titleComments || null,
          body_approved: bodyApproved,
          body_comments: bodyComments || null
        })
        .eq('id', campaignId)

      if (campaignError) throw campaignError

      // Update all posts with approval status
      const updatePromises = posts.map(async (post) => {
        const approval = approvals[post.id]
        const { error } = await supabase
          .from('posts')
          .update({
            approved: approval.approved,
            comments: approval.comments || null
          })
          .eq('id', post.id)

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
    return <div className="loading">Loading post...</div>
  }

  if (!campaign) {
    return <div className="error">Post not found.</div>
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
              We've received your feedback on the <strong>{campaign.name}</strong> post. 
              The team has been notified and will review your responses.
            </p>
            <div className="thank-you-summary">
              <p>Review Summary:</p>
              <ul>
                <li>Title: {titleApproved ? '✅ Approved' : '❌ Needs Changes'}</li>
                <li>Body: {bodyApproved ? '✅ Approved' : '❌ Needs Changes'}</li>
                <li>Total images reviewed: {posts.length}</li>
                <li>Images approved: {posts.filter(post => approvals[post.id]?.approved === true).length}</li>
                <li>Images requiring changes: {posts.filter(post => approvals[post.id]?.approved === false).length}</li>
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
      <div style={{ marginBottom: '1rem' }}>
        <a 
          href="javascript:history.back()" 
          style={{ 
            fontSize: '0.9rem', 
            color: '#6b7280', 
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}
        >
          ← back
        </a>
      </div>

      {message && (
        <div className={message.includes('Error') ? 'error' : 'success'}>
          {message}
        </div>
      )}

      {/* Post Title Section */}
      <div className="post-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '8px', border: '2px solid #e5e7eb' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            Post Title
          </h3>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1rem', color: '#111827' }}>{campaign.name}</h2>
          
          <div className="post-controls">
            <div className="approval-section">
              <h4 className="approval-title">Your Decision:</h4>
              <div className="radio-group">
                <label className="radio-option approve-option">
                  <input
                    type="radio"
                    name="title-approval"
                    value="approve"
                    checked={titleApproved === true}
                    onChange={() => setTitleApproved(true)}
                  />
                  <span className="radio-label">✅ Approve</span>
                </label>
                <label className="radio-option disapprove-option">
                  <input
                    type="radio"
                    name="title-approval"
                    value="disapprove"
                    checked={titleApproved === false}
                    onChange={() => setTitleApproved(false)}
                  />
                  <span className="radio-label">❌ Disapprove</span>
                </label>
              </div>
            </div>
            
            <div className="feedback-section">
              <h4 className="feedback-title">
                {titleApproved === true 
                  ? "Comments (Optional):" 
                  : titleApproved === false
                  ? "Please explain what needs to change:"
                  : "Comments (Optional):"}
              </h4>
              <textarea
                className="comments-textarea"
                placeholder={
                  titleApproved === true 
                    ? "Share your thoughts on the title..."
                    : titleApproved === false
                    ? "Please explain what needs to change about the title..."
                    : "Add any comments about the title..."
                }
                value={titleComments}
                onChange={(e) => setTitleComments(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Post Images Section */}
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Post Images
        </h3>
      </div>

      <div className="post-grid">
        {posts.map((post) => (
          <div key={post.id} className="post-card">
            <img src={post.url} alt={post.filename} />
            <div className="post-controls">
              <div className="approval-section">
                <h4 className="approval-title">Your Decision:</h4>
                <div className="radio-group">
                  <label className="radio-option approve-option">
                    <input
                      type="radio"
                      name={`approval-${post.id}`}
                      value="approve"
                      checked={approvals[post.id]?.approved === true}
                      onChange={() => handleApprovalChange(post.id, true)}
                    />
                    <span className="radio-label">✅ Approve</span>
                  </label>
                  <label className="radio-option disapprove-option">
                    <input
                      type="radio"
                      name={`approval-${post.id}`}
                      value="disapprove"
                      checked={approvals[post.id]?.approved === false}
                      onChange={() => handleApprovalChange(post.id, false)}
                    />
                    <span className="radio-label">❌ Disapprove</span>
                  </label>
                </div>
              </div>
              
              <div className="feedback-section">
                <h4 className="feedback-title">
                  {approvals[post.id]?.approved === true 
                    ? "Comments (Optional):" 
                    : approvals[post.id]?.approved === false
                    ? "Please explain what needs to change:"
                    : "Comments (Optional):"}
                </h4>
                <textarea
                  className="comments-textarea"
                  placeholder={
                    approvals[post.id]?.approved === true 
                      ? "Share your thoughts on why you approve this image..."
                      : approvals[post.id]?.approved === false
                      ? "Please explain what needs to change or what you don't like..."
                      : "Add any comments about this image..."
                  }
                  value={approvals[post.id]?.comments || ''}
                  onChange={(e) => handleCommentsChange(post.id, e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Post Body Section */}
      <div className="post-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '8px', border: '2px solid #e5e7eb' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            Post Body
          </h3>
          <p style={{ fontSize: '1.05rem', lineHeight: '1.6', color: '#374151', marginBottom: '1rem', whiteSpace: 'pre-wrap' }}>{campaign.instructions}</p>
          
          <div className="post-controls">
            <div className="approval-section">
              <h4 className="approval-title">Your Decision:</h4>
              <div className="radio-group">
                <label className="radio-option approve-option">
                  <input
                    type="radio"
                    name="body-approval"
                    value="approve"
                    checked={bodyApproved === true}
                    onChange={() => setBodyApproved(true)}
                  />
                  <span className="radio-label">✅ Approve</span>
                </label>
                <label className="radio-option disapprove-option">
                  <input
                    type="radio"
                    name="body-approval"
                    value="disapprove"
                    checked={bodyApproved === false}
                    onChange={() => setBodyApproved(false)}
                  />
                  <span className="radio-label">❌ Disapprove</span>
                </label>
              </div>
            </div>
            
            <div className="feedback-section">
              <h4 className="feedback-title">
                {bodyApproved === true 
                  ? "Comments (Optional):" 
                  : bodyApproved === false
                  ? "Please explain what needs to change:"
                  : "Comments (Optional):"}
              </h4>
              <textarea
                className="comments-textarea"
                placeholder={
                  bodyApproved === true 
                    ? "Share your thoughts on the body text..."
                    : bodyApproved === false
                    ? "Please explain what needs to change about the body text..."
                    : "Add any comments about the body text..."
                }
                value={bodyComments}
                onChange={(e) => setBodyComments(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="submit-section">
        <button 
          onClick={handleSubmit} 
          className="btn" 
          disabled={!allPostsReviewed() || submitting}
        >
          {submitting ? 'Submitting...' : 'Submit All'}
        </button>
        {!allPostsReviewed() && (
          <p style={{ marginTop: '1rem', color: '#6b7280' }}>
            Please review the title, body, and all images before submitting.
          </p>
        )}
      </div>
    </div>
  )
} 