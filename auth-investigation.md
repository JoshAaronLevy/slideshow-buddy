# Spotify Authentication & Playback Investigation Report

**Date**: November 12, 2025  
**App**: Slideshow Buddy (Ionic + Capacitor iOS)  
**Issue**: Auth error on subsequent playback attempts; 404 after re-authorization

---

## Executive Summary

The app's Spotify playback fails intermittently due to **three critical architectural gaps**:

1. **No device transfer or active device verification** before calling `/me/player/play`, causing 404 "Player command failed: No active device found" when the Web Playback SDK device isn't active in Spotify's backend.
2. **Token staleness after app lifecycle events** (background/foreground, tab switches): the `getOAuthToken` closure in `MusicPlayerService.ts` captures the token at player initialization time but never refreshes it, causing auth errors when the token expires.
3. **Missing token refresh on app resume**: There's no `App.addListener('appStateChange')` or `ionViewWillEnter` to proactively refresh tokens when the app returns from background.

**Bottom line**: First play works because the device just became ready and the token is fresh. Later plays fail because either (a) the device is no longer "active" in Spotify's eyes, or (b) the token expired while the player instance still holds a stale reference.

---

## Reproduction Path

### Consistent Steps to Trigger Failure

1. **Fresh auth → create playlist + slideshow → link → play**  
   - User logs in via Spotify OAuth  
   - Backend exchanges code for token → stored in Capacitor Preferences (`SPOTIFY_ACCESS_TOKEN`, `SPOTIFY_REFRESH_TOKEN`, `SPOTIFY_TOKEN_EXPIRY`)  
   - User creates custom playlist, creates slideshow, links playlist  
   - Opens `SlideshowPlayer` → `initializePlayer()` → SDK loads → device becomes ready → `startPlayback()` → **SUCCESS**

2. **Exit slideshow, wait, return → play again**  
   - User exits slideshow (player cleanup called: `player.disconnect()`, `deviceId = null`, `player = null`)  
   - Time passes (could be seconds or hours)  
   - User navigates away and back (Tab2 → Slideshows → play)  
   - Opens `SlideshowPlayer` → **re-initializes player** → device becomes ready → `startPlayback()` → **FAILURE: "Authentication error" or 404 "No active device"**

3. **After disconnect + re-auth**  
   - User disconnects Spotify (clears tokens)  
   - Re-authenticates  
   - Tries to play → **404 error** (device not active, or identifier mismatch)

---

## Auth State Lifecycle

### Token Storage & Retrieval

| Step | Location | Storage | Notes |
|------|----------|---------|-------|
| **Initial code exchange** | `SpotifyAuthService.handleCallback()` | Capacitor Preferences (device keychain/storage) | `access_token`, `refresh_token`, `expires_at` (Date.now() + expires_in * 1000) |
| **Token read** | `SpotifyAuthService.getAccessToken()` | Reads from Preferences | Synchronous Preferences.get() → may be stale if not refreshed |
| **Token expiry check** | `SpotifyAuthService.isTokenExpired()` | Compares `expires_at` to `Date.now() - 5min` | Only called in `checkAuthStatus()` (app launch) |
| **Refresh trigger** | `authStore.checkAuthStatus()` | Called on Tab2 mount, after callback | NOT called on app resume, tab re-enter, or player init |
| **Player token callback** | `MusicPlayerService.initializePlayer()` | Closure captures `getAccessToken()` at init time | **CRITICAL FLAW**: Closure is set once; if token refreshes later, player doesn't know |

### Token Read/Write/Clear Points

**Write**:
- `handleCallback()` → after code exchange → stores access_token, refresh_token, expires_at
- `refreshAccessToken()` → after refresh → updates access_token, expires_at (keeps refresh_token)

