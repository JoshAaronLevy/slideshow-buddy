# Spotify OAuth Testing Documentation for macOS

## Overview

This document provides comprehensive testing instructions for Spotify OAuth authentication on macOS using Electron. The implementation uses a custom protocol handler (`com.slideshowbuddy://`) to receive OAuth callbacks from Spotify, eliminating the need for a local server.

### OAuth Flow Differences by Platform

- **macOS (Electron)**: Uses custom protocol handler with IPC communication between main and renderer processes
- **iOS**: Uses Universal Links or custom URL schemes via Capacitor
- **Web**: Uses redirect-based flow with local server or URL-based callback handling

## Prerequisites

Before testing, ensure you have:

- [ ] **Spotify Premium Account**: Required for full API access
- [ ] **Backend Server Running**: `https://slideshow-buddy-server.onrender.com` must be operational
- [ ] **macOS Development Environment**: Xcode and Electron dependencies installed
- [ ] **Valid Spotify App Configuration**: Client ID configured in environment variables
- [ ] **Protocol Handler Registration**: Electron app must register `com.slideshowbuddy` protocol

## OAuth Flow Architecture

### 1. Protocol Registration
```txt
Electron Main Process (index.ts:15-23)
└── Registers 'com.slideshowbuddy' protocol handler
└── Sets up 'open-url' event listener
```

### 2. IPC Bridge Setup
```txt
Preload Script (preload.ts:57-70)
└── Exposes window.electron.spotify.onOAuthCallback()
└── Bridges IPC messages to renderer process
```

### 3. Platform Detection
```txt
SpotifyAuthService (SpotifyAuthService.ts:487-500)
└── Detects macOS via isMacOS() utility
└── Sets up Electron-specific OAuth listener
```

## Testing Steps

### Step 1: App Initialization
1. Build and run the Electron app:
   ```bash
   npm run build
   npm run electron:pack
   ```

2. **Expected Behavior**: Check console for protocol registration
   ```
   [Expected Console Output]
   Protocol 'com.slideshowbuddy' registered successfully
   ```

### Step 2: OAuth Listener Setup
1. Navigate to a page with Spotify login functionality
2. Open browser developer tools

2. **Expected Behavior**: OAuth listener setup logs
   ```
   [Expected Console Output]
   [SpotifyAuth] Setting up OAuth callback listener
   [SpotifyAuth] Setting up macOS Electron OAuth listener
   [SpotifyAuth] Electron auth listener setup complete
   ```

### Step 3: Login Initiation
1. Click the "Connect with Spotify" button
2. Monitor console output

3. **Expected Behavior**: 
   - Authorization URL generation and browser opening
   ```
   [Expected Console Output]
   [SpotifyAuth] Opening authorization URL: https://accounts.spotify.com/authorize?...
   [SpotifyAuth] Redirect URI being sent: com.slideshowbuddy://callback
   ```
   - System browser opens with Spotify login page

### Step 4: User Authentication
1. Complete Spotify authentication in browser
2. Grant permissions when prompted
3. Browser will attempt redirect to `com.slideshowbuddy://callback`

4. **Expected Behavior**: 
   - Browser shows "Opening Slideshow Buddy..." or similar
   - App comes to foreground automatically

### Step 5: Callback Processing
1. Monitor Electron main process console
2. Monitor renderer process console

2. **Expected Behavior**: Callback reception and processing
   ```
   [Main Process Console - index.ts]
   OAuth callback received: com.slideshowbuddy://callback?code=...&state=...
   OAuth callback sent to renderer: com.slideshowbuddy://callback?code=...&state=...
   
   [Renderer Console - preload.ts]
   OAuth callback received in preload: com.slideshowbuddy://callback?code=...&state=...
   
   [Renderer Console - SpotifyAuthService.ts]
   [SpotifyAuth] Electron OAuth callback received: com.slideshowbuddy://callback?code=...&state=...
   [SpotifyAuth] OAuth callback detected
   [SpotifyAuth] Invoking callback handler...
   ```

