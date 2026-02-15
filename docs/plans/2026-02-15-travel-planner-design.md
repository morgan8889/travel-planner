# Travel Planner — Design Document

**Date**: 2026-02-15
**Status**: Approved

## Overview

A shared web-based travel planner for a small group (family/friends) with annual calendar planning, full trip lifecycle management, AI-powered assistance, and automatic Gmail import of bookings.

## Architecture

```
┌─────────────────────────────────────┐
│         React SPA (Vite)            │
│  Annual Calendar · Trip Views · Chat│
├─────────────────────────────────────┤
│              ▼  REST API            │
├─────────────────────────────────────┤
│         FastAPI Backend             │
│  Trip CRUD · AI Services · Auth     │
├──────────┬──────────────────────────┤
│          ▼                ▼         │
│   Supabase (Postgres)   Claude API  │
│   DB · Auth · Storage    AI Engine  │
└──────────────────────────────────────┘
```

- **React + Vite** frontend SPA
- **FastAPI** monolith backend handling CRUD and AI orchestration
- **Supabase** for Postgres database, user auth (magic link), and file storage
- **Claude API** for all AI features

## Data Model

### User
Managed by Supabase Auth. Profile stores display name and travel preferences (interests, pace, budget comfort level).

### Trip
Central entity. Fields:
- `type`: vacation | remote_week | sabbatical
- `destination`, `dates`, `status`: dreaming | planning | booked | active | completed
- `parent_trip_id`: nullable FK to a sabbatical (for nesting trips within a sabbatical)

Sabbaticals are date ranges that visually group other trips/remote weeks on the calendar.

### Trip Members
Join table: user + trip + role (owner | member). Owner can delete trip and remove members. Members have full edit access.

### Annual Plan
One per user per year. Calendar view metadata: year, notes.

### Calendar Block
- `type`: pto | holiday
- `dates`, `destination` (optional), `notes`

Trips/remote weeks/sabbaticals appear on the calendar via the Trip entity. PTO days and holidays use CalendarBlock.

### Itinerary Day
One per day of a trip. Contains ordered activities. For remote weeks, a work block is shown with activities planned around it.

### Activity
Belongs to an itinerary day. Fields:
- `time`, `location`, `notes`, `confirmation_number`
- `category`: transport | food | activity | lodging
- `source`: manual | gmail_import
- `source_ref`: email ID (nullable)
- `import_status`: pending_review | confirmed | rejected (for imports only)

### Checklist
Belongs to a trip. Packing lists and prep tasks. Items are checkable per-user.

### Chat Thread
Belongs to a trip (or global). Stores AI assistant conversation history.

### Gmail Connection
Per-user OAuth tokens, sync state, last sync timestamp.

## Core Features

### Annual Calendar View (Home)
- Year-at-a-glance with trips, remote weeks, sabbaticals, PTO, and holidays as colored blocks
- Public holidays auto-detected by country
- Drag to create a new trip directly on the calendar
- Season/weather indicators for travel window planning
- Each user sees their own personal calendar

### Trip Dashboard
- Overview: destination, dates, status, members, countdown
- Tabs: Itinerary | Checklists | Chat Assistant | Imports
- Status progression: dreaming → planning → booked → active → completed

### Itinerary Builder
- Day-by-day timeline view of activities
- Manual add + Gmail auto-import (with pending review badge)
- "AI Generate" button: drafts a full itinerary from destination, dates, and preferences
- Remote weeks: AI respects work hours, plans activities around them
- Drag to reorder activities within/across days

### AI Chat Assistant
- Per-trip context: knows destination, dates, itinerary, members, trip type
- Conversational: restaurant recs, replanning around weather, packing advice
- Can take action: "add that restaurant to Thursday" creates an Activity directly
- Persistent conversation history

### Checklists
- Pre-built templates: packing (by climate/trip type), documents, pre-departure tasks
- Per-user checkboxes (each member tracks their own progress)
- AI-generated custom packing lists based on destination + weather + trip length

### Gmail Import
- One-time OAuth connection per user
- Auto-scans for booking confirmation emails
- AI parses emails to extract: type, dates, times, location, confirmation number
- Matches to existing trips by date overlap and destination
- Review queue: accept (assigns to trip) or reject (dismissed)

## AI Features

Three touchpoints, all powered by Claude API with different system prompts and context injection:

1. **Itinerary Generation** — full draft itinerary from destination + dates + preferences. Respects remote week work hours.
2. **Chat Assistant** — scoped per-trip with full context. Can create Activities from conversation.
3. **Gmail Import Parser** — extracts structured booking data from varied email formats.

## Auth & Sharing

- Supabase Auth with magic link (email-based, passwordless)
- Invite family/friends by email to shared trips
- All trip members have equal edit access
- Annual calendar is personal per user
- Gmail OAuth is per-user; imported bookings suggest matching to shared trips

## Tech Stack

### Frontend
- React 18 + TypeScript + Vite
- TanStack Router + TanStack Query
- Tailwind CSS
- FullCalendar or custom year view
- dnd-kit for drag-and-drop

### Backend
- FastAPI + Python 3.12
- Pydantic v2
- Anthropic SDK (Claude API)
- Google API client (Gmail OAuth)
- SQLAlchemy + Alembic

### Infrastructure
- Supabase (Postgres, Auth, Storage)
- Vercel (frontend)
- Railway (backend)

### Development Tooling
- uv (Python package management)
- Ruff (formatting/linting)
- Pyright (type checking)
- Vitest (frontend tests), pytest (backend tests)
