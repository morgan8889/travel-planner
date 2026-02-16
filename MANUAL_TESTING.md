# Manual Testing Setup for Phase 2 Auth (RS256)

## Context

The RS256 JWT upgrade is complete and all automated tests pass. Now we need to set up the environment for **manual end-to-end testing** with a real Supabase instance to verify the authentication flow works with production-like tokens.

## Required Environment Variables

### Backend (`backend/.env`)

```bash
# Database - IMPORTANT: Must use postgresql+asyncpg:// for async support!
DATABASE_URL=postgresql+asyncpg://postgres:[password]@[host]:[port]/[database]

# Supabase Configuration
SUPABASE_URL=https://[your-project-ref].supabase.co
SUPABASE_KEY=[your-anon-public-key]

# IMPORTANT: SUPABASE_JWT_SECRET is NO LONGER NEEDED!
# The new RS256 implementation fetches public keys from JWKS automatically

# Optional: API keys for other services
ANTHROPIC_API_KEY=[your-key]
GOOGLE_CLIENT_ID=[your-client-id]
GOOGLE_CLIENT_SECRET=[your-client-secret]
```

### Frontend (`frontend/.env` or `.env.local`)

```bash
VITE_SUPABASE_URL=https://[your-project-ref].supabase.co
VITE_SUPABASE_ANON_KEY=[your-anon-public-key]
```

## Where to Find Supabase Credentials

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **API**
4. Find:
   - **Project URL**: Copy to `SUPABASE_URL`
   - **anon/public key**: Copy to `SUPABASE_KEY` and `VITE_SUPABASE_ANON_KEY`

**Note:** You do NOT need the JWT secret anymore!

## Manual Testing Steps

### 1. Setup Environment Files

Create/update the `.env` files in both `backend/` and `frontend/` directories with the credentials above.

```bash
# Backend
cp backend/.env.example backend/.env
# Then edit backend/.env with your actual credentials

# Frontend
cp frontend/.env.example frontend/.env.local
# Then edit frontend/.env.local with your actual credentials
```

### 2. Start Backend Server

```bash
cd backend
source .venv/bin/activate
uvicorn travel_planner.main:app --reload
```

Expected output:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

### 3. Start Frontend Development Server

```bash
cd frontend
npm run dev
```

