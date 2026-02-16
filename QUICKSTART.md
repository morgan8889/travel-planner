# Quick Start Checklist

Follow these steps to get the Travel Planner app running locally.

## ☑️ Pre-flight Checklist

- [ ] I have a Supabase account and project created
- [ ] I have Python 3.10+ installed
- [ ] I have Node.js 18+ installed
- [ ] I have PostgreSQL running (or using Supabase)

## 📋 Setup Steps

### 1. Get Supabase Credentials (5 min)

- [ ] Go to https://supabase.com/dashboard
- [ ] Select your project
- [ ] Navigate to **Settings** → **API**
- [ ] Copy **Project URL** (looks like `https://xxx.supabase.co`)
- [ ] Copy **anon public** key (starts with `eyJ...`)

### 2. Configure Backend (2 min)

```bash
cd backend
cp .env.example .env
```

- [ ] Edit `backend/.env`:
  - Set `SUPABASE_URL=https://[your-project].supabase.co`
  - Set `SUPABASE_KEY=[your-anon-key]`
  - Set `DATABASE_URL=postgresql+asyncpg://user:pass@host/db`
  - ⚠️ **Important**: Use `postgresql+asyncpg://` NOT `postgresql://`

### 3. Configure Frontend (1 min)

```bash
cd frontend
cp .env.example .env.local
```

- [ ] Edit `frontend/.env.local`:
  - Set `VITE_SUPABASE_URL=https://[your-project].supabase.co`
  - Set `VITE_SUPABASE_ANON_KEY=[your-anon-key]`

### 4. Start Backend (2 min)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e .
uvicorn travel_planner.main:app --reload
```

- [ ] Backend running on http://127.0.0.1:8000
- [ ] No errors in terminal
- [ ] Visit http://127.0.0.1:8000/docs to see API docs

### 5. Start Frontend (2 min)

Open a **new terminal**:

```bash
cd frontend
npm install
npm run dev
```

- [ ] Frontend running on http://localhost:5173
- [ ] No errors in terminal
- [ ] Browser automatically opens or manually visit the URL

### 6. Test Authentication (3 min)

- [ ] Open http://localhost:5173 in browser
- [ ] Click **Sign In** or **Sign Up**
- [ ] Enter your email address
- [ ] Check your inbox for magic link email from Supabase
- [ ] Click the magic link
- [ ] You should be redirected back to the app, now logged in

### 7. Verify Token (Optional - 2 min)

- [ ] Open browser DevTools (F12)
- [ ] Go to **Network** tab
- [ ] Make an API request (create profile, etc.)
- [ ] Find request to `localhost:8000/auth/*`
- [ ] Check **Headers** → `Authorization: Bearer eyJ...`
- [ ] Copy the token (everything after "Bearer ")
- [ ] Go to https://jwt.io
- [ ] Paste the token
- [ ] Verify header shows `"alg": "RS256"` ✅

## ✅ Success Criteria

You're all set when:

- [ ] Backend server is running without errors
- [ ] Frontend is accessible in browser
- [ ] You can sign in with magic link
- [ ] You can see your profile or create one
- [ ] API requests show valid JWT tokens

## 🚨 Common Issues

| Problem | Solution |
|---------|----------|
| "Could not validate token" | Check `SUPABASE_URL` in backend `.env` |
| "ModuleNotFoundError" | Use `postgresql+asyncpg://` in `DATABASE_URL` |
| Frontend blank page | Check browser console for errors, verify `.env.local` exists |
| Can't connect to backend | Verify backend is running on port 8000 |
| Magic link doesn't work | Check Supabase email settings and spam folder |

## 📚 Need More Help?

- **Detailed guide**: See [MANUAL_TESTING.md](./MANUAL_TESTING.md)
- **API docs**: http://localhost:8000/docs (when backend is running)
- **Project overview**: See [README.md](./README.md)

---

**Total setup time**: ~15-20 minutes

**No JWT secret needed!** The new RS256 implementation fetches public keys automatically. 🎉
