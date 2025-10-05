'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase, Calendar, Campaign } from '@/lib/supabase'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface CalendarDay {
  dayNumber: number
  campaign: Campaign | null
  hasDetail: boolean
}

// Sortable Calendar Square Component
function CalendarSquare({ day, calendarId }: { day: CalendarDay; calendarId: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: day.campaign?.id || `empty-${day.dayNumber}`,
    // Don't disable - we want empty squares to be drop targets
    disabled: false
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  
  // Only apply drag listeners to squares with campaigns
  // Empty squares can receive drops but can't be dragged
  // (they have no database record to persist position changes)
  const dragHandlers = day.campaign ? listeners : {}

  const [titleApproved, setTitleApproved] = useState<boolean | null>(
    day.campaign?.title_approved ?? null
  )

  // Sync state with prop changes
  useEffect(() => {
    setTitleApproved(day.campaign?.title_approved ?? null)
  }, [day.campaign?.title_approved])

  const handleApprovalChange = async (approved: boolean) => {
    if (!day.campaign) return
    
    console.log('Changing approval for day', day.dayNumber, 'to', approved, 'campaign ID:', day.campaign.id)
    
    // Optimistically update UI
    setTitleApproved(approved)
    
    // Update in database
    const { error } = await supabase
      .from('campaigns')
      .update({ title_approved: approved })
      .eq('id', day.campaign.id)
    
    if (error) {
      console.error('Error updating approval:', error)
      // Revert on error
      setTitleApproved(day.campaign.title_approved ?? null)
    } else {
      console.log('Successfully updated approval for day', day.dayNumber, 'to', approved)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="calendar-square"
      {...attributes}
      {...dragHandlers}
    >
      <div className="calendar-day-number">{day.dayNumber}</div>
      
      {day.campaign ? (
        day.campaign.name === 'blank' ? (
          // Blank campaign - show clickable "blank" text, no approval buttons
          <div className="calendar-post-content">
            <a
              href={`/calendar/${calendarId}/add/${day.dayNumber}`}
              className="calendar-blank-link"
              onClick={(e) => e.stopPropagation()}
            >
              blank
            </a>
          </div>
        ) : (
          // Regular campaign with content
          <div className="calendar-post-content">
            {day.hasDetail ? (
              <a
                href={`/approve/${day.campaign.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="calendar-post-title-link"
                onClick={(e) => e.stopPropagation()}
              >
                {day.campaign.name}
              </a>
            ) : (
              <div className="calendar-post-title">
                {day.campaign.name}
              </div>
            )}
            
            <div className="calendar-approval-buttons">
              <button
                type="button"
                className={`calendar-approval-btn ${titleApproved === true ? 'approved' : ''}`}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  handleApprovalChange(true)
                }}
              >
                ✅
              </button>
              <button
                type="button"
                className={`calendar-approval-btn ${titleApproved === false ? 'disapproved' : ''}`}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  handleApprovalChange(false)
                }}
              >
                ❌
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="calendar-empty">
          <span style={{ color: '#d1d5db', fontSize: '0.8rem' }}>Empty</span>
        </div>
      )}
    </div>
  )
}

export default function CalendarPage() {
  const params = useParams()
  const monthId = params.monthId as string
  
  const [calendar, setCalendar] = useState<Calendar | null>(null)
  const [days, setDays] = useState<CalendarDay[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [approving, setApproving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    loadCalendarData()
  }, [monthId])

  const loadCalendarData = async () => {
    try {
      // Load calendar
      const { data: calendarData, error: calendarError } = await supabase
        .from('calendars')
        .select('*')
        .eq('id', monthId)
        .single()

      if (calendarError) throw calendarError
      setCalendar(calendarData)

      // Load campaigns for this calendar
      const { data: campaigns, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('calendar_id', monthId)
        .order('day_number')

      if (campaignsError) throw campaignsError

      // Check which campaigns have detail (posts)
      const campaignsWithDetail = await Promise.all(
        (campaigns || []).map(async (campaign) => {
          const { data: posts } = await supabase
            .from('posts')
            .select('id')
            .eq('campaign_id', campaign.id)
            .limit(1)
          
          return {
            campaign,
            hasDetail: (posts?.length || 0) > 0
          }
        })
      )

      // Create 31 days array
      const daysArray: CalendarDay[] = []
      for (let i = 1; i <= 31; i++) {
        const campaignData = campaignsWithDetail.find(c => c.campaign.day_number === i)
        daysArray.push({
          dayNumber: i,
          campaign: campaignData?.campaign || null,
          hasDetail: campaignData?.hasDetail || false
        })
      }

      setDays(daysArray)
    } catch (error: any) {
      console.error('Error loading calendar:', error)
      setMessage(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const oldIndex = days.findIndex(d => d.campaign?.id === active.id)
    const newIndex = days.findIndex(d => 
      d.campaign?.id === over.id || `empty-${d.dayNumber}` === over.id
    )

    if (oldIndex !== -1 && newIndex !== -1) {
      // Move the campaigns in the array
      const newDays = arrayMove(days, oldIndex, newIndex)
      
      // Update day numbers to match new positions
      const updatedDays = newDays.map((day, index) => ({
        ...day,
        dayNumber: index + 1
      }))
      
      setDays(updatedDays)

      // Update day_number in database for all campaigns that have them
      const updatePromises = updatedDays
        .filter(day => day.campaign)
        .map(async (day) => {
          const { error } = await supabase
            .from('campaigns')
            .update({ day_number: day.dayNumber })
            .eq('id', day.campaign!.id)

          if (error) {
            console.error('Error updating day number:', error)
          }
        })

      await Promise.all(updatePromises)
        .catch(() => {
          // Reload on error
          loadCalendarData()
        })
    }
  }

  const handleApproveAll = async () => {
    if (!confirm('Are you sure you want to approve all posts in this calendar?')) {
      return
    }

    setApproving(true)
    try {
      const campaignIds = days
        .filter(d => d.campaign && d.campaign.name !== 'blank')
        .map(d => d.campaign!.id)

      const { error } = await supabase
        .from('campaigns')
        .update({ title_approved: true })
        .in('id', campaignIds)

      if (error) throw error

      setMessage('All posts approved successfully!')
      loadCalendarData()
    } catch (error: any) {
      console.error('Error approving all:', error)
      setMessage(`Error: ${error.message}`)
    } finally {
      setApproving(false)
    }
  }

  const handleDisapproveAll = async () => {
    if (!confirm('Are you sure you want to disapprove all posts in this calendar?')) {
      return
    }

    setApproving(true)
    try {
      const campaignIds = days
        .filter(d => d.campaign && d.campaign.name !== 'blank')
        .map(d => d.campaign!.id)

      const { error } = await supabase
        .from('campaigns')
        .update({ title_approved: false })
        .in('id', campaignIds)

      if (error) throw error

      setMessage('All posts disapproved successfully!')
      loadCalendarData()
    } catch (error: any) {
      console.error('Error disapproving all:', error)
      setMessage(`Error: ${error.message}`)
    } finally {
      setApproving(false)
    }
  }

  const handleResetAll = async () => {
    if (!confirm('Are you sure you want to reset all approval statuses in this calendar?')) {
      return
    }

    setApproving(true)
    try {
      const campaignIds = days
        .filter(d => d.campaign && d.campaign.name !== 'blank')
        .map(d => d.campaign!.id)

      const { error } = await supabase
        .from('campaigns')
        .update({ title_approved: null })
        .in('id', campaignIds)

      if (error) throw error

      setMessage('All approval statuses reset successfully!')
      loadCalendarData()
    } catch (error: any) {
      console.error('Error resetting all:', error)
      setMessage(`Error: ${error.message}`)
    } finally {
      setApproving(false)
    }
  }

  if (loading) {
    return <div className="loading">Loading calendar...</div>
  }

  if (!calendar) {
    return <div className="error">Calendar not found.</div>
  }

  return (
    <div className="container">
      <div className="calendar-header">
        <h1 className="calendar-title">{calendar.name}</h1>
        <p className="calendar-month">{calendar.month}</p>
        
        <div className="bulk-actions-container">
          <button
            onClick={handleApproveAll}
            disabled={approving}
            className="bulk-action-btn approve-all"
          >
            ✅ Approve All
          </button>
          <button
            onClick={handleDisapproveAll}
            disabled={approving}
            className="bulk-action-btn disapprove-all"
          >
            ❌ Disapprove All
          </button>
          <button
            onClick={handleResetAll}
            disabled={approving}
            className="bulk-action-btn reset-all"
          >
            ↺ Reset All
          </button>
        </div>
        {approving && <p style={{ color: '#6b7280', marginTop: '0.5rem', fontSize: '0.9rem' }}>Processing...</p>}
      </div>

      {message && (
        <div className={message.includes('Error') ? 'error' : 'success'}>
          {message}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={days.map(d => d.campaign?.id || `empty-${d.dayNumber}`)}
          strategy={rectSortingStrategy}
        >
          <div className="calendar-grid">
            {days.map((day) => (
              <CalendarSquare key={day.dayNumber} day={day} calendarId={monthId} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <style jsx>{`
        .calendar-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .calendar-title {
          font-size: 2rem;
          font-weight: bold;
          margin-bottom: 0.5rem;
        }

        .calendar-month {
          font-size: 1.2rem;
          color: #6b7280;
          margin-bottom: 1rem;
        }

        .bulk-actions-container {
          display: inline-flex;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          margin-top: 1rem;
        }

        :global(.bulk-action-btn) {
          padding: 0.75rem 1.5rem;
          border: none;
          background: white;
          color: #374151;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border-right: 1px solid #e5e7eb;
        }

        :global(.bulk-action-btn:last-child) {
          border-right: none;
        }

        :global(.bulk-action-btn:hover:not(:disabled)) {
          background: #f3f4f6;
        }

        :global(.bulk-action-btn:disabled) {
          opacity: 0.5;
          cursor: not-allowed;
        }

        :global(.bulk-action-btn.approve-all:hover:not(:disabled)) {
          background: #dcfce7;
          color: #16a34a;
        }

        :global(.bulk-action-btn.disapprove-all:hover:not(:disabled)) {
          background: #fee2e2;
          color: #dc2626;
        }

        :global(.bulk-action-btn.reset-all:hover:not(:disabled)) {
          background: #e0e7ff;
          color: #4f46e5;
        }

        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 1rem;
          margin-bottom: 2rem;
        }

        :global(.calendar-square) {
          aspect-ratio: 1;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          padding: 0.75rem;
          background: white;
          display: flex;
          flex-direction: column;
          cursor: grab;
          transition: all 0.2s;
        }

        :global(.calendar-square:active) {
          cursor: grabbing;
        }

        :global(.calendar-square:hover) {
          border-color: #3b82f6;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .calendar-day-number {
          font-size: 1.2rem;
          font-weight: bold;
          color: #9ca3af;
          margin-bottom: 0.5rem;
        }

        .calendar-post-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        :global(.calendar-post-title-link) {
          color: #3b82f6;
          text-decoration: none;
          font-size: 0.9rem;
          font-weight: 500;
          line-height: 1.3;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
        }

        :global(.calendar-post-title-link:hover) {
          text-decoration: underline;
        }

        .calendar-post-title {
          color: #374151;
          font-size: 0.9rem;
          font-weight: 500;
          line-height: 1.3;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
        }

        .calendar-approval-buttons {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.5rem;
        }

        :global(.calendar-approval-btn) {
          padding: 0.4rem 0.6rem;
          border: 2px solid #e5e7eb;
          border-radius: 6px;
          background: white;
          font-size: 1.2rem;
          cursor: pointer;
          transition: all 0.2s;
          opacity: 0.4;
        }

        :global(.calendar-approval-btn:hover) {
          opacity: 0.7;
          border-color: #3b82f6;
        }

        :global(.calendar-approval-btn.approved) {
          opacity: 1;
          background: #dcfce7;
          border-color: #22c55e;
        }

        :global(.calendar-approval-btn.disapproved) {
          opacity: 1;
          background: #fee2e2;
          border-color: #ef4444;
        }

        .calendar-empty {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        :global(.calendar-blank-link) {
          color: #9ca3af;
          font-style: italic;
          font-size: 0.85rem;
          text-decoration: none;
          cursor: pointer;
        }

        :global(.calendar-blank-link:hover) {
          color: #6b7280;
          text-decoration: underline;
        }
      `}</style>
    </div>
  )
}