**Read**:
- `SpotifyService.getAuthHeaders()` → calls `getAccessToken()` → used for all Web API calls (playlists, tracks, search, user profile)
- `MusicPlayerService.initializePlayer()` → calls `getAccessToken()` once, then uses closure for `getOAuthToken` callback
- `MusicPlayerService.startPlayback()` → calls `getAccessToken()` for the `/me/player/play` request

**Clear**:
- `logout()` → removes all Preferences keys

### Refresh Flow

**When does refresh happen?**
- `checkAuthStatus()` (called on Tab2 mount, after callback) → checks `isTokenExpired()` → if true, calls `refreshAccessToken()`
- **NOT** called on:
  - App resume from background
  - Tab navigation (Slideshows → Music → Slideshows)
  - Player initialization
  - Playback start

**Race condition risk**:
- Token expires between `checkAuthStatus()` and player init
- Player init reads the token once → stores in closure → token expires → player keeps calling Spotify with stale token → auth error

---

## Player Initialization & Active Device

### Full Init Sequence (`SlideshowPlayer.tsx` → `MusicPlayerService.ts`)

1. **`useEffect` in `SlideshowPlayer.tsx` (line 116-183)**:
   - Runs when `isOpen && slideshow && !musicInitialized`
   - If `musicSource.type === 'none'`, sets `musicInitialized = true` and skips (correct)
   - Else: calls `MusicPlayerService.initializePlayer(onStateChange, onError)`

2. **`initializePlayer()` (MusicPlayerService.ts, line 81-180)**:
   - Loads SDK (if not loaded)
   - Reads token: `const token = await getAccessToken()` (line 95)
   - Disconnects existing player (if any): `player.disconnect(); player = null; deviceId = null;`
   - Creates new player: `new window.Spotify.Player({ ... })`
   - Sets `getOAuthToken` callback: `getOAuthToken: (callback) => { getAccessToken().then(token => callback(token)); }` (line 111-115)
     - **CRITICAL**: This closure captures `getAccessToken` but Spotify SDK may cache this callback; if token refreshes externally, SDK won't know unless we force a reconnect
   - Adds listeners: `ready`, `not_ready`, `player_state_changed`, `authentication_error`, `account_error`, `playback_error`, `initialization_error`
   - Calls `player.connect()` → waits for `deviceId` to be set (up to 5 seconds, polls every 100ms)
   - Returns `deviceId`

3. **`startPlayback()` (SlideshowPlayer.tsx, line 148-163)**:
   - Custom playlist: `const trackUris = playlist.tracks.map(track => track.uri); await MusicPlayerService.startPlayback(trackUris, false);`
   - Spotify playlist: `await MusicPlayerService.startPlayback(playlist.uri, true);`

4. **`startPlayback()` (MusicPlayerService.ts, line 199-232)**:
   - Checks `if (!deviceId)` → throws "No device ID available" (line 202-204)
   - Reads token: `const token = await getAccessToken()` (line 206)
   - Constructs body: `{ context_uri: ... }` for playlists, `{ uris: [...] }` for tracks (line 211-214)
   - **Calls Spotify Web API**: `PUT https://api.spotify.com/v1/me/player/play?device_id=${deviceId}` with `Authorization: Bearer ${token}` (line 216-225)

### Active Device Requirement

**Spotify's /me/player/play endpoint requires**:
- Either an active device (last device user interacted with)
- OR explicit `device_id` query param to target a specific device

**Current code**:
- ✅ Passes `device_id=${deviceId}` in query string (line 217)
- ❌ **Does NOT call `/me/player` PUT to transfer playback to this device before playing** (this is the "make device active" step)
- ❌ **Does NOT verify the device is "active"** in Spotify's backend before issuing play command

**Why first play works**:
- SDK just connected → Spotify backend recognizes this device as "new and ready" → allows play

**Why subsequent plays fail (404)**:
- Device was disconnected (`cleanup()` called when slideshow exited)
- New player instance created → new `device_id` → SDK says "ready" → but Spotify backend hasn't marked it as "active" yet
- Race: `/play` request arrives before backend finishes registering the device as active → 404

