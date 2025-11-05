# Phase 2 Implementation Notes

## Completed Tasks

### 1. Spotify Configuration Verified
- ✅ Confirmed Client ID in `.env` file
- ✅ Updated `.env.example` with security note about Client Secret
- ✅ **Important**: Client Secret should NOT be used in mobile apps - PKCE flow only requires Client ID

### 2. PKCE Utilities Created (`src/utils/pkce.ts`)
Implements Proof Key for Code Exchange for secure OAuth:

**Functions:**
- ✅ `generateCodeVerifier()` - Generate random 64-character verifier
- ✅ `generateCodeChallenge(verifier)` - Create SHA-256 hash challenge
- ✅ `base64UrlEncode(buffer)` - Encode for URL safety
- ✅ `generateState()` - Random state for CSRF protection

**Security:**
- Uses Web Crypto API for cryptographic randomness
- Base64-URL encoding (no padding, URL-safe characters)
- State parameter prevents CSRF attacks

### 3. Spotify Auth Service Created (`src/services/SpotifyAuthService.ts`)
Comprehensive OAuth 2.0 service with PKCE flow:

**Authentication Functions:**
- ✅ `login()` - Start OAuth flow, opens browser
- ✅ `handleCallback(code, state)` - Exchange code for tokens
- ✅ `refreshAccessToken()` - Refresh expired tokens
- ✅ `logout()` - Clear all stored data

**Token Management:**
- ✅ `storeTokens(tokens)` - Secure storage via Capacitor Preferences
- ✅ `getAccessToken()` - Retrieve stored token
- ✅ `isTokenExpired()` - Check expiry (5-minute buffer)

**User Management:**
- ✅ `getCurrentUser()` - Fetch Spotify profile
- ✅ `getStoredUser()` - Retrieve cached profile

**Utilities:**
- ✅ `checkAuthStatus()` - Verify and refresh auth on app launch
- ✅ `setupAuthListener()` - Listen for OAuth callback URL

**Flow:**
1. User clicks "Connect with Spotify"
2. Generate PKCE parameters (verifier, challenge, state)
3. Store verifier and state locally
4. Open Spotify login in browser
5. User authorizes app
6. Spotify redirects to `slideshowbuddy://callback?code=...&state=...`
7. App receives callback via URL listener
8. Verify state matches
9. Exchange code + verifier for tokens
10. Store tokens securely
11. Fetch user profile
12. Update UI

### 4. Auth Store Created (`src/stores/authStore.ts`)
Zustand-based state management for authentication:

**State:**
- `isAuthenticated: boolean` - Login status
- `user: SpotifyUser | null` - User profile
- `accessToken: string | null` - Current access token
- `isLoading: boolean` - Operation status
- `error: string | null` - Error messages

**Actions:**
- ✅ `login()` - Initiate OAuth flow
- ✅ `handleCallback(code, state)` - Complete OAuth
- ✅ `logout()` - Clear auth data
- ✅ `refreshToken()` - Refresh expired token
- ✅ `checkAuthStatus()` - Verify auth on launch
- ✅ `setError(error)` - Error handling

**Features:**
- Automatic token refresh on expiry
- Persistent auth across app restarts
- Error handling with user feedback

### 5. Spotify Connection UI Built (Tab 2 - Music)
Complete authentication interface:

**Not Connected State:**
- ✅ Spotify icon/branding
- ✅ "Connect to Spotify" button (Spotify green)
- ✅ Premium requirement notice
- ✅ Helpful description text

**Connecting State:**
- ✅ Loading spinner
- ✅ "Connecting to Spotify..." message

**Connected State:**
- ✅ User profile card with:
  - Avatar (or initial placeholder)
  - Display name
  - Email (if available)
  - Account type badge (Premium/Free)
- ✅ Premium warning (if Free account)
- ✅ Disconnect button
- ✅ Placeholder for music selection (Phase 3)

**Features:**
- Toast notifications for errors
- Auto-check auth on mount
- OAuth callback handling
- Premium vs Free account detection
- Responsive layout