Expected output:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
```

### 4. Test Authentication Flow

1. **Open browser**: Navigate to http://localhost:5173
2. **Login**: Click login/signup
3. **Magic link**: Enter your email, check inbox for magic link
4. **Verify login**: After clicking link, should be redirected back logged in

### 5. Verify RS256 Token in Browser

1. **Open DevTools**: Press F12
2. **Network tab**: Filter for XHR/Fetch requests
3. **Find API request**: Look for requests to `localhost:8000/auth/*`
4. **Check headers**: Find `Authorization: Bearer eyJ...`
5. **Copy token**: Copy the JWT (everything after "Bearer ")

### 6. Decode Token at jwt.io

1. **Go to**: https://jwt.io
2. **Paste token**: In the "Encoded" section
3. **Verify**:
   - Header shows: `"alg": "RS256"` (not HS256!)
   - Payload shows: `"iss": "https://[your-project].supabase.co/auth/v1"`
   - Payload has: `"sub"` (user ID), `"email"`, `"aud": "authenticated"`

### 7. Test API Endpoints Manually

```bash
# Replace YOUR_JWT with the token from step 5
export JWT="eyJ..."

# Test getting user profile
curl -H "Authorization: Bearer $JWT" http://localhost:8000/auth/me

# Expected: Profile data or 404 if not created yet

# Test creating profile
curl -X POST http://localhost:8000/auth/profile \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"display_name":"Test User","preferences":{"theme":"dark"}}'

# Expected: 200 with profile data
```

### 8. Verify JWKS Caching

**First request after backend startup:**
- Check terminal logs for JWKS fetch
- Response time: ~300ms (includes JWKS download)

**Subsequent requests (within 1 hour):**
- No JWKS fetch logs
- Response time: ~1ms (cache hit)

**After 1 hour:**
- JWKS auto-refreshes on next request
- Transparent to user

## Troubleshooting

### Issue: "Could not validate token" (401)

**Cause:** JWKS endpoint unreachable or SUPABASE_URL incorrect

**Fix:**
1. Verify `SUPABASE_URL` in `.env` is correct (no trailing slash)
2. Check network connectivity
3. Verify Supabase project is active

### Issue: "Invalid or expired token" (401)

**Cause:** Token expired or signature invalid

**Fix:**
1. Get a fresh token (logout and login again)
2. Verify token algorithm is RS256 at jwt.io
3. Check issuer claim matches SUPABASE_URL

### Issue: "ModuleNotFoundError: No module named 'psycopg2'"

**Cause:** DATABASE_URL is using `postgresql://` instead of `postgresql+asyncpg://`

**Fix:**
1. Open `backend/.env`
2. Change `DATABASE_URL=postgresql://...` to `DATABASE_URL=postgresql+asyncpg://...`
3. The `+asyncpg` suffix is REQUIRED for async database operations
4. Restart the backend server

### Issue: Backend won't start (other reasons)

**Cause:** Missing environment variables

**Fix:**
1. Ensure `backend/.env` exists
2. At minimum, set `SUPABASE_URL` (can use empty string for DATABASE_URL in dev)
3. Check for typos in variable names

### Issue: "does not provide an export named 'Session'"

**Error:** `The requested module does not provide an export named 'Session' (at AuthContext.tsx:2:10)`

**Cause:** Supabase JS v2.x changed how types are exported

**Fix:** Change line 2 in `frontend/src/contexts/AuthContext.tsx` from:
```typescript
import { Session, User } from '@supabase/supabase-js'
```

To (type-only import):
```typescript
import type { Session, User } from '@supabase/supabase-js'
```

Or alternatively, import from the auth helpers:
```typescript
import type { User } from '@supabase/supabase-js'
import type { Session } from '@supabase/auth-js'
```

**Then restart the dev server:**
```bash
cd frontend
npm run dev
```

### Issue: Frontend shows blank/white page (other causes)

**Cause:** JavaScript error preventing React from rendering

**Fix:**
1. Open browser DevTools (F12) → Console tab
2. Look for red error messages
3. Common issues:
   - Missing `.env.local` file in frontend directory
   - Missing `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY`
   - Import errors from missing dependencies
   - Syntax errors in React components

**Steps to diagnose:**
```bash
# Check if .env.local exists in frontend directory
ls frontend/.env.local

# If missing, create it with:
cat > frontend/.env.local <<EOF
VITE_SUPABASE_URL=https://[your-project].supabase.co
VITE_SUPABASE_ANON_KEY=[your-anon-key]
EOF

# Restart frontend dev server
cd frontend
npm run dev
```

### Issue: Frontend can't connect to backend

**Cause:** CORS or backend not running

**Fix:**
1. Verify backend is running on port 8000
2. Check `cors_origins` in config includes `http://localhost:5173`
3. Check browser console for CORS errors

## Key Differences from HS256

| Aspect | Old (HS256) | New (RS256) |
|--------|-------------|-------------|
| **Env var needed** | `SUPABASE_JWT_SECRET` required | NOT needed! |
| **Token validation** | Verified with shared secret | Verified with public key from JWKS |
| **Setup complexity** | Need to copy JWT secret | Just need project URL |
| **Security** | Secret in backend config | Public key fetched on-demand |
| **Key rotation** | Manual config update | Automatic (JWKS) |

## Success Checklist

- [ ] Backend `.env` has `SUPABASE_URL` and `SUPABASE_KEY`
- [ ] Frontend `.env` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- [ ] Backend starts without errors
- [ ] Frontend starts and loads
- [ ] Can login via magic link
- [ ] Token in browser shows RS256 algorithm
- [ ] API requests with token return 200
- [ ] Profile creation/retrieval works
- [ ] Token issuer claim matches Supabase URL

## Quick Start (Minimal Setup)

If you just want to test quickly:

```bash
# Backend .env (minimal)
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_KEY=your-anon-key
DATABASE_URL=postgresql+asyncpg://user:pass@localhost/db

# Frontend .env.local (minimal)
VITE_SUPABASE_URL=https://yourproject.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Start backend
cd backend && source .venv/bin/activate && uvicorn travel_planner.main:app --reload

# Start frontend (new terminal)
cd frontend && npm run dev

# Open browser
open http://localhost:5173
```

That's it! No JWT secret needed anymore.
