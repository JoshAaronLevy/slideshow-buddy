/**
 * Spotify OAuth Service (Backend Token Exchange)
 * 
 * Implements Authorization Code flow with PKCE (S256)
 * Token exchange is performed via backend to keep client secret secure
 * 
 * Environment Variables Required:
 * - VITE_SPOTIFY_CLIENT_ID: Spotify application client ID
 * - VITE_API_BASE_URL: Backend API base URL (for token exchange)
 * - VITE_SPOTIFY_SCOPES: Space-delimited scopes (optional)
 */

import { generateCodeVerifier, generateCodeChallenge } from '../lib/pkce';

const REDIRECT_URI = 'com.slideshowbuddy://callback';
const AUTH_BASE_URL = 'https://accounts.spotify.com/authorize';

// Default scopes if not specified in environment
const DEFAULT_SCOPES = 'user-read-email playlist-read-private';

// SessionStorage keys for OAuth state
const SESSION_KEYS = {
  STATE: 'spotify_oauth_state',
  CODE_VERIFIER: 'spotify_oauth_code_verifier',
} as const;

/**
 * Token response from backend
 */
export interface SpotifyTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

/**
 * Generate a cryptographically random state parameter
 * Used for CSRF protection
 */
const generateState = (): string => {
  const randomValues = new Uint8Array(32);
  crypto.getRandomValues(randomValues);
  return Array.from(randomValues, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * Build Spotify authorization URL with PKCE parameters
 * Generates and stores state + code_verifier in sessionStorage
 * 
 * @returns Promise resolving to authorization URL and state
 * @throws Error if VITE_SPOTIFY_CLIENT_ID is not configured
 */
export const buildAuthUrl = async (): Promise<{ url: string; state: string }> => {
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
  
  if (!clientId) {
    throw new Error('VITE_SPOTIFY_CLIENT_ID environment variable is not configured');
  }

  // Generate PKCE parameters
  const codeVerifier = generateCodeVerifier(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateState();

  // Store in sessionStorage (cleared on tab/browser close)
  sessionStorage.setItem(SESSION_KEYS.STATE, state);
  sessionStorage.setItem(SESSION_KEYS.CODE_VERIFIER, codeVerifier);

  // Get scopes from env or use defaults
  const scopes = import.meta.env.VITE_SPOTIFY_SCOPES || DEFAULT_SCOPES;

  // Build authorization URL
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: encodeURIComponent(clientId),
    redirect_uri: encodeURIComponent(REDIRECT_URI),
    scope: encodeURIComponent(scopes),
    state: encodeURIComponent(state),
    code_challenge_method: 'S256',
    code_challenge: encodeURIComponent(codeChallenge),
  });

  const url = `${AUTH_BASE_URL}?${params.toString()}`;

  return { url, state };
};

/**
 * Exchange authorization code for tokens via backend endpoint
 * 
 * Backend endpoint should POST to Spotify's token endpoint with:
 * - grant_type=authorization_code
 * - code
 * - redirect_uri (must match exactly)
 * - client_id
 * - code_verifier
 * - client_secret (backend only, NOT sent from app)
 * 
 * @param code - Authorization code from Spotify callback
 * @returns Promise resolving to tokens from backend
 * @throws Error if backend request fails or code_verifier not found
 * 
 * TODO: Implement backend endpoint at ${VITE_API_BASE_URL}/auth/spotify/token
 */
export const exchangeCodeForTokens = async (code: string): Promise<SpotifyTokenResponse> => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;

  if (!apiBaseUrl) {
    throw new Error('VITE_API_BASE_URL environment variable is not configured');
  }

  if (!clientId) {
    throw new Error('VITE_SPOTIFY_CLIENT_ID environment variable is not configured');
  }

  // Retrieve code_verifier from sessionStorage
  const codeVerifier = sessionStorage.getItem(SESSION_KEYS.CODE_VERIFIER);
  
  if (!codeVerifier) {
    throw new Error('Code verifier not found in session. OAuth flow may have been interrupted.');
  }

  try {
    // Exchange code for tokens via backend
    const response = await fetch(`${apiBaseUrl}/auth/spotify/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier,
        client_id: clientId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(
        `Token exchange failed: ${errorData.error || response.statusText} (${response.status})`
      );
    }

    const tokens: SpotifyTokenResponse = await response.json();

    // Clear code_verifier from sessionStorage on success
    sessionStorage.removeItem(SESSION_KEYS.CODE_VERIFIER);

    return tokens;
  } catch (error) {
    // Clear code_verifier on error as well (prevent reuse)
    sessionStorage.removeItem(SESSION_KEYS.CODE_VERIFIER);

    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to exchange authorization code for tokens');
  }
};

/**
 * Verify state parameter to prevent CSRF attacks
 * 
 * @param receivedState - State parameter from callback URL
 * @returns true if state matches, false otherwise
 */
export const verifyState = (receivedState: string): boolean => {
  const storedState = sessionStorage.getItem(SESSION_KEYS.STATE);
  
  if (!storedState) {
    return false;
  }

  const isValid = receivedState === storedState;

  // Clear state after verification (one-time use)
  sessionStorage.removeItem(SESSION_KEYS.STATE);

  return isValid;
};

/**
 * Clear all OAuth session data
 * Useful for cleanup or error recovery
 */
export const clearOAuthSession = (): void => {
  sessionStorage.removeItem(SESSION_KEYS.STATE);
  sessionStorage.removeItem(SESSION_KEYS.CODE_VERIFIER);
};
