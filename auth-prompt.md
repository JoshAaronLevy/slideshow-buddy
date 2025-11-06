You are an Ionic React + Capacitor 7 engineer. Implement Spotify OAuth (Authorization Code with PKCE) using Capacitor’s Browser (no webviews) and custom URL scheme redirect.

# Context & Goal
- App: Ionic + React + Vite + Capacitor 7 (iOS target).
- Bundle id: com.slideshowbuddy.app
- Custom redirect scheme: com.slideshowbuddy://callback  (ALREADY registered in Info.plist)
- Spotify Dashboard Redirect URIs include: com.slideshowbuddy://callback
- We must:
  1) Open Spotify auth page in a system browser (SFSafariViewController / ASWebAuthenticationSession) via @capacitor/browser.
  2) Handle callback via @capacitor/app `appUrlOpen` listener.
  3) Use PKCE (S256).
  4) Exchange authorization code for tokens **via a backend endpoint** (no client secret on device).
  5) Provide a clean React hook/service to call `loginWithSpotify()` and receive success/error.
  6) Make it easy to reuse across screens.
  7) No tests.

# Constraints / Requirements
- TypeScript everywhere.
- No webviews (do NOT use InAppBrowser or iframe). Use `@capacitor/browser` and `@capacitor/app`.
- Implement a small PKCE helper (verifier + S256 challenge).
- Persist `state` + `code_verifier` in `sessionStorage` (NOT localStorage).
- On callback: verify `state`, close the Browser, exchange `code` for tokens via our backend POST.
- Provide strong runtime guards and typed errors.
- Clean up listeners on unmount.
- Environment variables via Vite:
  - VITE_SPOTIFY_CLIENT_ID
  - VITE_API_BASE_URL              (backend that will perform token exchange)
  - VITE_SPOTIFY_SCOPES            (space-delimited, optional; provide a default in code)
- Use `encodeURIComponent` for all query params.
- Scopes: default to `user-read-email playlist-read-private` if env not set.
- Do NOT store the access token in this change; just return it from the hook and leave storage to the caller. (Add a TODO comment.)
- No tests.

# Packages to ensure installed (add to package.json if absent)
- "@capacitor/app": "^7"
- "@capacitor/browser": "^7"

# Files to add/modify
Create or modify the following. If a file exists, update it idempotently:

1) src/lib/pkce.ts  (new)
--------------------------------
- Export:
  - `generateCodeVerifier(length = 64): string` (URL-safe base64, no padding)
  - `sha256(input: string): Promise<ArrayBuffer>`
  - `base64UrlEncode(buffer: ArrayBuffer): string`
  - `generateCodeChallenge(verifier: string): Promise<string>`
- Keep it framework-agnostic. No DOM deps.

2) src/services/spotifyAuth.ts  (new)
--------------------------------
- Export:
  - `buildAuthUrl(): Promise<{ url: string; state: string }>` that:
    * reads VITE_SPOTIFY_CLIENT_ID
    * sets redirectUri = `com.slideshowbuddy://callback`
    * builds `state` (uuid or crypto random)
    * generates `code_verifier` + S256 `code_challenge`
    * saves `state` and `code_verifier` into `sessionStorage` keys:
      - "spotify_oauth_state"
      - "spotify_oauth_code_verifier"
    * scopes from VITE_SPOTIFY_SCOPES or default `user-read-email playlist-read-private`
    * returns the complete /authorize URL with S256.
  - `exchangeCodeForTokens(code: string): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }>`
    * POST `${import.meta.env.VITE_API_BASE_URL}/auth/spotify/token`
    * JSON body: { code, redirect_uri: "com.slideshowbuddy://callback", code_verifier, client_id }
    * Handle non-2xx with a typed error.
    * Clear code_verifier from sessionStorage on success/failure.
- NOTE: Do NOT inline the client secret anywhere in the app.

3) src/hooks/useSpotifyAuth.ts  (new)
--------------------------------
- Export default hook that:
  - Provides: `loginWithSpotify(): Promise<void>` and `status` | `error` state.
  - On `loginWithSpotify()`:
    * calls `buildAuthUrl()`, then `Browser.open({ url })`.
    * sets internal status to "pending".
  - On mount: registers `App.addListener('appUrlOpen', handler)`:
    * If URL starts with `com.slideshowbuddy://callback`, then:
      - `Browser.close()`
      - parse `code` and `state` from URL
      - verify `state` === sessionStorage "spotify_oauth_state"; if mismatch → error
      - call `exchangeCodeForTokens(code)` and resolve success (return tokens via an onSuccess callback parameter OR expose via state)
  - On unmount: remove the listener.
  - Provide optional callbacks to the hook init: `onSuccess(tokens)`, `onError(e)`.

4) src/components/SpotifyLoginButton.tsx  (new or modify existing)
--------------------------------
- Renders a button (Ionic or simple button) that calls `loginWithSpotify()` from the hook.
- Disabled while status === "pending".
- Display minimal error text if present.

5) src/pages/WhateverPage.tsx  (update)
--------------------------------
- Import `SpotifyLoginButton` and render it so we can manually test.

# Implementation Details

## pkce.ts
- Use Web Crypto API: `crypto.subtle.digest('SHA-256', ...)`.
- URL-safe Base64 w/out padding: replace + with -, / with _, strip =.

## spotifyAuth.ts
- Build authorize URL:
  - base: https://accounts.spotify.com/authorize
  - response_type=code
  - client_id
  - redirect_uri
  - scope
  - state
  - code_challenge_method=S256
  - code_challenge
- Ensure `encodeURIComponent` for all values.
- When exchanging code:
  - Backend endpoint should perform the POST to `https://accounts.spotify.com/api/token` with:
    * grant_type=authorization_code
    * code
    * redirect_uri (MUST exactly match)
    * client_id
    * code_verifier
  - Return tokens as JSON to the app.
  - Handle errors gracefully.

## useSpotifyAuth.ts
- Use `useRef` to store listener and `state`.
- Use a small internal state machine: "idle" | "pending" | "exchanging" | "success" | "error".
- On `appUrlOpen`, protect against multiple invocations (debounce with a ref).
- After success, clear sessionStorage keys "spotify_oauth_state" and "spotify_oauth_code_verifier".
- Leave token persistence to callers (add TODO comments on where to save).

## Example usage (add to docs comment in component)
```tsx
const { loginWithSpotify, status, error } = useSpotifyAuth({
  onSuccess: (tokens) => console.log('Tokens:', tokens),
  onError: (e) => console.error(e),
});
```

# Developer Experience / Commands

* Ensure dev can run on device/simulator:

  * `npm run ios:build-run` (existing script)
* No changes to tests. Do NOT write tests.

# Acceptance Criteria

* Tapping the login button opens Spotify auth in a system browser.
* After login/consent, Spotify redirects to `com.slideshowbuddy://callback?...`.
* App intercepts the URL, closes the browser, verifies `state`, exchanges `code` via backend, and surfaces tokens to `onSuccess`.
* If state mismatch or exchange fails, an error state is visible and `onError` fires.
* No client secret in the mobile app bundle.
* All TypeScript builds cleanly.

# Out-of-scope (leave TODOs)

* Token storage/refresh strategy and secure storage.
* Backend implementation of `/auth/spotify/token`.
* Full UX around logged-in state.

Now implement exactly as specified above. Do NOT write tests.