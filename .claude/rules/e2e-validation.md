# E2E Validation Protocol

After any frontend or backend change, verification must go beyond unit tests.

## 1. Static Checks

Run `tsc --noEmit` and `vitest run` to confirm type safety and unit tests pass.

## 2. Start Both Servers

```bash
cd backend && uv run uvicorn travel_planner.main:app --port 8000
cd frontend && npm run dev
```

- Backend on `:8000`
- Frontend on Vite dev port (`:5173`)

## 3. Browser Verification with Playwright MCP

- Navigate to the app in a real browser
- Use `browser_snapshot` to verify page structure
- Use `browser_click`, `browser_type`, `browser_fill_form` for interactions

### Auth Testing
Use Supabase anonymous sign-in to get a real session:
```
POST ${SUPABASE_URL}/auth/v1/signup
Headers: apikey: ${SUPABASE_ANON_KEY}, Content-Type: application/json
Body: {}
```
Inject the returned session into localStorage key `sb-rinmqfynbjsqitjzxrnt-auth-token`, then reload.

### Stale Session Testing
Inject a fake expired JWT into localStorage key `sb-rinmqfynbjsqitjzxrnt-auth-token`:
```javascript
localStorage.setItem('sb-rinmqfynbjsqitjzxrnt-auth-token', JSON.stringify({
  access_token: 'expired.jwt.token',
  refresh_token: 'fake',
  expires_at: 0
}));
```
Reload and verify the app recovers gracefully:
- No infinite spinners
- No 401 request storms
- Session clears and redirects to login

## 4. Monitor Backend Logs

Check uvicorn output for:
- Unexpected 401s (auth misconfiguration)
- 500s (server errors)
- Request storms (infinite retry loops)

A healthy app shows clean request logs with no repeated failed auth attempts.

## 5. Check Browser State

Use Playwright MCP tools:
- `browser_network_requests` — check for failed requests
- `browser_console_messages` — check for JavaScript errors

## 6. Test Full CRUD

Don't just load pages — create, read, update, and delete real data to verify the full flow works.

## 7. Clean Up

```bash
# Stop servers and close browser
kill $(lsof -ti:8000) 2>/dev/null
kill $(lsof -ti:5173) 2>/dev/null
```

Use `browser_close` to close the Playwright browser.
