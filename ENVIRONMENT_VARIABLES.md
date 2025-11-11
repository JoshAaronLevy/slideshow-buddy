# Environment Variables Reference

## Required Environment Variables

### Mobile App (.env)

```bash
# Spotify Client ID (get from https://developer.spotify.com/dashboard)
VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id

# Backend Server URL
VITE_BACKEND_URL=https://slideshow-buddy-server.onrender.com  # Production
# VITE_BACKEND_URL=http://localhost:8080  # Development
```

### Backend Server (.env)

```bash
# Spotify OAuth Credentials
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret

# OAuth Redirect URI
SPOTIFY_REDIRECT_URI=com.slideshowbuddy.app://callback

# Server Configuration
PORT=8080
NODE_ENV=production

# CORS (optional - defaults to allow all in dev)
CORS_ORIGIN=*
```

---

## Setup Instructions

### 1. Mobile App Setup

Create `.env` file in the root of your mobile app repo:

```bash
cd /path/to/slideshow-buddy
cp .env.example .env
# Edit .env with your actual values
```

### 2. Backend Setup

Your backend server should already have these variables configured in your Render dashboard or deployment platform.

### 3. Spotify Developer Dashboard

1. Go to https://developer.spotify.com/dashboard
2. Select your app
3. Click "Edit Settings"
4. Under "Redirect URIs", add:
   ```
   com.slideshowbuddy.app://callback
   ```
5. Click "Save"

---

## Validation Checklist

- [ ] `VITE_SPOTIFY_CLIENT_ID` matches the Client ID in Spotify Developer Dashboard
- [ ] `VITE_BACKEND_URL` points to your deployed backend (or localhost for dev)
- [ ] Backend has `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and `SPOTIFY_REDIRECT_URI` set
- [ ] `SPOTIFY_REDIRECT_URI` on backend matches: `com.slideshowbuddy.app://callback`
- [ ] Redirect URI is added to Spotify Developer Dashboard
- [ ] Backend server is running and accessible at the `VITE_BACKEND_URL`

---

## Testing Connectivity

### Test Backend Health

```bash
# Should return {"ok":true}
curl https://slideshow-buddy-server.onrender.com/healthz
```

### Test Token Exchange Endpoint

```bash
# Should return 400 with validation error (expected without valid code)
curl -X POST https://slideshow-buddy-server.onrender.com/auth/spotify/token \
  -H "Content-Type: application/json" \
  -d '{"code":"test","code_verifier":"test"}'
```

If you get a response (even an error), the endpoint is reachable!

---

## Common Issues

### "VITE_BACKEND_URL is not configured"
- Ensure `.env` file exists in mobile app root
- Verify `VITE_BACKEND_URL` is set in `.env`
- Rebuild the app: `npm run build && npx cap sync`

### "Network Error" when connecting
- Check backend is running: `curl your-backend-url/healthz`
- Verify URL doesn't have trailing slash
- Check CORS is configured on backend

### "invalid_request" from backend
- Check backend logs for details
- Verify request is sending JSON, not form data
- Ensure `code_verifier` is 43-128 characters

---

## Migration Note

If you previously used `VITE_API_BASE_URL`, you can safely remove it. Everything now uses `VITE_BACKEND_URL` consistently.