**Styling (`Tab2.css`):**
- Spotify brand colors (#1DB954)
- Profile card with avatar
- Premium/Free badges with icons
- Warning box for Free accounts
- Centered layout with max-width
- Mobile-responsive profile header

## Technical Details

### OAuth 2.0 PKCE Flow
```
1. Generate code_verifier (random 64 chars)
2. Generate code_challenge (SHA256(code_verifier))
3. Store code_verifier locally
4. Redirect to Spotify with code_challenge
5. User authorizes
6. Receive authorization code
7. Exchange code + code_verifier for tokens
8. Store tokens securely
```

### Token Storage
```typescript
{
  access_token: string,      // Bearer token for API calls
  refresh_token: string,     // Token to get new access_token
  expires_in: number,        // Seconds until expiry
  expires_at: number,        // Timestamp when token expires
  token_type: "Bearer",
  scope: string              // Granted permissions
}
```

### Scopes Required
- `user-read-private` - Read user profile
- `user-read-email` - Read user email
- `playlist-read-private` - Read private playlists
- `playlist-read-collaborative` - Read collaborative playlists
- `user-read-recently-played` - Recently played tracks
- `streaming` - Control playback
- `user-read-playback-state` - Read playback state
- `user-modify-playback-state` - Control playback

### Spotify Developer Setup
In Spotify Dashboard, ensure:
1. **Redirect URIs** includes: `slideshowbuddy://callback`
2. **Bundle ID** (iOS) matches: `com.slideshowbuddy.app`
3. App is in **Development Mode** (or submitted for quota extension)

## Security Considerations

### ✅ Secure Practices Used
- PKCE flow (no client secret in app)
- State parameter for CSRF protection
- Tokens stored in Capacitor Preferences (encrypted)
- Token expiry checking with 5-minute buffer
- Automatic token refresh

### ❌ What NOT to Do
- ❌ Don't use Client Secret in mobile apps
- ❌ Don't use Implicit Grant flow (deprecated)
- ❌ Don't store tokens in localStorage (use Preferences)
- ❌ Don't log tokens in production

## Known Limitations (MVP Scope)

1. **Browser-based OAuth**: Opens external browser for login
   - **Why**: Capacitor Browser is standard for OAuth
   - **Future**: Could use SFSafariViewController for in-app experience

2. **No Offline Mode**: Requires internet for auth/refresh
   - **Why**: OAuth requires server communication
   - **Future**: Cache user data, graceful degradation

3. **Token Expiry**: Tokens expire after 1 hour
   - **Current**: Auto-refresh when expired
   - **Future**: Proactive refresh before expiry

4. **Premium Required**: Free accounts can't play music
   - **Why**: Spotify API restriction
   - **Current**: Warning message displayed
   - **Future**: Could offer preview-only mode

## Testing Checklist

### On Configured Laptop
1. **Setup**
   - [ ] Pull latest code
   - [ ] Run `npx cap sync ios`
   - [ ] Verify `.env` has `VITE_SPOTIFY_CLIENT_ID`
   - [ ] Verify Spotify Dashboard has redirect URI

2. **Not Connected Flow**
   - [ ] Tab 2 shows "Connect to Spotify" card
   - [ ] Premium notice is visible
   - [ ] Button has Spotify green color

3. **Login Flow**
   - [ ] Click "Connect with Spotify"
   - [ ] Browser opens to Spotify login
   - [ ] After login/authorization, redirects back to app
   - [ ] Loading spinner shows briefly
   - [ ] Profile card appears with user info

4. **Connected State**
   - [ ] Avatar displays (or initial if no image)
   - [ ] Display name shows correctly
   - [ ] Email shows (if available)
   - [ ] Premium badge shows (if Premium)
   - [ ] Free badge + warning shows (if Free)

5. **Logout Flow**
   - [ ] Click "Disconnect"
   - [ ] Returns to "Connect to Spotify" card
   - [ ] User data cleared

6. **Persistence**
   - [ ] Close and reopen app
   - [ ] Should still be logged in
   - [ ] Profile data restored

7. **Error Handling**
   - [ ] Cancel login - shows error toast
   - [ ] Invalid redirect - shows error toast
   - [ ] Network error - shows error toast

## Files Created/Modified

### Created
- `src/utils/pkce.ts` - PKCE utility functions
- `src/services/SpotifyAuthService.ts` - OAuth service
- `src/stores/authStore.ts` - Auth state management
- `PHASE-2-NOTES.md` - This documentation

### Modified
- `src/pages/Tab2.tsx` - Spotify connection UI
- `src/pages/Tab2.css` - Connection UI styles
- `.env.example` - Added security note about Client Secret
- `package.json` - Added `@capacitor/browser`

## Dependencies Added
- `@capacitor/browser` - OAuth browser flow

## Ready for Phase 3
With Phase 2 complete, the app now has:
- ✅ Spotify OAuth authentication
- ✅ Secure token management
- ✅ User profile display
- ✅ Premium account detection
- ✅ Persistent authentication

**Phase 3** will add Spotify music selection:
- Fetch user playlists
- Display playlist grid
- Search functionality
- Track selection from playlists
- Recently played tracks
- Music source state management

## Important Notes

### URL Scheme Configuration
The iOS app MUST be configured to handle the `slideshowbuddy://` URL scheme. This is done in Xcode:
1. Open `ios/App/App.xcodeproj` in Xcode
2. Select App target → Info
3. Add URL Types:
   - Identifier: `com.slideshowbuddy.app`
   - URL Schemes: `slideshowbuddy`

This allows iOS to redirect back to the app after Spotify authorization.

### Environment Variables
Remember to create `.env` file (not tracked by git):
```
VITE_SPOTIFY_CLIENT_ID=your_actual_client_id_here
```

Never commit this file or expose the Client ID publicly if the app goes to production.