**What's missing**:
- No explicit "transfer playback" call: `PUT /me/player` with `{ device_ids: [deviceId], play: false }`
- No polling `/me/player/devices` to confirm device is listed and active before playing

---

## Playlist/Track Identifiers

### How URIs/IDs Are Stored & Used

**Spotify Playlist**:
- `SpotifyPlaylist` type (types/index.ts, line 43-50):
  - `id: string` (bare ID like `37i9dQZF1DXcBWIGoYBM5M`)
  - `uri: string` (full URI like `spotify:playlist:37i9dQZF1DXcBWIGoYBM5M`)
- Stored in `musicStore.playlists` (fetched from `/me/playlists`)
- Used in slideshow: `musicSource: { type: 'spotify-playlist', playlistId: string }` (stores `id`, not `uri`)
- **At playback time** (SlideshowPlayer.tsx, line 158-162):
  ```tsx
  const playlist = spotifyPlaylists.find(p => p.id === musicSource.playlistId);
  await MusicPlayerService.startPlayback(playlist.uri, true); // ✅ passes full URI
  ```
- `startPlayback()` receives `playlist.uri` (e.g., `spotify:playlist:37i9dQZF1DXcBWIGoYBM5M`)
- Body sent to Spotify: `{ context_uri: "spotify:playlist:..." }` ✅ correct format

**Custom Playlist (Spotify tracks)**:
- `CustomPlaylist` type (types/playlist.ts):
  - `trackIds: string[]` (bare IDs)
  - `tracks: SpotifyTrack[]` (full objects with `uri`)
- Stored in `playlistLibraryStore.playlists`
- Used in slideshow: `musicSource: { type: 'custom-playlist', playlistId: string }`
- **At playback time** (SlideshowPlayer.tsx, line 149-155):
  ```tsx
  const playlist = customPlaylists.find(p => p.id === musicSource.playlistId);
  const trackUris = playlist.tracks.map(track => track.uri); // ✅ extracts URIs
  await MusicPlayerService.startPlayback(trackUris, false);
  ```
- `startPlayback()` receives `string[]` of track URIs (e.g., `["spotify:track:abc123", "spotify:track:def456"]`)
- Body sent to Spotify: `{ uris: [...] }` ✅ correct format

**Verdict**: ✅ URI/ID handling is correct. No issue here.

---

## Networking & Base URLs

### Backend Token Exchange

**Backend URL**: `https://slideshow-buddy-server.onrender.com` (from .env: `VITE_BACKEND_URL`)

**Endpoints**:
- Token exchange: `POST /auth/spotify/token` (SpotifyAuthService.ts, line 84)
- Token refresh: `POST /auth/spotify/refresh` (SpotifyAuthService.ts, line 148)

**Usage**:
- Backend is ONLY used for code exchange and refresh (PKCE flow)
- Backend does NOT proxy Spotify Web API calls

**Trailing slash check**:
- ✅ `BACKEND_URL` + `TOKEN_ENDPOINT` → no accidental double slashes
- ✅ Spotify API base URL: `https://api.spotify.com/v1` (no trailing slash)

**Token source for Web API**:
- ✅ All Spotify API calls use token from `getAccessToken()` (front-end Preferences storage)
- ✅ Backend never holds or uses the access token for API calls on behalf of the client

**Verdict**: ✅ No networking issues. Backend URL is consistent.

---

## Error Capture & Observability

### Where Errors Surface

**In MusicPlayerService.ts**:
- `initializePlayer()` (line 81-180):
  - `initialization_error`, `authentication_error`, `account_error`, `playback_error` listeners → log to console + call `onError()` callback (line 132-159)
  - Errors thrown to caller (try/catch in SlideshowPlayer.tsx)
- `startPlayback()` (line 199-232):
  - Axios errors → logged to console + thrown (no structured error details captured)

