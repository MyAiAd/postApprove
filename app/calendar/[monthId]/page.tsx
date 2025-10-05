'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase, Calendar, Campaign } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'
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

// Blank Day Component (reusable)
function BlankDayCard() {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: 'blank-template',
    disabled: false,
    // Don't allow dropping on the blank template
    data: {
      type: 'blank-template',
      accepts: [] // Don't accept any drops
    }
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="sidebar-post-card blank-card"
      {...attributes}
      {...listeners}
    >
      <div className="sidebar-post-title">📋 Blank Day</div>
      <div className="sidebar-post-subtitle">Drag to mark as blank</div>
    </div>
  )
}

// Sidebar Posts Component
function SidebarPostsList({ posts, collapsed, onToggle }: { posts: Campaign[]; collapsed: boolean; onToggle: () => void }) {
  const {
    setNodeRef,
  } = useSortable({
    id: 'sidebar',
    disabled: false
  })

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <button 
        className="sidebar-toggle-btn" 
        onClick={onToggle}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? '→' : '←'}
      </button>
      
      {/* Always keep drop zone active - only visible/active when collapsed */}
      {collapsed && (
        <div ref={setNodeRef} className="sidebar-drop-zone">
          <div className="collapsed-drop-indicator">Drop here</div>
        </div>
      )}
      
      {!collapsed && (
        <>
          {/* Drop zone for expanded state - positioned at bottom */}
          <div ref={setNodeRef} className="sidebar-drop-zone-expanded" />
          
          <div className="sidebar-header">
            <h3>Tools</h3>
            <p className="sidebar-subtitle">Drag to calendar</p>
          </div>
          <div className="sidebar-posts">
            <BlankDayCard />
            
            {posts.length > 0 && (
              <>
                <div className="sidebar-divider" />
                <div className="sidebar-section-title">Individual Posts</div>
                {posts.map(post => (
                  <SidebarPost key={post.id} post={post} />
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// Individual sidebar post item
function SidebarPost({ post }: { post: Campaign }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: post.id,
    disabled: false
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="sidebar-post-card"
      {...attributes}
      {...listeners}
    >
      <div className="sidebar-post-title">{post.name}</div>
    </div>
  )
}

// Sortable Calendar Square Component
function CalendarSquare({ day, calendarId }: { day: CalendarDay; calendarId: string }) {
  // Log any suspicious campaigns
  if (day.campaign && !day.campaign.id) {
    console.error('Campaign without ID detected!', day.campaign)
  }
  
  const campaignId = day.campaign?.id || `empty-${day.dayNumber}`
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: campaignId,
    // Don't disable - we want empty squares to be drop targets
    disabled: false
  })
  
  // Log when blank is detected
  if (day.campaign?.name === 'blank') {
    console.log('Blank at position', day.dayNumber, 'with ID:', campaignId)
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  
  // All squares are draggable - blank campaigns have DB records too
  const dragHandlers = listeners

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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
              <a
                href={`/calendar/${calendarId}/add/${day.dayNumber}`}
                className="calendar-blank-link"
                onClick={(e) => e.stopPropagation()}
              >
                blank
              </a>
              <button
                onClick={async (e) => {
                  e.stopPropagation()
                  if (confirm('Delete this blank? Posts after it will shift left.')) {
                    try {
                      await supabase.from('campaigns').delete().eq('id', day.campaign!.id)
                      window.location.reload()
                    } catch (error) {
                      console.error('Error deleting:', error)
                      alert('Error deleting: ' + error)
                    }
                  }
                }}
                className="delete-inline-btn"
              >
                🗑️
              </button>
            </div>
          </div>
        ) : (
          // Regular campaign with content
          <div className="calendar-post-content">
            {day.hasDetail ? (
              <a
                href={`/approve/${day.campaign.id}`}
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
  const [individualPosts, setIndividualPosts] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [approving, setApproving] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const allDraggableIds = [
    ...days.map(d => d.campaign?.id || `empty-${d.dayNumber}`),
    ...individualPosts.map(p => p.id),
    'sidebar', // Drop zone for returning to sidebar
    'blank-template' // Reusable blank day
  ]

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

      // Load individual posts (not in any calendar)
      const { data: individualPostsData, error: individualError } = await supabase
        .from('campaigns')
        .select('*')
        .is('calendar_id', null)
        .order('created_at', { ascending: false })

      if (individualError) throw individualError
      setIndividualPosts(individualPostsData || [])

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

      // Create dynamic days array based on actual campaigns (not fixed 31 days)
      const daysArray: CalendarDay[] = campaignsWithDetail.map(({ campaign, hasDetail }) => ({
        dayNumber: campaign.day_number!,
        campaign: campaign,
        hasDetail: hasDetail
      }))

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

    if (!over || isDragging) return // Prevent multiple simultaneous operations

    setIsDragging(true)

    const activeId = active.id as string
    const overId = over.id as string
    
    console.log('Drag end:', { activeId, overId })

    // Check if dragging from sidebar or calendar
    const activeSidebarPost = individualPosts.find(p => p.id === activeId)
    const activeCalendarIndex = days.findIndex(d => 
      d.campaign?.id === activeId || `empty-${d.dayNumber}` === activeId
    )
    
    const overCalendarIndex = days.findIndex(d => 
      d.campaign?.id === overId || `empty-${d.dayNumber}` === overId
    )
    // Treat drops on 'sidebar' or 'blank-template' as dropping on sidebar
    const overIsSidebar = overId === 'sidebar' || overId === 'blank-template'
    
    // Blank template -> Calendar day (insert and shift right)
    if (activeId === 'blank-template' && overCalendarIndex !== -1) {
      const targetDay = days[overCalendarIndex]
      const targetDayNumber = targetDay.dayNumber
      const targetPost = targetDay.campaign
      
      console.log('Inserting blank at position:', targetDayNumber)
      
      try {
        // If target has non-blank content, move it to sidebar first
        if (targetPost && targetPost.name !== 'blank') {
          console.log('Moving existing content to sidebar:', targetPost.id)
          await supabase.from('campaigns').update({ 
            calendar_id: null, 
            day_number: null 
          }).eq('id', targetPost.id)
        }
        
        // Get all campaigns at and after this position (excluding the one we just moved)
        const campaignsToShift = days
          .filter(d => d.campaign && d.dayNumber >= targetDayNumber && d.campaign.id !== targetPost?.id)
          .sort((a, b) => b.dayNumber - a.dayNumber) // Descending order for right shift
        
        console.log('Campaigns to shift right:', campaignsToShift.length)
        
        // Shift in parallel (much faster)
        if (campaignsToShift.length > 0) {
          await Promise.all(
            campaignsToShift.map(day =>
              supabase.from('campaigns')
                .update({ day_number: day.dayNumber + 1 })
                .eq('id', day.campaign!.id)
            )
          )
          console.log('Shifted', campaignsToShift.length, 'campaigns right')
        }
        
        // Now insert or update to create blank at target position
        if (targetPost && targetPost.name === 'blank') {
          // It was already a blank, just ensure it's set correctly
          console.log('Target was already blank, confirming')
          await supabase.from('campaigns').update({ 
            name: 'blank',
            instructions: '',
            title_approved: true,
            body_approved: true,
            calendar_id: monthId,
            day_number: targetDayNumber
          }).eq('id', targetPost.id)
        } else {
          // Create new blank
          console.log('Creating new blank at position:', targetDayNumber)
          await supabase.from('campaigns').insert({
            id: uuidv4(),
            calendar_id: monthId,
            day_number: targetDayNumber,
            name: 'blank',
            instructions: '',
            title_approved: true,
            body_approved: true
          })
        }
        
        await loadCalendarData()
      } catch (error) {
        console.error('Error inserting blank:', error)
        setMessage(`Error: ${error}`)
      } finally {
        setIsDragging(false)
      }
      return
    }

    // Sidebar post -> Calendar day
    if (activeSidebarPost && overCalendarIndex !== -1) {
      const targetDay = days[overCalendarIndex]
      const targetPost = targetDay.campaign

      try {
        // Swap if target has content, otherwise just place
        if (targetPost && targetPost.name !== 'blank') {
          await supabase.from('campaigns').update({ 
            calendar_id: monthId, 
            day_number: targetDay.dayNumber 
          }).eq('id', activeSidebarPost.id)

          await supabase.from('campaigns').update({ 
            calendar_id: null, 
            day_number: null 
          }).eq('id', targetPost.id)
        } else {
          await supabase.from('campaigns').update({ 
            calendar_id: monthId, 
            day_number: targetDay.dayNumber 
          }).eq('id', activeSidebarPost.id)
        }

        await loadCalendarData()
      } catch (error) {
        console.error('Error moving sidebar post:', error)
        setMessage(`Error: ${error}`)
      } finally {
        setIsDragging(false)
      }
      return
    }

    // Calendar post -> Sidebar
    if (activeCalendarIndex !== -1 && overIsSidebar) {
      const activePost = days[activeCalendarIndex].campaign
      const activeDayNumber = days[activeCalendarIndex].dayNumber
      
      console.log('Dragging to sidebar:', { 
        post: activePost?.name, 
        isBlank: activePost?.name === 'blank',
        dayNumber: activeDayNumber 
      })
      
      if (activePost) {
        try {
          const isBlank = activePost.name === 'blank'
          
          // Get all campaigns that need to be shifted (before any deletion)
          const campaignsToShift = days
            .filter(d => d.campaign && d.dayNumber > activeDayNumber && d.campaign.id !== activePost.id)
            .sort((a, b) => a.dayNumber - b.dayNumber) // Ascending order
          
          console.log('Campaigns to shift:', campaignsToShift.length)
          
          // Perform the main action (delete or move to sidebar)
          if (isBlank) {
            console.log('Deleting blank:', activePost.id)
            const { error: deleteError } = await supabase
              .from('campaigns')
              .delete()
              .eq('id', activePost.id)
            
            if (deleteError) {
              console.error('Delete error:', deleteError)
              throw deleteError
            }
          } else {
            console.log('Moving to sidebar:', activePost.id)
            await supabase.from('campaigns').update({ 
              calendar_id: null, 
              day_number: null 
            }).eq('id', activePost.id)
          }
          
          // Now shift all campaigns after this position to the left
          if (campaignsToShift.length > 0) {
            // Use Promise.all for batch updates (much faster)
            await Promise.all(
              campaignsToShift.map(day =>
                supabase.from('campaigns')
                  .update({ day_number: day.dayNumber - 1 })
                  .eq('id', day.campaign!.id)
              )
            )
            console.log('Shifted', campaignsToShift.length, 'campaigns left')
          }
          
          await loadCalendarData()
        } catch (error) {
          console.error('Error removing from calendar:', error)
          setMessage(`Error: ${error}`)
        } finally {
          setIsDragging(false)
        }
      } else {
        setIsDragging(false)
      }
      return
    }

    // Calendar -> Calendar (swap positions)
    if (activeCalendarIndex !== -1 && overCalendarIndex !== -1 && activeId !== overId) {
      try {
        const newDays = arrayMove(days, activeCalendarIndex, overCalendarIndex)
        const updatedDays = newDays.map((day, index) => ({
          ...day,
          dayNumber: index + 1
        }))
        
        setDays(updatedDays)

        const updatePromises = updatedDays
          .filter(day => day.campaign)
          .map(async (day) => {
            await supabase
              .from('campaigns')
              .update({ day_number: day.dayNumber })
              .eq('id', day.campaign!.id)
          })

        await Promise.all(updatePromises).catch(() => loadCalendarData())
      } catch (error) {
        console.error('Error swapping positions:', error)
      } finally {
        setIsDragging(false)
      }
      return
    }
    
    // If we get here, something didn't match - reset the flag
    setIsDragging(false)
  }

  const handleApproveAll = async () => {
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
    <div className="page-container">
      {isDragging && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '1rem 2rem',
          borderRadius: '8px',
          zIndex: 9999,
          fontSize: '1.1rem',
          fontWeight: '600'
        }}>
          Processing...
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={allDraggableIds}
          strategy={rectSortingStrategy}
        >
          <SidebarPostsList 
            posts={individualPosts} 
            collapsed={sidebarCollapsed} 
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
          />

          <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <div className="calendar-header">
              <h1 className="calendar-title">{calendar.name}</h1>
              <p className="calendar-month">{calendar.month} • {days.length} posts</p>
              
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

            <div className="calendar-grid">
              {days.map((day) => (
                <CalendarSquare key={day.dayNumber} day={day} calendarId={monthId} />
              ))}
            </div>
          </div>
        </SortableContext>
      </DndContext>

      <style jsx>{`
        .page-container {
          display: flex;
          min-height: 100vh;
        }

        :global(.sidebar) {
          width: 280px;
          background: #f9fafb;
          border-right: 1px solid #e5e7eb;
          padding: 1.5rem;
          overflow-y: auto;
          position: fixed;
          height: 100vh;
          left: 0;
          top: 0;
          z-index: 10;
          transition: width 0.3s ease, padding 0.3s ease;
        }

        :global(.sidebar.collapsed) {
          width: 50px;
          padding: 1.5rem 0.5rem;
          overflow: visible;
        }

        :global(.sidebar-drop-zone) {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        :global(.sidebar-drop-zone-expanded) {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 100px;
          pointer-events: all;
        }

        :global(.collapsed-drop-indicator) {
          transform: rotate(-90deg);
          color: #9ca3af;
          font-size: 0.7rem;
          white-space: nowrap;
          user-select: none;
        }

        :global(.sidebar-toggle-btn) {
          position: absolute;
          right: -15px;
          top: 50%;
          transform: translateY(-50%);
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: #3b82f6;
          color: white;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          z-index: 100;
          transition: all 0.2s;
        }

        :global(.sidebar-toggle-btn:hover) {
          background: #2563eb;
          transform: translateY(-50%) scale(1.1);
        }

        :global(.sidebar-header) {
          margin-bottom: 1.5rem;
        }

        :global(.sidebar-header h3) {
          font-size: 1.1rem;
          font-weight: 600;
          margin: 0 0 0.25rem 0;
          color: #111827;
        }

        :global(.sidebar-subtitle) {
          font-size: 0.85rem;
          color: #6b7280;
          margin: 0;
        }

        :global(.sidebar-posts) {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        :global(.sidebar-empty) {
          color: #9ca3af;
          font-size: 0.9rem;
          text-align: center;
          padding: 2rem 0;
        }

        :global(.sidebar-post-card) {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 0.75rem;
          cursor: grab;
          transition: all 0.2s;
        }

        :global(.sidebar-post-card.blank-card) {
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          border: 2px dashed #3b82f6;
        }

        :global(.sidebar-post-card.blank-card:hover) {
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
          border-color: #2563eb;
        }

        :global(.sidebar-post-card:hover) {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          border-color: #3b82f6;
        }

        :global(.sidebar-post-card:active) {
          cursor: grabbing;
        }

        :global(.sidebar-post-title) {
          font-size: 0.9rem;
          font-weight: 500;
          color: #374151;
          line-height: 1.4;
        }

        :global(.sidebar-post-subtitle) {
          font-size: 0.75rem;
          color: #6b7280;
          margin-top: 0.25rem;
        }

        :global(.sidebar-divider) {
          height: 1px;
          background: #e5e7eb;
          margin: 1rem 0;
        }

        :global(.sidebar-section-title) {
          font-size: 0.75rem;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.5rem;
        }

        .main-content {
          margin-left: 280px;
          flex: 1;
          padding: 2rem;
          transition: margin-left 0.3s ease;
        }

        .main-content.sidebar-collapsed {
          margin-left: 50px;
        }

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
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 0.75rem;
          margin-bottom: 2rem;
        }

        @media (max-width: 1400px) {
          .calendar-grid {
            gap: 0.5rem;
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          }
        }

        :global(.calendar-square) {
          aspect-ratio: 1;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          padding: 0.5rem;
          background: white;
          display: flex;
          flex-direction: column;
          cursor: grab;
          transition: all 0.2s;
          font-size: 0.85rem;
        }

        @media (max-width: 1400px) {
          :global(.calendar-square) {
            padding: 0.4rem;
            font-size: 0.8rem;
          }
        }

        :global(.calendar-square:active) {
          cursor: grabbing;
        }

        :global(.calendar-square:hover) {
          border-color: #3b82f6;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .calendar-day-number {
          font-size: 1rem;
          font-weight: bold;
          color: #9ca3af;
          margin-bottom: 0.4rem;
        }

        @media (max-width: 1400px) {
          .calendar-day-number {
            font-size: 0.9rem;
            margin-bottom: 0.3rem;
          }
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
          font-size: 0.8rem;
          font-weight: 500;
          line-height: 1.3;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        @media (max-width: 1400px) {
          :global(.calendar-post-title-link) {
            font-size: 0.75rem;
            -webkit-line-clamp: 2;
          }
        }

        :global(.calendar-post-title-link:hover) {
          text-decoration: underline;
        }

        .calendar-post-title {
          color: #374151;
          font-size: 0.8rem;
          font-weight: 500;
          line-height: 1.3;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        @media (max-width: 1400px) {
          .calendar-post-title {
            font-size: 0.75rem;
            -webkit-line-clamp: 2;
          }
        }

        .calendar-approval-buttons {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.5rem;
        }

        :global(.calendar-approval-btn) {
          padding: 0.3rem 0.5rem;
          border: 2px solid #e5e7eb;
          border-radius: 4px;
          background: white;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.2s;
          opacity: 0.4;
        }

        @media (max-width: 1400px) {
          :global(.calendar-approval-btn) {
            padding: 0.25rem 0.4rem;
            font-size: 0.9rem;
          }
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

        :global(.delete-inline-btn) {
          padding: 0.2rem 0.3rem;
          background: transparent;
          border: 1px solid #e5e7eb;
          border-radius: 3px;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.2s;
          opacity: 0.4;
          flex-shrink: 0;
        }

        :global(.delete-inline-btn:hover) {
          opacity: 1;
          background: #fee2e2;
          border-color: #dc2626;
        }

        @media (max-width: 1400px) {
          :global(.delete-inline-btn) {
            padding: 0.15rem 0.25rem;
            font-size: 0.75rem;
          }
        }
      `}</style>
    </div>
  )
}