### Step 6: Token Exchange
1. Monitor token exchange process
2. Verify backend communication

2. **Expected Behavior**: Token exchange via backend
   ```
   [Expected Console Output]
   [SpotifyAuth] handleCallback called
   [SpotifyAuth] State verification
   [SpotifyAuth] Code verifier retrieved  
   [SpotifyAuth] Exchanging code for tokens via backend server...
   [SpotifyAuth] Backend token URL: https://slideshow-buddy-server.onrender.com/auth/spotify/token
   [SpotifyAuth] Tokens received
   [SpotifyAuth] Tokens stored successfully
   ```

### Step 7: Authentication Complete
1. Verify stored tokens
2. Check user profile fetch

2. **Expected Behavior**: 
   - UI updates to show connected state
   - User profile information appears
   ```
   [Expected Console Output]
   [SpotifyAuth] User profile fetched
   [SpotifyAuth] User profile stored successfully
   ```

## Testing Checklist

### Pre-Authentication Verification
- [ ] Protocol handler registered (check early in Electron logs)
- [ ] IPC bridge functional (`window.electron.spotify` available)
- [ ] Platform detection correctly identifies macOS
- [ ] OAuth listener setup completes without errors

### Authentication Flow Verification
- [ ] Login button triggers browser opening
- [ ] Browser opens Spotify OAuth page with correct parameters
- [ ] Redirect URI matches `com.slideshowbuddy://callback`
- [ ] PKCE parameters (code_challenge, state) are generated
- [ ] Code verifier and state stored in Preferences

### Callback Handling Verification
- [ ] After user approval, app receives callback via protocol handler
- [ ] IPC bridge forwards callback from main to renderer process
- [ ] Callback URL parsing extracts code and state correctly
- [ ] State verification passes (CSRF protection)
- [ ] Code verifier retrieved from storage

### Token Exchange Verification
- [ ] Backend communication succeeds
- [ ] Token exchange request includes correct parameters:
  - `code`: Authorization code from Spotify
  - `code_verifier`: PKCE code verifier
- [ ] Response contains access_token, refresh_token, expires_in
- [ ] Tokens stored securely in Preferences
- [ ] TokenManager updated with new tokens
- [ ] Temporary OAuth data cleared (code_verifier, state)

### Post-Authentication Verification
- [ ] User profile fetched successfully
- [ ] UI updates to authenticated state
- [ ] Tokens persist across app restarts
- [ ] Auto-refresh triggers before token expiry
- [ ] Logout clears all stored data

## Expected Console Output Patterns

### Successful Flow
```
1. [SpotifyAuth] Setting up OAuth callback listener
2. [SpotifyAuth] Opening authorization URL: https://accounts.spotify.com/authorize?...
3. OAuth callback received: com.slideshowbuddy://callback?code=...&state=...
4. [SpotifyAuth] Electron OAuth callback received: com.slideshowbuddy://callback?code=...&state=...
5. [SpotifyAuth] handleCallback called
6. [SpotifyAuth] State verification { matches: true }
7. [SpotifyAuth] Exchanging code for tokens via backend server...
8. [SpotifyAuth] Tokens received { hasAccessToken: true, hasRefreshToken: true }
9. [SpotifyAuth] Tokens stored successfully
10. [SpotifyAuth] User profile fetched
```

### Error Patterns to Watch For
```
[ERROR] Protocol registration failed
[ERROR] Electron Spotify OAuth bridge not available
[ERROR] State mismatch - possible CSRF attack
[ERROR] Failed to complete Spotify authentication
[ERROR] No refresh token available
```

## Troubleshooting

### Browser Doesn't Open
**Symptoms**: Login button clicks but no browser opens
**Possible Causes**:
- Browser module not available
- URL malformed
**Debug Steps**:
1. Check browser availability: `await Browser.open({ url: 'https://google.com' })`
2. Verify authorization URL construction
3. Check SPOTIFY_CONFIG constants