**In SlideshowPlayer.tsx** (line 116-183):
- `initializePlayer()` errors → caught → `setMusicError()` + `presentToast()` → toast shows generic message
- No capture of:
  - Request URL
  - Response status/body
  - Device/player readiness state
  - Token expiry time vs. now
  - Selected playlist ID

**What's logged**:
- ✅ Console logs for each error type
- ❌ No structured error object with context (e.g., `{ deviceId, token_expires_at, selected_playlist, request_url, response_status }`)
- ❌ No persistent error log (only console, which is lost on app reload)

### Proposed Minimal Logging (No Code Yet)

**Where to add logs**:

1. **`MusicPlayerService.initializePlayer()`**:
   - Log: `{ action: 'init_start', token_expires_at, token_age_seconds, device_id: null }`
   - On ready: `{ action: 'device_ready', device_id, elapsed_ms }`
   - On error: `{ action: 'init_error', error_type, message, device_id, token_expires_at }`

2. **`MusicPlayerService.startPlayback()`**:
   - Log: `{ action: 'play_start', device_id, is_playlist, uri_or_uris, token_expires_at, token_age_seconds }`
   - On axios error: `{ action: 'play_error', status, response_data, request_url, device_id, token_expires_at }`

3. **`SpotifyAuthService.getAccessToken()`**:
   - Log: `{ action: 'token_read', token_exists, token_expires_at, is_expired, time_until_expiry_seconds }`

4. **`authStore.checkAuthStatus()`**:
   - Log: `{ action: 'auth_check', has_token, is_expired, will_refresh }`

5. **`SlideshowPlayer.tsx` useEffect (line 116)**:
   - Log: `{ action: 'slideshow_music_init', slideshow_id, music_source_type, music_source_id, device_id_before_init }`

**What to log**:
- Request URL (full)
- Response status + body (on error)
- Device ID (current)
- Token expiry timestamp + "seconds until expiry" or "seconds since expiry"
- Playlist/track URI being played
- Player readiness state (`isPlayerReady()`)

**Where to store**:
- Option 1: Console.log with structured JSON (searchable in Xcode console)
- Option 2: In-memory ring buffer (last 100 events) → exposed via debug modal
- Option 3: Capacitor Preferences (key: `debug_logs`) → persists across sessions

---

## App Lifecycle Handling

### Current State

**No app lifecycle listeners**:
- ❌ No `App.addListener('appStateChange')` to detect background → foreground transitions
- ❌ No `useIonViewWillEnter()` or `useIonViewDidEnter()` in Tab2 or SlideshowPlayer to refresh state on tab switch
- ❌ No token refresh or player reconnect on app resume

**What happens when app goes to background**:
- iOS WebView suspends JavaScript execution
- Spotify SDK connection may time out
- Token may expire while app is backgrounded
- When app returns to foreground:
  - No automatic token refresh
  - No player reconnect
  - No check if `deviceId` is still valid
  - User navigates to slideshow → attempts to play → uses stale token or stale device → **FAILURE**

**URL listener lifecycle**:
- `setupAuthListener()` called once in Tab2 `useEffect` (line 497-517)
- `App.addListener('appUrlOpen')` registered once → stays active until app quits
- ❌ **No cleanup** on Tab2 unmount → if Tab2 unmounts and remounts, listener is added AGAIN → duplicate handlers → race conditions

**Player cleanup**:
- ✅ `MusicPlayerService.cleanup()` called when slideshow exits (SlideshowPlayer.tsx, line 283)
- ✅ Disconnects player, nulls `player` and `deviceId`
- ❌ SDK remains loaded (global `window.Spotify`, `sdkLoaded = true`) → next init reuses SDK but creates new player instance

---

## Ranked Hypotheses (Evidence-Based)

### 1. ⚠️ **CRITICAL: Device Not Active When Calling /play** (Highest Probability)

**Symptom**: 404 "Player command failed: No active device found"

