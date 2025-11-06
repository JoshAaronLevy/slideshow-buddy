# Spotify OAuth Implementation (PKCE + Backend Token Exchange)

## Overview

This implementation provides Spotify OAuth authentication using the Authorization Code flow with PKCE (Proof Key for Code Exchange) for secure authentication in a Capacitor mobile app.

## Key Features

- ✅ **PKCE (S256)**: Secure OAuth without client secret on device
- ✅ **System Browser**: Uses `@capacitor/browser` (SFSafariViewController/ASWebAuthenticationSession)
- ✅ **Backend Token Exchange**: Tokens obtained via backend API (no client secret exposed)
- ✅ **Custom URL Scheme**: `com.slideshowbuddy://callback`
- ✅ **sessionStorage**: OAuth state stored in session (not persistent)
- ✅ **TypeScript**: Fully typed with comprehensive error handling
- ✅ **React Hook**: Clean, reusable `useSpotifyAuth` hook

## Architecture

```
User clicks login
    ↓
App generates PKCE parameters (code_verifier, code_challenge, state)
    ↓
Stores state + code_verifier in sessionStorage
    ↓
Opens Spotify auth in system browser (@capacitor/browser)
    ↓
User authenticates with Spotify
    ↓
Spotify redirects to: com.slideshowbuddy://callback?code=...&state=...
    ↓
App intercepts URL via @capacitor/app listener
    ↓
Closes browser, verifies state
    ↓
Exchanges code for tokens via BACKEND endpoint
    ↓
Backend POSTs to Spotify with client_secret
    ↓
Returns tokens to app
    ↓
App receives tokens via onSuccess callback
```

## Files

### Core Implementation

- **`src/lib/pkce.ts`** - PKCE utility functions (verifier, challenge, S256)
- **`src/services/spotifyAuth.ts`** - Auth URL builder, backend token exchange
- **`src/hooks/useSpotifyAuth.ts`** - React hook for OAuth flow
- **`src/components/SpotifyLoginButton.tsx`** - Reusable login button component

### Demo

- **`src/pages/Tab1.tsx`** - Demo integration (can be removed)

## Environment Variables

Create a `.env` file (copy from `.env.example`):

```env
VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id
VITE_API_BASE_URL=https://api.yourapp.com
VITE_SPOTIFY_SCOPES=user-read-email playlist-read-private  # Optional
```

### Getting Spotify Client ID

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create an app
3. Add redirect URI: `com.slideshowbuddy://callback`
4. Copy Client ID to `.env`
5. **Keep Client Secret secure on your backend server**

## Backend Implementation (TODO)

Your backend must implement this endpoint:

**POST** `/auth/spotify/token`

**Request Body:**
```json
{
  "code": "authorization_code_from_spotify",
  "redirect_uri": "com.slideshowbuddy://callback",
  "code_verifier": "pkce_verifier_from_app",
  "client_id": "your_spotify_client_id"
}
```

**Backend Logic:**
```javascript
// Pseudo-code for backend endpoint
app.post('/auth/spotify/token', async (req, res) => {
  const { code, redirect_uri, code_verifier, client_id } = req.body;
  
  // Exchange code for tokens with Spotify
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri,
      client_id,
      code_verifier,
      client_secret: process.env.SPOTIFY_CLIENT_SECRET, // Server-side only!
    }),
  });
  
  const tokens = await response.json();
  
  // Return tokens to mobile app
  res.json(tokens);
});
```

## Usage

### Basic Example

```tsx
import SpotifyLoginButton from '../components/SpotifyLoginButton';

function MyComponent() {
  return (
    <SpotifyLoginButton
      onSuccess={(tokens) => {
        console.log('Access token:', tokens.access_token);
        // TODO: Store tokens securely (Capacitor Preferences, etc.)
      }}
      onError={(error) => {
        console.error('Login failed:', error);
      }}
      showStatus={true}
    />
  );
}
```

### Advanced Hook Usage

```tsx
import { useSpotifyAuth } from '../hooks/useSpotifyAuth';

function MyComponent() {
  const { loginWithSpotify, status, error, tokens } = useSpotifyAuth({
    onSuccess: (tokens) => {
      // Store tokens
      localStorage.setItem('spotify_token', tokens.access_token);
    },
    onError: (error) => {
      alert(`Login failed: ${error.message}`);
    },
  });

  return (
    <div>
      <button onClick={loginWithSpotify} disabled={status === 'pending'}>
        {status === 'pending' ? 'Logging in...' : 'Login with Spotify'}
      </button>
      {error && <p>Error: {error}</p>}
    </div>
  );
}
```

## Testing

### On Simulator/Device

1. Set environment variables in `.env`
2. Build and run: `npm run build && npx cap sync ios && npx cap run ios`
3. Tap the "Connect with Spotify" button
4. System browser opens with Spotify login
5. After login, app intercepts callback and exchanges token

### Debug Logging

Check console output for:
- Authorization URL generation
- Callback URL interception
- State verification
- Token exchange

## Security Considerations

### ✅ Best Practices Implemented

- **PKCE**: Prevents authorization code interception attacks
- **State parameter**: Prevents CSRF attacks
- **sessionStorage**: OAuth state not persisted across sessions
- **Backend token exchange**: Client secret never exposed to mobile app
- **URL scheme validation**: Only handles `com.slideshowbuddy://callback`

### ⚠️ TODO: Token Storage

This implementation does NOT store tokens. You must implement secure storage:

```tsx
// Example with Capacitor Preferences
import { Preferences } from '@capacitor/preferences';

const { loginWithSpotify } = useSpotifyAuth({
  onSuccess: async (tokens) => {
    await Preferences.set({
      key: 'spotify_access_token',
      value: tokens.access_token,
    });
    
    if (tokens.refresh_token) {
      await Preferences.set({
        key: 'spotify_refresh_token',
        value: tokens.refresh_token,
      });
    }
  },
});
```

For production, consider:
- Encrypted storage
- Token refresh logic
- Expiration handling

## iOS Configuration

The custom URL scheme is already configured in `ios/App/App/Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>com.slideshowbuddy.app</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.slideshowbuddy</string>
    </array>
  </dict>
</array>
```

## Troubleshooting

### Browser doesn't close after login

- Ensure `Browser.close()` is called in the `appUrlOpen` listener
- Check console for errors in callback handling

### State mismatch error

- OAuth state is stored in `sessionStorage`, which is cleared on browser refresh
- Don't test in web browsers; use iOS simulator/device

### Token exchange fails

- Verify `VITE_API_BASE_URL` is correct
- Implement backend endpoint at `/auth/spotify/token`
- Check backend logs for Spotify API errors

### Callback not triggered

- Verify URL scheme in Info.plist: `com.slideshowbuddy`
- Check Spotify Dashboard redirect URI: `com.slideshowbuddy://callback`
- Must test on iOS simulator/device (not web browser)

## Migration from Existing Implementation

This implementation coexists with the existing `SpotifyAuthService.ts`. To migrate:

1. Update components to use `useSpotifyAuth` hook instead of `useAuthStore`
2. Implement backend token exchange endpoint
3. Update token storage to use new token format
4. Remove old service files when migration is complete

## References

- [Spotify Authorization Code Flow](https://developer.spotify.com/documentation/web-api/tutorials/code-flow)
- [RFC 7636: PKCE](https://tools.ietf.org/html/rfc7636)
- [Capacitor Browser Plugin](https://capacitorjs.com/docs/apis/browser)
- [Capacitor App Plugin](https://capacitorjs.com/docs/apis/app)
