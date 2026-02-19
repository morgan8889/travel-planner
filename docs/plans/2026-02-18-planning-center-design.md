# Planning Center Design

Replaces the current Calendar page with a multi-zoom planning center inspired by Google Calendar and Fantastical.

## Decisions

| Aspect | Decision |
|--------|----------|
| Primary view | Month view with rich day cells, trip spans, holiday labels |
| Zoom levels | Month, Quarter, Year (pill toggle in header) |
| Trip display | Colored horizontal bars spanning date ranges + shaded day backgrounds |
| Detail panel | Slide-in sidebar (right side, ~350px) for trip detail, creation, holiday info |
| Trip creation | Click-drag across days opens sidebar form pre-filled with dates |
| Holidays | Country picker (US, UK, etc.) powered by Python `holidays` library |
| Custom days | Manual add via sidebar form, optional annual recurrence |
| PTO/Blocks | Removed entirely |

## Page Layout

```
+------------------------------------------------------------------+
|  Planning Center                    [Month v]  [< Feb 2026 >]    |
|  [Month] [Quarter] [Year]           Holidays: [US v] [+ Add]     |
+------------------------------------------------------+-----------+
|                                                      |           |
|                CALENDAR GRID                         |  SIDEBAR   |
|           (varies by zoom level)                     | (slides in |
|                                                      |  on click) |
|                                                      |           |
+------------------------------------------------------+-----------+
```

- Header: zoom toggle pill group, month/quarter/year navigation arrows, holiday country picker, "+ Add" custom day button
- Calendar grid: full-width when sidebar closed, shrinks when sidebar open
- Sidebar: hidden by default, slides in from right on interaction

## Month View (Default)

7-column day grid. Each cell shows:

- Day number (top-left)
- Holiday/custom day label (subtle text below number)
- Today indicator: colored ring around day number

Trips render as horizontal colored bars spanning their date range across cells. If trips overlap, bars stack vertically. Clicking a bar opens sidebar with trip details.

Click-drag: mousedown on start day, drag to end day, highlight follows cursor. On mouseup sidebar opens with trip creation form pre-filled with selected dates.

## Quarter View

3 months side-by-side with condensed day cells. Trip days shown as colored cell backgrounds. Holidays as small dots. Trip legend below the grid with colored bars showing name and dates. Click a month header to zoom into Month view.

## Year View

4x3 grid of 12 mini-months. Each day is a small colored cell. Trip days colored, holidays dotted. Read-only (no trip creation). Click a month to zoom into Month view.

## Sidebar Panel

Contextual content based on trigger:

**Trip Detail** (click trip span): destination, dates, status badge, activity/checklist counts, quick actions (View Trip, Edit Dates, Delete Trip).

**Trip Creation** (after drag-select): pre-filled date range, destination field with geocode autocomplete, trip type selector, Create button.

**Holiday Detail** (click holiday): name, date, type (federal, etc.), description.

**Add Custom Day** (from + Add button): name, date, recurring toggle, Add button.

## Data Model Changes

### Remove

- `calendar_blocks` table and CalendarBlock model
- `annual_plans` table and AnnualPlan model
- BlockType enum
- All calendar block API endpoints
- Frontend: CreateBlockModal, block-related hooks and types

### Add

```python
class HolidayCalendar(Base):
    id: UUID
    user_id: UUID
    country_code: str   # "US", "UK", "CA"
    year: int
    created_at: datetime

class CustomDay(Base):
    id: UUID
    user_id: UUID
    name: str
    date: date
    recurring: bool     # repeats annually
    created_at: datetime
```

Holiday dates computed from `holidays` Python library based on enabled country codes. Not stored in database.

### API Endpoints

```
GET    /calendar/holidays?year=2026       # enabled holidays + custom days
POST   /calendar/holidays/country         # enable country calendar
DELETE /calendar/holidays/country/{code}  # disable country calendar
POST   /calendar/custom-days              # add custom day
DELETE /calendar/custom-days/{id}         # remove custom day
```

Trips read from existing `/trips` endpoint (no changes needed).

## Frontend Components

```
pages/
  PlanningCenterPage.tsx        # replaces CalendarPage.tsx

components/planning/
  PlanningHeader.tsx            # zoom toggle, nav, holiday picker
  MonthView.tsx                 # full month grid with trip spans
  QuarterView.tsx               # 3-month condensed view
  YearView.tsx                  # 12 mini-month overview
  DayCell.tsx                   # individual day cell
  TripSpan.tsx                  # horizontal trip bar
  PlanSidebar.tsx               # slide-in sidebar container
  SidebarTripDetail.tsx         # trip info
  SidebarTripCreate.tsx         # trip creation form
  SidebarHolidayDetail.tsx      # holiday info
  SidebarCustomDayForm.tsx      # add custom day form
  useDragSelect.ts              # hook for click-drag date selection

hooks/
  useHolidays.ts                # replaces useCalendar.ts
```

Route: `/calendar` points to `PlanningCenterPage`.

## State Management

- Zoom level, current month/quarter/year, sidebar open/content: local React state in PlanningCenterPage
- Trips: existing `useTrips()` hook
- Holidays + custom days: new `useHolidays(year)` hook
- Drag selection: `useDragSelect` hook tracking mousedown/mousemove/mouseup

## Migration

Alembic migration to:
1. Drop `calendar_blocks` table
2. Drop `annual_plans` table
3. Create `holiday_calendars` table
4. Create `custom_days` table