### App Doesn't Receive Callback
**Symptoms**: Browser shows redirect but app doesn't respond
**Possible Causes**:
- Protocol handler not registered
- IPC bridge not set up
- App not in foreground
**Debug Steps**:
1. Verify protocol registration in Electron console
2. Test manual protocol URL: `open "com.slideshowbuddy://callback?test=1"`
3. Check `window.electron.spotify` availability in dev tools

### Token Exchange Fails
**Symptoms**: Callback received but token exchange errors
**Possible Causes**:
- Backend server issues
- Network connectivity
- Invalid PKCE parameters
**Debug Steps**:
1. Test backend directly: `curl https://slideshow-buddy-server.onrender.com/health`
2. Verify stored code_verifier exists
3. Check network requests in dev tools

### State Mismatch Errors
**Symptoms**: "State mismatch - possible CSRF attack"
**Possible Causes**:
- Multiple concurrent OAuth attempts
- State not stored properly
- Expired OAuth session
**Debug Steps**:
1. Clear stored OAuth data: `Preferences.remove({ key: 'spotify_state' })`
2. Restart OAuth flow from beginning
3. Ensure single OAuth attempt at a time

### Tokens Don't Persist
**Symptoms**: Re-authentication required on app restart
**Possible Causes**:
- Storage permissions
- TokenManager not initialized
- Preferences not saving
**Debug Steps**:
1. Check Preferences.get() calls return stored values
2. Verify TokenManager.getInstance() works
3. Test manual token storage/retrieval

## Backend Integration Notes

The OAuth implementation uses the existing backend server at `https://slideshow-buddy-server.onrender.com` **without any modifications required**.

### Backend Endpoints Used
- **Token Exchange**: `POST /auth/spotify/token`
  - Receives: `{ code, code_verifier }`
  - Returns: `{ access_token, refresh_token, expires_in }`
  
- **Token Refresh**: `POST /auth/spotify/refresh`  
  - Receives: `{ refresh_token }`
  - Returns: `{ access_token, expires_in }`

### Key Backend Features
- **PKCE Flow Support**: Backend validates code_verifier with Spotify
- **Secure Token Exchange**: Backend handles client_secret securely
- **Cross-Platform Compatibility**: Same endpoints work for iOS and macOS
- **Consistent Redirect URI**: `com.slideshowbuddy://callback` works across platforms

### No Backend Changes Required
The backend is designed to be platform-agnostic:
- Same PKCE flow for both iOS and macOS
- Same redirect URI format supported
- Same response format for tokens
- Same error handling patterns

## Testing Environment Setup

### Environment Variables Required
```bash
# Spotify Configuration
VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id
VITE_SPOTIFY_BACKEND_URL=https://slideshow-buddy-server.onrender.com

# Development
NODE_ENV=development
```

### Development vs Production
- **Development**: Protocol handler registration includes process.execPath
- **Production**: Direct protocol registration
- **Both**: Same OAuth flow and backend integration

### Testing in Different Environments
1. **Development Mode**: `npm run electron:dev`
2. **Production Build**: `npm run electron:pack`
3. **Distribution Testing**: Test with packaged .app file

## Security Considerations

### PKCE Implementation
- Code verifier: Cryptographically secure random string
- Code challenge: SHA256 hash of code verifier
- State parameter: Random string for CSRF protection

### Token Storage
- Access tokens: Stored in Capacitor Preferences (encrypted)
- Refresh tokens: Stored securely for automatic refresh
- No sensitive data in logs (tokens are truncated in console output)

### Protocol Handler Security
- Only accepts callbacks matching expected URL pattern
- State verification prevents CSRF attacks
- Temporary OAuth data cleared after use

---

**Last Updated**: November 2024  
**Implementation Stage**: Stage 5 Complete  
**Backend Version**: Compatible with existing deployed backend