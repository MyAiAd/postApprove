'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase, Calendar, Campaign, Post } from '@/lib/supabase'
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
function CalendarSquare({ day }: { day: CalendarDay }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: day.campaign?.id || `empty-${day.dayNumber}`,
    disabled: !day.campaign // Only enable drag if there's a post
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const [titleApproved, setTitleApproved] = useState<boolean | null>(
    day.campaign?.title_approved || null
  )

  const handleApprovalChange = async (approved: boolean) => {
    if (!day.campaign) return
    
    setTitleApproved(approved)
    
    // Update in database
    const { error } = await supabase
      .from('campaigns')
      .update({ title_approved: approved })
      .eq('id', day.campaign.id)
    
    if (error) {
      console.error('Error updating approval:', error)
      setTitleApproved(day.campaign.title_approved || null)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="calendar-square"
      {...attributes}
      {...listeners}
    >
      <div className="calendar-day-number">{day.dayNumber}</div>
      
      {day.campaign ? (
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
            <label className="calendar-radio-label" onClick={(e) => e.stopPropagation()}>
              <input
                type="radio"
                name={`approval-${day.campaign.id}`}
                checked={titleApproved === true}
                onChange={() => handleApprovalChange(true)}
              />
              <span>✅</span>
            </label>
            <label className="calendar-radio-label" onClick={(e) => e.stopPropagation()}>
              <input
                type="radio"
                name={`approval-${day.campaign.id}`}
                checked={titleApproved === false}
                onChange={() => handleApprovalChange(false)}
              />
              <span>❌</span>
            </label>
          </div>
        </div>
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
      const newDays = arrayMove(days, oldIndex, newIndex)
      setDays(newDays)

      // Update day_number in database
      const movedCampaign = newDays[newIndex].campaign
      if (movedCampaign) {
        const { error } = await supabase
          .from('campaigns')
          .update({ day_number: newIndex + 1 })
          .eq('id', movedCampaign.id)

        if (error) {
          console.error('Error updating day number:', error)
          loadCalendarData() // Reload on error
        }
      }
    }
  }

  const handleApproveAll = async () => {
    if (!confirm('Are you sure you want to approve all posts in this calendar?')) {
      return
    }

    setApproving(true)
    try {
      const campaignIds = days
        .filter(d => d.campaign)
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
        
        <button
          onClick={handleApproveAll}
          disabled={approving}
          className="btn"
          style={{ marginTop: '1rem' }}
        >
          {approving ? 'Approving...' : '✅ Approve All'}
        </button>
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
              <CalendarSquare key={day.dayNumber} day={day} />
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

        :global(.calendar-radio-label) {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          cursor: pointer;
          font-size: 1.2rem;
        }

        :global(.calendar-radio-label input[type="radio"]) {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }

        .calendar-empty {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>
    </div>
  )
}

