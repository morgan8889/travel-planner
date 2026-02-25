# Gmail Inbox UX Improvements Design

**Goal:** Ensure every unmatched import item always shows a date, and make assign/dismiss buttons give clear visual feedback so users know their action worked.

**Architecture:** Three focused changes — one backend (email date fallback), two frontend (optimistic mutations, button styling).

**Tech Stack:** FastAPI (backend), React + TanStack Query (frontend)

---

## 1. Email Date Fallback (Backend)

**Problem:** When Claude can't extract a travel date from the email body, `parsed_data.date` is null and the unmatched item shows no date in the UI.

**Solution:** Extract the Gmail `Date` header during the scan and store it as `parsed_data.email_date` (YYYY-MM-DD) when Claude returns no date. Every unmatched item will then always have either `date` (travel date) or `email_date` (when the email was sent).

**Changes:**
- In `_run_scan_background` (gmail.py), after extracting headers, parse the `Date` header using `email.utils.parsedate_to_datetime`
- In the `no_date→unmatched` code path, inject `email_date` into the `parsed` dict before saving to `UnmatchedImport.parsed_data`
- No model or migration changes — `parsed_data` is JSONB

## 2. Optimistic UI for Assign/Dismiss (Frontend Hooks)

**Problem:** After clicking Assign or Dismiss, nothing visually happens until the query refetch completes. On slow connections this feels broken.

**Solution:** Use TanStack Query's optimistic update pattern in `useAssignUnmatched`, `useDismissUnmatched`, and `useDismissAllUnmatched`:
- `onMutate`: Cancel outgoing refetches, snapshot current inbox cache, remove item(s) from cached `unmatched` array
- `onError`: Roll back to snapshot
- `onSettled`: Invalidate inbox query to refetch fresh data

The row disappears instantly on click. If the request fails, it reappears.

## 3. Button Styling and Date Display (Frontend Component)

**Problem:** Dismiss button looks like plain text (no background). Buttons don't show loading state. No-date items have incomplete info line.

**Changes to `UnmatchedRow`:**
- **Date display:** Show `parsed_data.date` formatted as readable date. If absent, show `parsed_data.email_date` with "(sent)" suffix in muted styling
- **Assign button:** Show a spinner icon replacing text while `isPending`
- **Dismiss button:** Add visible background (`bg-cloud-100 rounded hover:bg-cloud-200`) so it looks like a real button. Show spinner while pending.
- **Clear all button:** Show spinner while pending

## Types Update

Add `email_date?: string` to the `UnmatchedImport.parsed_data` interface in `types.ts`.
