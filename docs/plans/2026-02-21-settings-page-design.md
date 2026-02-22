# Settings Page Design

**Date:** 2026-02-21

## Goal

Create a `/settings` route with a single scrollable page containing three sections: Integrations (Gmail connect/disconnect), Account (email display + delete account), and Dev Tools (seed data, dev-only). Simultaneously fix all production-readiness gaps around hardcoded localhost URLs and missing account deletion.

## Approach

Single scrollable page (Option A) — one `/settings` route, stacked section cards, no tabs or sub-routes. Scales cleanly to the current 2–3 sections.

---

## Architecture

### Backend changes

**`config.py`**
- Add `app_frontend_url: str = "http://localhost:5173"` — used by the Gmail callback to redirect back to the frontend after OAuth
- Add `supabase_service_role_key: str = ""` — used by the delete-account endpoint to call Supabase Admin API

**`routers/gmail.py`**
- Replace hardcoded `http://localhost:5173` redirect URLs with `settings.app_frontend_url`

**`routers/auth.py`** (new)
- `DELETE /auth/me` — authenticated endpoint that:
  1. Deletes all user trips (cascades to itineraries, checklists)
  2. Deletes gmail_connections and import_records for the user
  3. Calls Supabase Admin API (`DELETE /auth/v1/admin/users/{user_id}`) using the service role key
  4. Returns 204

**`main.py`**
- Register the new auth router

### Frontend changes

**`router.tsx`**
- Add `/settings` route → `SettingsPage`
- Remove `/dev/seed` route and its dynamic import

**`RootLayout.tsx`**
- Replace the `Sign Out` button area with: gear icon linking to `/settings`, then Sign Out button (keep both)
- Gear icon uses `Settings` from lucide-react

**`SettingsPage.tsx`** (new page)
- Three stacked cards:
  1. **Integrations** — Gmail connection status + Connect/Disconnect
  2. **Account** — current email (read-only) + Delete Account button with ConfirmDialog
  3. **Dev Tools** — full DevSeedPage content, rendered only when `import.meta.env.DEV`
- Delete account flow: calls `DELETE /auth/me` → on success calls `supabase.auth.signOut()` → navigates to `/`

**`GmailImportSection.tsx`** (modify)
- Remove `handleConnect`, `disconnectMutation`, and the Connect Gmail / Disconnect buttons
- When `status?.connected` is false, show: `"Connect Gmail in Settings to import travel emails"` (plain text with a Link to `/settings`)
- When connected, show only scan button + pending review list

**`DevSeedPage.tsx`**
- Delete file entirely; content moves into the Dev Tools section of `SettingsPage`

**`hooks/useAuth.ts`** (new hook) or inline in SettingsPage
- `useDeleteAccount` mutation: calls `api.delete('/auth/me')`, on success calls `supabase.auth.signOut()`

### API additions

**`lib/api.ts`**
- Add `authApi` namespace with `deleteAccount: () => api.delete('/auth/me')`

---

## Data flow

**Gmail connect:**
User clicks Connect Gmail in Settings → `gmailApi.getAuthUrl()` → redirect to Google → callback hits `GET /gmail/callback` → backend stores tokens → redirects to `{APP_FRONTEND_URL}/settings` (not a trip page, since connect is now global)

**Delete account:**
User clicks Delete Account → ConfirmDialog → `DELETE /auth/me` → backend cascades deletes → calls Supabase Admin API → 204 → frontend `signOut()` → redirect to `/`

---

## Error handling

- Delete account: show inline error if the request fails; don't sign out on failure
- Gmail status loading: `GmailImportSection` already returns null while loading; nudge text only shows when status is confirmed not-connected

---

## Testing

**Backend:**
- `tests/test_auth.py` (new): test `DELETE /auth/me` returns 204, verify Supabase admin call is mocked
- `tests/test_gmail.py`: update callback test to verify redirect uses `app_frontend_url` not hardcoded localhost

**Frontend:**
- `__tests__/SettingsPage.test.tsx` (new): renders Integrations section, shows Connect Gmail when not connected; shows Disconnect when connected; shows Dev Tools only in DEV; delete account calls mutation and signs out
- `__tests__/GmailImportSection.test.tsx`: update — remove connect/disconnect button tests, add "Connect in Settings" nudge test

---

## Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `APP_FRONTEND_URL` | backend `.env` | OAuth callback redirect target |
| `SUPABASE_SERVICE_ROLE_KEY` | backend `.env` | Delete user via Admin API |
| `VITE_APP_URL` | frontend `.env.local` | (not needed — backend handles redirects) |

No new frontend env vars required; all redirect logic lives in the backend.
