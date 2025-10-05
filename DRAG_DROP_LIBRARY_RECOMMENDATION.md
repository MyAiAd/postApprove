# Drag-and-Drop Library Recommendation for Calendar Feature

## Executive Summary
For the PostApprove calendar feature with 31-day grid and snap-to-grid functionality, I recommend **@dnd-kit/core** with **@dnd-kit/sortable** as the primary solution.

---

## Top Recommendations (Ranked)

### 🥇 1. **@dnd-kit/core + @dnd-kit/sortable** (RECOMMENDED)
**Best for: Calendar grid layouts with snap-to-grid**

**Pros:**
- ✅ Modern, lightweight, and actively maintained (2024+)
- ✅ Built specifically for React with hooks
- ✅ Excellent TypeScript support
- ✅ Modular architecture - only import what you need
- ✅ Built-in snap-to-grid functionality via `snapCenterToCursor` modifier
- ✅ Handles keyboard navigation, screen readers (accessibility)
- ✅ Works with virtual scrolling
- ✅ No dependencies on legacy drag-and-drop APIs
- ✅ Great documentation and examples

**Cons:**
- ⚠️ Steeper learning curve than simpler libraries
- ⚠️ More setup required initially

**Installation:**
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Why it's best for our use case:**
- Perfect for calendar grid (31 squares)
- Built-in collision detection and snap modifiers
- Can handle both sortable lists AND grid layouts
- Active community and excellent examples
- Used by many production apps

**Example Use Case:**
```jsx
import {DndContext, closestCenter} from '@dnd-kit/core';
import {SortableContext, rectSortingStrategy} from '@dnd-kit/sortable';

// Calendar grid with 31 draggable squares
// Each square snaps to grid position
// Supports day-to-day post reordering
```

---

### 🥈 2. **react-grid-layout**
**Best for: Dashboard-style layouts**

**Pros:**
- ✅ Specifically designed for grid layouts
- ✅ Built-in responsive breakpoints
- ✅ Drag, drop, AND resize functionality
- ✅ Collision detection
- ✅ Well-established (used in production apps)

**Cons:**
- ⚠️ Heavier than dnd-kit
- ⚠️ More focused on resizable dashboards than calendar grids
- ⚠️ Less flexible for custom calendar layouts

**Installation:**
```bash
npm install react-grid-layout
```

**Use Case:**
Better for dashboard-style interfaces where each grid item can be different sizes. Might be overkill for a simple 31-day calendar.

---

### 🥉 3. **react-beautiful-dnd**
**Best for: Lists and Kanban boards**

**Pros:**
- ✅ Beautiful animations
- ✅ Great for vertical/horizontal lists
- ✅ Simple API
- ✅ Well-documented

**Cons:**
- ⚠️ **No longer actively maintained** (archived by Atlassian)
- ⚠️ Not ideal for 2D grids
- ⚠️ Primarily for list-based drag-and-drop

**Status:** Not recommended due to lack of maintenance.

---

### 4. **interact.js**
**Best for: Vanilla JS or advanced interactions**

**Pros:**
- ✅ Framework agnostic
- ✅ Powerful snap and restriction modifiers
- ✅ Multi-touch support

**Cons:**
- ⚠️ Not React-specific (need wrapper)
- ⚠️ More low-level API
- ⚠️ Requires more boilerplate

---

### 5. **react-dnd**
**Best for: Complex drag-and-drop interactions**

**Pros:**
- ✅ Extremely flexible
- ✅ Built on HTML5 drag-and-drop API
- ✅ Good for complex interactions

**Cons:**
- ⚠️ Older architecture (Redux-like)
- ⚠️ More complex than needed for calendar
- ⚠️ No built-in snap-to-grid (requires custom logic)

---

## 📋 Feature Comparison Matrix

| Feature | dnd-kit | react-grid-layout | react-beautiful-dnd | interact.js |
|---------|---------|-------------------|---------------------|-------------|
| Snap-to-Grid | ✅ Built-in | ✅ Built-in | ❌ Manual | ✅ Built-in |
| Calendar Grid | ✅ Perfect | ⚠️ Overkill | ❌ No | ⚠️ Manual |
| Active Maintenance | ✅ Yes | ✅ Yes | ❌ Archived | ✅ Yes |
| React Integration | ✅ Native | ✅ Native | ✅ Native | ⚠️ Wrapper |
| TypeScript | ✅ Excellent | ⚠️ Good | ✅ Good | ⚠️ OK |
| Bundle Size | ✅ Small | ⚠️ Medium | ⚠️ Medium | ✅ Small |
| Learning Curve | ⚠️ Medium | ⚠️ Medium | ✅ Easy | ⚠️ High |
| Accessibility | ✅ Built-in | ⚠️ Manual | ✅ Built-in | ❌ Manual |

---

## 🎯 Final Recommendation for PostApprove Calendar

### Use: **@dnd-kit/core + @dnd-kit/sortable**

**Implementation Plan:**

1. **Phase 1: Basic Grid Layout**
   - Create 31 calendar squares
   - Each square displays day number + post title
   - No drag-and-drop yet (stub)

2. **Phase 2: Add Drag-and-Drop**
   ```bash
   npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
   ```

3. **Phase 3: Configure Snap-to-Grid**
   - Use `rectSortingStrategy` for grid layout
   - Use `snapCenterToCursor` modifier for snap behavior
   - Configure 31 grid positions (7x5 grid with some empty cells)

4. **Phase 4: Persist Changes**
   - On drop, update `day_number` and `assigned_date` in database
   - Real-time sync via Supabase

---

## 📚 Helpful Resources

### dnd-kit Documentation:
- Official Docs: https://docs.dndkit.com/
- Examples: https://master--5fc05e08a4a65d0021ae0bf2.chromatic.com/
- GitHub: https://github.com/clauderic/dnd-kit

### Example Implementations:
- Grid Example: https://master--5fc05e08a4a65d0021ae0bf2.chromatic.com/?path=/story/presets-sortable-grid--basic-setup
- Calendar-like Layout: https://codesandbox.io/s/dnd-kit-sortable-grid-example

---

## 💡 Alternative Approach: Custom Implementation

If you want maximum control and minimal dependencies:

**Option: CSS Grid + Custom Drag Logic**
- Use CSS Grid for 31-day layout
- Implement basic drag using React state
- Manual snap-to-grid with CSS transforms
- Pros: Full control, no dependencies
- Cons: More work, need to handle edge cases

**Verdict:** Not recommended. dnd-kit provides better UX and handles edge cases.

---

## 🚀 Next Steps

1. ✅ Run database migration (supabase-calendar-schema.sql)
2. Create basic calendar grid UI (31 squares)
3. Install @dnd-kit packages
4. Implement drag-and-drop with snap-to-grid
5. Connect to Supabase for persistence

---

## Summary

**Winner: @dnd-kit/core + @dnd-kit/sortable**

This library provides the perfect balance of:
- Modern React integration
- Built-in snap-to-grid
- Active maintenance
- Excellent documentation
- Production-ready
- Accessibility support

It's the industry standard for React drag-and-drop in 2024/2025.