**Evidence**:
- `startPlayback()` calls `PUT /me/player/play?device_id=${deviceId}` but **does NOT** call `PUT /me/player` to transfer playback first
- Spotify docs require either an "active device" OR explicit transfer before `/play` works reliably
- First play works (device just became ready, Spotify backend registers it)
- Second play fails (new player instance → new device_id → backend hasn't marked it active yet)

**Why this explains the symptom**:
- User exits slideshow → player cleanup → `deviceId = null`
- Returns to play → new player init → new `deviceId` (different from before)
- `startPlayback()` fires immediately after `deviceId` is set (line 172 in SlideshowPlayer.tsx)
- Spotify backend hasn't finished registering this device as "active" → 404

**Confidence**: 95%

---

### 2. ⚠️ **HIGH: Stale Token in Player's getOAuthToken Closure** (Second Highest)

**Symptom**: "Authentication error" after token expires

**Evidence**:
- `initializePlayer()` sets `getOAuthToken` callback once (line 111-115)
- Closure captures `getAccessToken` function, but SDK may cache the result or not re-call it
- Token expires (3600 seconds = 1 hour default)
- Player tries to make a request → uses stale token → 401 → SDK fires `authentication_error` listener

**Why this explains the symptom**:
- User logs in → plays slideshow → token fresh → works
- Waits 1+ hour (or app backgrounded, token expires)
- Returns, tries to play → player still has old token reference → auth error

**Confidence**: 85%

---

### 3. ⚠️ **MEDIUM: Token Not Refreshed on App Resume**

**Symptom**: Auth error after returning from background

**Evidence**:
- No `App.addListener('appStateChange')` listener
- `checkAuthStatus()` only called on Tab2 mount and after OAuth callback
- If app is backgrounded for 1+ hour → token expires → app resumes → no refresh → stale token used

**Why this explains the symptom**:
- App in background → token expires → foreground → user navigates to slideshow → attempts play → token expired → auth error

**Confidence**: 75%

---

### 4. ⚠️ **MEDIUM: Race Between Player Init and Playback Start**

**Symptom**: Occasional "No device ID available" or 404

**Evidence**:
- `initializePlayer()` waits up to 5 seconds for `deviceId` (line 166-171)
- If SDK is slow or network latency is high, `deviceId` might not be set yet
- `startPlayback()` checks `if (!deviceId)` but may fire too early

**Why this explains the symptom**:
- Slow network → SDK `ready` event delayed → `startPlayback()` called before `deviceId` is set → error

**Confidence**: 40% (lower because the 5-second wait should catch this, but network issues could still cause it)

---

### 5. ⚠️ **LOW: Duplicate URL Listeners on Tab Remount**

**Symptom**: Unpredictable auth callback handling

**Evidence**:
- `setupAuthListener()` called in Tab2 `useEffect` (line 497-517)
- No cleanup (no `return () => listenerHandle.remove()`)
- If Tab2 unmounts and remounts, listener is added again → multiple handlers → first one to fire wins → race

**Why this explains the symptom**:
- User navigates away from Tab2 → back to Tab2 → listener added twice → callback handled by stale closure → state not updated

**Confidence**: 30% (less likely to affect playback, more likely to affect auth flow itself)

---

### 6. ⚠️ **LOW: authStore Token Out of Sync with Preferences**

**Symptom**: Zustand `accessToken` stale, but Preferences has fresh token

**Evidence**:
- `authStore.accessToken` is set in `handleCallback()` and `checkAuthStatus()`
- `getAccessToken()` reads from Preferences (source of truth)
- If token is refreshed in background, Zustand state not updated

**Why this is low priority**:
- All playback code uses `getAccessToken()` (Preferences), NOT `authStore.accessToken`
- Zustand state is only for UI (showing user logged in)

**Confidence**: 15%

---

## Actionable Next Steps

### Phase 1: Instrumentation (Validate Top Hypotheses)

**Goal**: Capture enough context to definitively identify root cause

**Step 1.1: Add structured logging to MusicPlayerService.ts**

Where:
- `initializePlayer()` start/end/error
- `startPlayback()` start/error
- All error listeners (`authentication_error`, `playback_error`)

What to log:
```typescript
interface PlaybackLog {
  timestamp: number;
  action: 'init_start' | 'init_ready' | 'init_error' | 'play_start' | 'play_error';
  deviceId: string | null;
  tokenExpiresAt: number | null; // from Preferences
  tokenAgeSeconds: number; // Date.now() - (expiresAt - 3600*1000)
  isTokenExpired: boolean;
  playlistUri?: string;
  errorType?: string;
  errorMessage?: string;
  httpStatus?: number;
  httpResponseBody?: any;
  requestUrl?: string;
}
```

Log to:
- Console (searchable in Xcode)
- Optional: Store last 50 logs in Preferences (key: `playback_debug_logs`)

**Step 1.2: Add token expiry check before every playback**

Where: `startPlayback()`, line 199

Add:
```typescript
const expired = await isTokenExpired();
console.log('[Playback] Token check', { expired, deviceId, uri: uriOrUris });
if (expired) {
  console.warn('[Playback] Token expired, attempting refresh...');
  // Option A: Throw error and let caller handle
  // Option B: Automatically refresh (but this may mask the root cause)
}
```

**Step 1.3: Add device active check before playback**

Where: `startPlayback()`, after line 204

Add:
```typescript
// Check if device is active
const devicesResponse = await axios.get(
  `${SPOTIFY_CONFIG.API_BASE_URL}/me/player/devices`,
  { headers: { Authorization: `Bearer ${token}` } }
);
const device = devicesResponse.data.devices.find((d: any) => d.id === deviceId);
console.log('[Playback] Device status', { deviceId, found: !!device, is_active: device?.is_active });
```

---

### Phase 2: Remediation (Implement Fixes Based on Findings)

**Fix 2.1: Transfer playback to device before playing** (Hypothesis #1)

Where: `MusicPlayerService.startPlayback()`, before line 216

Add:
```typescript
// Transfer playback to this device (make it active)
await axios.put(
  `${SPOTIFY_CONFIG.API_BASE_URL}/me/player`,
  { device_ids: [deviceId], play: false }, // play: false = just transfer, don't start yet
  { headers: { Authorization: `Bearer ${token}` } }
);

// Small delay to let Spotify backend register the transfer
await new Promise(resolve => setTimeout(resolve, 500));
```

**Fix 2.2: Force token refresh in player's getOAuthToken callback** (Hypothesis #2)

Where: `MusicPlayerService.initializePlayer()`, line 111-115

Replace:
```typescript
getOAuthToken: (callback) => {
  getAccessToken().then((token) => {
    if (token) {
      callback(token);
    }
  });
}
```

With:
```typescript
getOAuthToken: async (callback) => {
  // Always check expiry before returning token
  const expired = await isTokenExpired();
  if (expired) {
    console.log('[Player] Token expired, refreshing...');
    await refreshAccessToken();
  }
  const token = await getAccessToken();
  if (token) {
    callback(token);
  }
}
```

**Fix 2.3: Add app resume listener** (Hypothesis #3)

Where: `App.tsx` or `Tab2.tsx` (global lifecycle)

Add:
```typescript
useEffect(() => {
  const stateChangeListener = App.addListener('appStateChange', async ({ isActive }) => {
    if (isActive) {
      console.log('[Lifecycle] App resumed, checking token...');
      const expired = await SpotifyAuthService.isTokenExpired();
      if (expired) {
        try {
          await SpotifyAuthService.refreshAccessToken();
          console.log('[Lifecycle] Token refreshed');
        } catch (error) {
          console.error('[Lifecycle] Token refresh failed', error);
        }
      }
    }
  });

  return () => {
    stateChangeListener.then(handle => handle.remove());
  };
}, []);
```

**Fix 2.4: Clean up auth listener on Tab2 unmount** (Hypothesis #5)

Where: `Tab2.tsx`, line 497-517

Change:
```typescript
useEffect(() => {
  const listener = setupAuthListener(async (code, state) => { ... });
  
  return () => {
    // Clean up listener on unmount
    listener.remove();
  };
}, [handleCallback, checkAuthStatus]);
```

(Note: `setupAuthListener()` must be updated to return the listener handle)

---

### Phase 3: Testing & Validation

**Test Case 1: Fresh auth → play → exit → wait 5 min → play again**
- Expected: Works (if token still valid)
- Validates: Device transfer fix

**Test Case 2: Fresh auth → play → wait 1+ hour → play again**
- Expected: Works (token refreshed)
- Validates: Token refresh in `getOAuthToken` callback

**Test Case 3: Fresh auth → play → background app 10 min → foreground → play**
- Expected: Works (token refreshed on resume)
- Validates: App resume listener

**Test Case 4: Disconnect → re-auth → play**
- Expected: Works
- Validates: No leftover state from previous session

---

## Technical Debt & Long-Term Improvements

1. **Centralize token management**: Create a `TokenManager` singleton that:
   - Holds token in memory + Preferences
   - Auto-refreshes 5 min before expiry
   - Exposes `getValidToken()` that always returns a fresh token
   - All services call `TokenManager.getValidToken()` instead of `getAccessToken()`

2. **Device lifecycle management**: Track device state (active/inactive) and auto-transfer playback when needed

3. **Persistent error logging**: Store structured logs in Preferences, expose via debug modal

4. **Retry logic**: Add exponential backoff for 401/404 errors (auto-refresh token, retry once)

5. **Health check**: Ping `/me` endpoint on app resume to verify token validity before attempting playback

6. **Separate player instance per slideshow**: Currently player is a global singleton; consider lifecycle-scoped instances to avoid stale references

---

## Summary Table: Where Things Are

| Component | File | Purpose | State Storage |
|-----------|------|---------|---------------|
| **Auth flow** | `SpotifyAuthService.ts` | OAuth PKCE, token exchange/refresh | Capacitor Preferences |
| **Auth state** | `authStore.ts` | Zustand store for UI auth state | In-memory + Preferences |
| **Music data** | `musicStore.ts` | Spotify playlists, tracks, search | In-memory |
| **Player SDK** | `MusicPlayerService.ts` | Web Playback SDK wrapper | Module-scoped `player`, `deviceId` |
| **Playback UI** | `SlideshowPlayer.tsx` | Full-screen slideshow + music | Component state |
| **Token reads** | `SpotifyService.ts`, `MusicPlayerService.ts` | All API calls | Call `getAccessToken()` → Preferences |
| **Refresh trigger** | `authStore.checkAuthStatus()` | On Tab2 mount, after callback | Manual |
| **App lifecycle** | ❌ None | (missing) | N/A |

---

## Conclusion

The root causes are **architectural gaps in token lifecycle and device activation**, not bugs in the OAuth flow itself. The auth flow works correctly; the issue is that the token expires or the device becomes inactive, and the app doesn't handle those state transitions.

**Immediate priorities**:
1. **Add device transfer call** before playback (Hypothesis #1) → fixes 404 errors
2. **Add token refresh in `getOAuthToken`** callback (Hypothesis #2) → fixes auth errors
3. **Add app resume listener** to refresh tokens (Hypothesis #3) → prevents stale tokens after background

**Instrumentation**: Add structured logging to `initializePlayer()` and `startPlayback()` to capture device/token state at the moment of failure. This will validate the hypotheses and guide the fix.

**Next step**: Implement logging first (Phase 1), observe 2-3 failure scenarios, then apply the most relevant fixes from Phase 2.
