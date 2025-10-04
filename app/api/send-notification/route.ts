import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabase } from '@/lib/supabase'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const { campaignId, campaignName } = await request.json()

    if (!campaignId || !campaignName) {
      return NextResponse.json(
        { error: 'Campaign ID and name are required' },
        { status: 400 }
      )
    }

    // Check if Resend API key is configured
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not configured')
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 }
      )
    }

    // Get campaign images with approval status
    const { data: images, error: imagesError } = await supabase
      .from('images')
      .select('*')
      .eq('campaign_id', campaignId)

    if (imagesError) {
      throw new Error(`Failed to fetch images: ${imagesError.message}`)
    }

    // Count approvals and disapprovals
    const approved = images.filter(img => img.approved === true).length
    const disapproved = images.filter(img => img.approved === false).length
    const total = images.length

    // Get all images with comments
    const approvedWithComments = images
      .filter(img => img.approved === true && img.comments)
      .map(img => `• ${img.filename}: ${img.comments}`)
      .join('\n')

    const disapprovedWithComments = images
      .filter(img => img.approved === false && img.comments)
      .map(img => `• ${img.filename}: ${img.comments}`)
      .join('\n')

    const emailContent = `
Campaign "${campaignName}" has been reviewed by the client.

Results:
- Total images: ${total}
- Approved: ${approved}
- Disapproved: ${disapproved}

${approvedWithComments ? `\nComments on approved images:\n${approvedWithComments}` : ''}

${disapprovedWithComments ? `\nComments on disapproved images:\n${disapprovedWithComments}` : ''}

You can view the full details at: ${process.env.NEXT_PUBLIC_APP_URL || 'your-app-url'}/approve/${campaignId}
`

    // Send email using Resend
    console.log('Attempting to send email with config:', {
      from: 'PostApprove <noreply@msgs.myai.ad>',
      to: process.env.ADMIN_EMAIL || 'Jenny@MyAi.ad',
      hasApiKey: !!process.env.RESEND_API_KEY,
      apiKeyPrefix: process.env.RESEND_API_KEY?.substring(0, 7) + '...'
    })

    const { data, error: emailError } = await resend.emails.send({
      from: 'PostApprove <noreply@msgs.myai.ad>', // Using your verified domain
      to: [process.env.ADMIN_EMAIL || 'Jenny@MyAi.ad'],
      subject: `Campaign "${campaignName}" - Client Review Complete`,
      text: emailContent,
    })

    console.log('Email send result:', { 
      success: !!data, 
      data, 
      error: emailError,
      errorMessage: emailError?.message 
    })

    if (emailError) {
      throw new Error(`Failed to send email: ${emailError.message}`)
    }

    // Mark campaign as approval completed
    const { error: updateError } = await supabase
      .from('campaigns')
      .update({
        approval_completed: true,
        approval_completed_at: new Date().toISOString()
      })
      .eq('id', campaignId)

    if (updateError) {
      console.error('Error updating campaign status:', updateError)
      // Don't throw error here - email was sent successfully
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Error sending notification:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
} 