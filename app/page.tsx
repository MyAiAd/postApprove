'use client'

import { useState, useEffect } from 'react'
import { supabase, Campaign } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

interface CampaignStats {
  total: number
  approved: number
  disapproved: number
  pending: number
  approvedWithComments: any[]
  disapprovedWithComments: any[]
}

export default function UploadPage() {
  const [campaignName, setCampaignName] = useState('')
  const [instructions, setInstructions] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loadingCampaigns, setLoadingCampaigns] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [campaignStats, setCampaignStats] = useState<Record<string, CampaignStats>>({})

  useEffect(() => {
    loadCampaigns()
  }, [])

  const loadCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setCampaigns(data)

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
      const { data: images, error } = await supabase
        .from('images')
        .select('approved, comments, filename')
        .eq('campaign_id', campaignId)

      if (error) throw error

      const total = images.length
      const approved = images.filter(img => img.approved === true).length
      const disapproved = images.filter(img => img.approved === false).length
      const pending = images.filter(img => img.approved === null).length

      // Get comments for display
      const approvedWithComments = images.filter(img => img.approved === true && img.comments)
      const disapprovedWithComments = images.filter(img => img.approved === false && img.comments)

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
    if (!confirm(`Are you sure you want to delete the campaign "${campaignToDelete.name}"? This will also delete all associated images and cannot be undone.`)) {
      return
    }

    setDeleting(campaignToDelete.id)

    try {
      // Delete all images from storage first
      const { data: images } = await supabase
        .from('images')
        .select('url')
        .eq('campaign_id', campaignToDelete.id)

      if (images) {
        const deletePromises = images.map(async (image) => {
          const filePath = image.url.split('/').pop() // Extract file path from URL
          if (filePath) {
            await supabase.storage
              .from('images')
              .remove([`${campaignToDelete.id}/${filePath}`])
          }
        })
        await Promise.all(deletePromises)
      }

      // Delete campaign (this will cascade delete images due to foreign key)
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignToDelete.id)

      if (error) throw error

      setMessage('Campaign deleted successfully!')
      loadCampaigns() // Reload campaigns list

    } catch (error: any) {
      console.error('Error deleting campaign:', error)
      setMessage(`Error deleting campaign: ${error.message}`)
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

      // Reload campaigns list
      loadCampaigns()

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

      {/* Side-by-side layout */}
      <div className="two-column-layout">
        {/* Existing Campaigns Section */}
        <div className="upload-form column-left">
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Existing Campaigns
          </h2>
          
          {loadingCampaigns ? (
            <div className="loading">Loading campaigns...</div>
          ) : campaigns.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No campaigns yet.</p>
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
                      <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '0.5rem' }}>
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
                            📷 No images uploaded yet
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

        {/* Create New Campaign Section */}
        <form onSubmit={handleSubmit} className="upload-form column-right">
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          Create New Campaign
        </h2>
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
    </div>
  )
} 