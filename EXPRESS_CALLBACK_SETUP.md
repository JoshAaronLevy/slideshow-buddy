# Backend Server Integration Guide

## Architecture Overview

Your Express server acts as a **token exchange proxy** using PKCE (Proof Key for Code Exchange). The authentication flow is:

1. **Mobile app** → Opens Spotify authorization URL
2. **Spotify** → Redirects directly to mobile app: `com.slideshowbuddy.app://callback?code=...&state=...`
3. **Mobile app** → Extracts code and sends to Express server with code_verifier
4. **Express server** → Exchanges code for tokens with Spotify (keeping client_secret secure)
5. **Express server** → Returns tokens to mobile app
6. **Mobile app** → Stores tokens and fetches user profile

This keeps your Spotify client credentials secure on the server side.

---

## Backend Repository Copilot Prompt

**Copy and paste this entire prompt into GitHub Copilot in your backend Express repo:**

---

### PROMPT START

I need to add comprehensive logging to my Spotify OAuth token exchange endpoints to help debug authentication issues in the mobile app. The server currently has two endpoints:

1. `POST /auth/spotify/token` - Exchanges authorization code for tokens (PKCE)
2. `POST /auth/spotify/refresh` - Refreshes access token

**Requirements:**

1. **Add detailed console logging** throughout both endpoints:
   - Log when requests are received with sanitized parameters (don't log full tokens/codes)
   - Log validation results
   - Log Spotify API calls (before making them)
   - Log successful responses (with token presence, not values)
   - Log errors with full details

2. **Logging format**: Use prefix `[SpotifyAuth]` for consistency with mobile app logs

3. **Security**: Never log full tokens, codes, or sensitive data - only first/last few characters or boolean presence

4. **Example logging structure**:
   ```typescript
   console.log('[SpotifyAuth] Token exchange request received', {
     hasCode: !!code,
     codeLength: code?.length,
     hasCodeVerifier: !!code_verifier,
     verifierLength: code_verifier?.length
   });
   ```

5. **Add CORS preflight logging** to help debug mobile app requests

6. **Add a startup log** showing the configured redirect URI

Please update `src/server.ts` with these logging improvements while maintaining the existing functionality and security measures.

### PROMPT END

---

## What the Backend Changes Will Provide

After implementing the above prompt in your backend repo, you'll get:

- ✅ Visibility into token exchange requests from the mobile app
- ✅ Validation error details
- ✅ Spotify API response tracking
- ✅ Easier debugging of CORS issues
- ✅ Confirmation that requests are reaching the server

---

## Required Backend Environment Variables

Ensure these are set in your backend deployment (Render, Heroku, etc.):

```bash
# Required
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=com.slideshowbuddy.app://callback

# Optional
PORT=8080
NODE_ENV=production
CORS_ORIGIN=*  # Or specific origins if needed

**Note**: Your backend server doesn't need a callback endpoint because Spotify redirects directly to the mobile app via deep linking!

---

## Spotify Developer Dashboard Configuration

### Required Redirect URI

In your Spotify Developer Dashboard:

1. Go to: https://developer.spotify.com/dashboard
2. Select your app
3. Click "Edit Settings"
4. Under "Redirect URIs", add:
   ```
   com.slideshowbuddy.app://callback
   ```
5. Click "Add"
6. Click "Save" at the bottom

**Important**: You're using PKCE flow with direct mobile app callback, so you add the mobile app's URL scheme directly to Spotify, not your Express server URL!

### 3. Frontend Environment Variables

Add to your mobile app's `.env` file:

```bash
# Spotify OAuth
VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id

# Backend server URL
VITE_BACKEND_URL=http://localhost:8080  # Development
# VITE_BACKEND_URL=https://your-render-app.onrender.com  # Production
```

**For production**, update `VITE_BACKEND_URL` to your deployed backend URL.

### 4. HTTPS Requirement (Production)

- Your Express backend **must** use HTTPS in production
- Most platforms (Render, Heroku, Railway) provide SSL automatically
- Your current backend appears to be on Render, which handles SSL

### 5. CORS Configuration

Your backend's CORS settings must allow requests from the mobile app. The current config looks good:

```typescript
const corsOptions = CORS_ORIGIN
  ? {
      origin: CORS_ORIGIN.split(',').map(o => o.trim()),
      credentials: true
    }
  : { origin: true }; // Allow all origins in dev
```

For development, you can leave `CORS_ORIGIN` unset to allow all origins.

---

## Testing the Complete Flow

### Step-by-Step Test:

1. **Start your Express backend server**:
   ```bash
   cd path/to/backend-repo
   npm run dev  # or npm start
   ```

2. **In the mobile app repo, add environment variable**:
   ```bash
   # Create .env file if it doesn't exist
   echo "VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id" > .env
   echo "VITE_BACKEND_URL=http://localhost:8080" >> .env
   ```

3. **Build and run the mobile app**:
   ```bash
   npm run build
   npx cap sync
   npx cap open ios  # or android
   ```

4. **Tap "Connect with Spotify"** in the app

5. **Check console logs in BOTH places**:
   
   **Backend server logs:**
   ```
   [SpotifyAuth] Token exchange request received
   [SpotifyAuth] Calling Spotify API...
   [SpotifyAuth] Token exchange successful
   ```
   
   **Mobile app logs (Xcode/Android Studio):**
   ```
   [Tab2] Component mounted, checking auth status
   [SpotifyAuth] Checking authentication status...
   [SpotifyAuth] No access token found
   
   // After tapping "Connect with Spotify"
   [SpotifyAuth] App URL opened: com.slideshowbuddy.app://callback?code=...&state=...
   [Tab2] OAuth callback received, handling authentication...
   [AuthStore] handleCallback invoked
   [SpotifyAuth] handleCallback called
   [SpotifyAuth] Exchanging code for tokens via backend server...
   [SpotifyAuth] Backend token URL: http://localhost:8080/auth/spotify/token
   [SpotifyAuth] Tokens received successfully
   [SpotifyAuth] Fetching user profile...
   [SpotifyAuth] User profile fetched
   [AuthStore] Auth state updated - user is now authenticated
   [Tab2] Auth status refreshed successfully
   ```

### Expected Authentication Flow:

```
┌─────────────┐
│ Mobile App  │
└──────┬──────┘
       │ 1. Opens Spotify auth URL
       │    (with PKCE challenge)
       ▼
┌─────────────┐
│   Spotify   │
└──────┬──────┘
       │ 2. User logs in & authorizes
       │ 3. Redirects to: com.slideshowbuddy.app://callback?code=XXX&state=YYY
       ▼
┌─────────────┐
│ Mobile App  │ ◄─── Deep link opens app
└──────┬──────┘
       │ 4. Extracts code & code_verifier
       │ 5. POST to backend: /auth/spotify/token
       │    { code, code_verifier }
       ▼
┌─────────────┐
│   Backend   │
└──────┬──────┘
       │ 6. POST to Spotify with client_secret
       │    (exchanges code for tokens)
       ▼
┌─────────────┐
│   Spotify   │
└──────┬──────┘
       │ 7. Returns access_token & refresh_token
       ▼
┌─────────────┐
│   Backend   │
└──────┬──────┘
       │ 8. Returns tokens to app
       ▼
┌─────────────┐
│ Mobile App  │
└──────┬──────┘
       │ 9. Stores tokens securely
       │ 10. Fetches user profile
       │ 11. Updates UI → Shows authenticated state ✅
       ▼
    SUCCESS!
```

---

## Troubleshooting

### Issue: "Network Error" when exchanging code for token
**Possible causes:**
1. Backend server not running
2. Wrong `VITE_BACKEND_URL` in mobile app .env
3. CORS issue

**Solution**:
```bash
# Check backend is running
curl http://localhost:8080/healthz

# Should return: {"ok":true}

# Check CORS
curl -H "Origin: capacitor://localhost" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     http://localhost:8080/auth/spotify/token
```

### Issue: App doesn't open after Spotify auth
**Solution**: 
- Verify URL scheme in Spotify Developer Dashboard: `com.slideshowbuddy.app://callback`
- Check iOS Info.plist or Android AndroidManifest.xml for URL scheme config
- Run `npx cap sync` after any config changes

### Issue: "State mismatch" error
**Solution**:
- Clear app data and try again
- Check that `code_verifier` and `state` are being stored before auth flow
- Verify storage isn't being cleared mid-flow

### Issue: Backend returns 400 "invalid_request"
**Solution**:
- Check backend logs for validation errors
- Verify `code_verifier` length (must be 43-128 characters)
- Confirm you're sending JSON, not form-encoded data

### Issue: Backend returns "spotify_token_exchange_failed"
**Possible causes:**
1. Invalid/expired authorization code
2. Wrong redirect_uri in backend env
3. Code used more than once
4. Client ID mismatch

**Solution**:
- Check backend logs for Spotify API error details
- Verify `SPOTIFY_REDIRECT_URI=com.slideshowbuddy.app://callback` in backend .env
- Ensure authorization code is used within 10 minutes
- Try the full flow again (codes can only be used once)

### Issue: App shows "Connect to Spotify" after successful auth
**Solution**:
- Check mobile app logs for `[AuthStore] Auth state updated - user is now authenticated`
- Verify tokens are being stored: Xcode → Debug → View → Storage
- Ensure `checkAuthStatus()` is called after `handleCallback()` completes

---

## iOS Configuration

Capacitor should automatically configure URL schemes, but verify `ios/App/App/Info.plist` includes:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>com.slideshowbuddy.app</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.slideshowbuddy.app</string>
    </array>
  </dict>
</array>
```

If you need to add it manually, run:
```bash
npx cap sync ios
```

---

## Android Configuration

Verify `android/app/src/main/AndroidManifest.xml` includes:

```xml
<activity android:name=".MainActivity">
  <!-- Existing intent filters... -->
  
  <!-- Add this for Spotify OAuth deep linking -->
  <intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="com.slideshowbuddy.app" />
  </intent-filter>
</activity>
```

After making changes:
```bash
npx cap sync android
```

---

## Quick Reference Checklist

### Backend Setup
- [ ] Added logging to token endpoints (use Copilot prompt above)
- [ ] Set environment variables:
  - `SPOTIFY_CLIENT_ID`
  - `SPOTIFY_CLIENT_SECRET`
  - `SPOTIFY_REDIRECT_URI=com.slideshowbuddy.app://callback`
- [ ] Backend server running and accessible
- [ ] CORS configured (allow all origins for dev)

### Spotify Dashboard
- [ ] Added redirect URI: `com.slideshowbuddy.app://callback`
- [ ] Saved changes

### Mobile App Setup
- [ ] Created `.env` file with:
  - `VITE_SPOTIFY_CLIENT_ID`
  - `VITE_BACKEND_URL`
- [ ] Built and synced: `npm run build && npx cap sync`
- [ ] Verified URL scheme in iOS/Android config

### Testing
- [ ] Backend health check works: `curl http://localhost:8080/healthz`
- [ ] Mobile app connects to Spotify
- [ ] Callback redirects to app
- [ ] Tokens exchanged via backend
- [ ] User profile loaded
- [ ] UI shows authenticated state

---

## Summary

The authentication flow now works as follows:

1. **Mobile app** opens Spotify auth with PKCE challenge
2. **Spotify** redirects directly to mobile app with authorization code
3. **Mobile app** sends code + code_verifier to **your backend**
4. **Backend** exchanges code for tokens (keeping client_secret secure)
5. **Backend** returns tokens to mobile app
6. **Mobile app** stores tokens and displays authenticated UI ✅

With Phase 1 implemented, comprehensive logging throughout the stack will help identify any issues immediately!
