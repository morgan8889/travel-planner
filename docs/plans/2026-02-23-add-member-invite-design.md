# Add Member Invite Flow — Design

**Date:** 2026-02-23

## Problem

Adding a member by email fails with 404 if the person doesn't have an account yet. There's no way to invite someone who hasn't signed up. The error message is raw and unhelpful.

## Solution

When the target email isn't in the system, send a Supabase invite email and show the invitation as a pending row in the members list. When the invitee signs up via the link, they're automatically added to the trip on next load.

---

## Data Model

New table: **`trip_invitations`**

| column | type | notes |
|---|---|---|
| `id` | UUID PK | default gen_random_uuid() |
| `trip_id` | UUID FK → trips | ON DELETE CASCADE |
| `email` | text | stored lowercase |
| `invited_by` | UUID FK → user_profiles | |
| `created_at` | timestamptz | default now() |

No token column — Supabase manages the magic-link token internally. Matching is done by email when the invitee signs in.

---

## Backend

### Config
Add `SUPABASE_SERVICE_ROLE_KEY` to `backend/.env` and `Settings` in `config.py`.

### `POST /trips/{id}/members` — updated logic

1. Look up email in `user_profiles` → found → add as member, return 201 (unchanged)
2. Fall back to `auth.users` SQL query → found → upsert profile, add as member, return 201 (unchanged)
3. Neither found → call Supabase Admin API `POST /auth/v1/admin/users` with `{ email, data: { invite: true } }` to send invite email → insert row into `trip_invitations` → return **202** `{ "status": "invited", "email": "..." }`

### `GET /trips` and `GET /trips/{id}` — auto-claim

After fetching, if the current user has a non-null email, query `trip_invitations WHERE email = :user_email`. For each match, insert into `trip_members` (role=member) and delete the invitation row — all in the same transaction. Silent, self-healing (same pattern as auto-complete).

### `GET /trips/{id}/invitations` — new endpoint

Returns list of pending invitations for a trip. Owner-only. Used by the frontend members list.

Response schema:
```json
[{ "id": "...", "email": "...", "invited_by": "...", "created_at": "..." }]
```

---

## Frontend

### `useAddMember` hook
- On **201**: existing behaviour (invalidate trip detail)
- On **202**: close modal, show toast "Invite sent to {email}", invalidate invitations query

### `useInvitations(tripId)` — new query
- Calls `GET /trips/{id}/invitations`
- Query key: `tripKeys.invitations(tripId)` (add to factory)
- Only fetches if current user is the trip owner

### Members list UI
Pending invitations rendered below confirmed members:
- Greyed-out circular avatar placeholder (initials `?`)
- Email as the display name
- Amber `Pending` badge
- No role dropdown, no remove button

### `AddMemberModal`
No visual change. 202 response handled in `TripDetailPage.handleAddMember` — close modal on success, show toast.

---

## Error handling

| Scenario | Response | UI |
|---|---|---|
| Email already a member | 409 | "Already a member" in modal |
| Email not found, invite sent | 202 | Toast: "Invite sent to …" |
| Supabase invite API fails | 500 | "Failed to send invite" in modal |
| Trip not found | 404 | (unchanged) |
| Not owner | 403 | (unchanged) |

---

## Out of scope
- Cancelling a pending invitation
- Resending an invite
- Invite expiry
