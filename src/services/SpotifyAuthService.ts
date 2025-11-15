/**
 * SpotifyAuthService - Handles Spotify OAuth 2.0 authentication with PKCE
 */

import { Browser } from '@capacitor/browser';
import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';
import axios from 'axios';
import { SPOTIFY_CONFIG, STORAGE_KEYS } from '../constants';
import { SpotifyTokens, SpotifyUser } from '../types';
import { generateCodeVerifier, generateCodeChallenge, generateState } from '../utils/pkce';
import TokenManager from './TokenManager';
import { isMacOS } from '../utils/platform';

// Store the current auth listener to prevent accumulation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentAuthListener: any = null;

/**
 * Start the Spotify OAuth login flow
 * Opens browser for user authentication
 */
export const login = async (): Promise<void> => {
  try {
    // Generate PKCE parameters
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateState();

    // Store code verifier and state for later verification
    await Preferences.set({ key: 'spotify_code_verifier', value: codeVerifier });
    await Preferences.set({ key: 'spotify_state', value: state });

    // Build authorization URL
    const authUrl = new URL(SPOTIFY_CONFIG.AUTH_URL);
    authUrl.searchParams.append('client_id', SPOTIFY_CONFIG.CLIENT_ID);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('redirect_uri', SPOTIFY_CONFIG.REDIRECT_URI);
    authUrl.searchParams.append('code_challenge_method', 'S256');
    authUrl.searchParams.append('code_challenge', codeChallenge);
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('scope', SPOTIFY_CONFIG.SCOPES);

    const finalUrl = authUrl.toString();
    console.log('[SpotifyAuth] Opening authorization URL:', finalUrl);
    console.log('[SpotifyAuth] Redirect URI being sent:', SPOTIFY_CONFIG.REDIRECT_URI);

    // Open browser for authentication
    await Browser.open({ url: finalUrl });
  } catch (error) {
    console.error('Error starting Spotify login:', error);
    throw new Error('Failed to start Spotify login');
  }
};

/**
 * Handle the OAuth callback with authorization code
 * Exchange code for access token
 * @param code - Authorization code from Spotify
 * @param state - State parameter for verification
 */
export const handleCallback = async (code: string, state: string): Promise<SpotifyTokens> => {
  console.log('[SpotifyAuth] handleCallback called', { 
    code: code.substring(0, 10) + '...', 
    state: state.substring(0, 10) + '...' 
  });
  
  try {
    // Verify state to prevent CSRF
    const { value: storedState } = await Preferences.get({ key: 'spotify_state' });
    console.log('[SpotifyAuth] State verification', { 
      receivedState: state.substring(0, 10) + '...', 
      storedState: storedState?.substring(0, 10) + '...',
      matches: state === storedState 
    });
    
    if (state !== storedState) {
      throw new Error('State mismatch - possible CSRF attack');
    }

    // Get code verifier
    const { value: codeVerifier } = await Preferences.get({ key: 'spotify_code_verifier' });
    if (!codeVerifier) {
      throw new Error('Code verifier not found');
    }
    console.log('[SpotifyAuth] Code verifier retrieved');

    // Exchange authorization code for tokens via backend server
    console.log('[SpotifyAuth] Exchanging code for tokens via backend server...');
    const tokenUrl = `${SPOTIFY_CONFIG.BACKEND_URL}${SPOTIFY_CONFIG.TOKEN_ENDPOINT}`;
    console.log('[SpotifyAuth] Backend token URL:', tokenUrl);
    
    const response = await axios.post(
      tokenUrl,
      {
        code,
        code_verifier: codeVerifier,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const tokens: SpotifyTokens = {
      ...response.data,
      expires_at: Date.now() + response.data.expires_in * 1000,
    };
    
    console.log('[SpotifyAuth] Tokens received', { 
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresIn: response.data.expires_in 
    });

    // Store tokens securely (Stage 6: also updates TokenManager)
    await storeTokens(tokens);
    await TokenManager.getInstance().setTokens(
      tokens.access_token,
      tokens.refresh_token,
      response.data.expires_in
    );
    console.log('[SpotifyAuth] Tokens stored successfully');

    // Clean up temporary data
    await Preferences.remove({ key: 'spotify_code_verifier' });
    await Preferences.remove({ key: 'spotify_state' });
    console.log('[SpotifyAuth] Temporary data cleaned up');

    return tokens;
  } catch (error) {
    console.error('[SpotifyAuth] Error handling callback:', error);
    if (axios.isAxiosError(error)) {
      console.error('[SpotifyAuth] Axios error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
    }
    throw new Error('Failed to complete Spotify authentication');
  }
};

/**
 * Refresh the access token using refresh token
 */
export const refreshAccessToken = async (): Promise<SpotifyTokens> => {
  const startTime = Date.now();
  
  try {
    const { value: refreshToken } = await Preferences.get({
      key: STORAGE_KEYS.SPOTIFY_REFRESH_TOKEN,
    });

    if (!refreshToken) {
      console.log('[Auth:TokenRefresh]', JSON.stringify({
        timestamp: startTime,
        action: 'token_refresh',
        result: 'error',
        error: 'no_refresh_token',
      }));
      throw new Error('No refresh token available');
    }
    
    console.log('[SpotifyAuth] Refreshing token via backend server...');
    console.log('[Auth:TokenRefresh]', JSON.stringify({
      timestamp: startTime,
      action: 'token_refresh',
      status: 'started',
      refreshUrl: `${SPOTIFY_CONFIG.BACKEND_URL}${SPOTIFY_CONFIG.REFRESH_ENDPOINT}`,
    }));
    
    const refreshUrl = `${SPOTIFY_CONFIG.BACKEND_URL}${SPOTIFY_CONFIG.REFRESH_ENDPOINT}`;
    
    const response = await axios.post(
      refreshUrl,
      {
        refresh_token: refreshToken,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const tokens: SpotifyTokens = {
      ...response.data,
      refresh_token: refreshToken, // Keep existing refresh token if not returned
      expires_at: Date.now() + response.data.expires_in * 1000,
    };

    await storeTokens(tokens);
    
    // Stage 6: Also update TokenManager
    await TokenManager.getInstance().setTokens(
      tokens.access_token,
      tokens.refresh_token,
      response.data.expires_in
    );
    
    console.log('[Auth:TokenRefresh]', JSON.stringify({
      timestamp: Date.now(),
      action: 'token_refresh',
      result: 'success',
      expiresAt: tokens.expires_at,
      expiresInSeconds: response.data.expires_in,
      elapsedMs: Date.now() - startTime,
    }));
    
    return tokens;
  } catch (error) {
    console.error('Error refreshing Spotify token:', error);
    
    console.log('[Auth:TokenRefresh]', JSON.stringify({
      timestamp: Date.now(),
      action: 'token_refresh',
      result: 'error',
      error: error instanceof Error ? error.message : 'unknown',
      httpStatus: axios.isAxiosError(error) ? error.response?.status : undefined,
      httpResponseData: axios.isAxiosError(error) ? error.response?.data : undefined,
      elapsedMs: Date.now() - startTime,
    }));
    
    throw new Error('Failed to refresh Spotify token');
  }
};

/**
 * Store tokens securely in device storage
 */
export const storeTokens = async (tokens: SpotifyTokens): Promise<void> => {
  await Preferences.set({
    key: STORAGE_KEYS.SPOTIFY_ACCESS_TOKEN,
    value: tokens.access_token,
  });
  await Preferences.set({
    key: STORAGE_KEYS.SPOTIFY_REFRESH_TOKEN,
    value: tokens.refresh_token,
  });
  await Preferences.set({
    key: STORAGE_KEYS.SPOTIFY_TOKEN_EXPIRY,
    value: tokens.expires_at.toString(),
  });
};

/**
 * Get stored access token
 * @deprecated Stage 6: Use TokenManager.getInstance().getValidToken() instead for guaranteed fresh tokens
 * Kept for backward compatibility
 */
export const getAccessToken = async (): Promise<string | null> => {
  const { value } = await Preferences.get({ key: STORAGE_KEYS.SPOTIFY_ACCESS_TOKEN });
  
  // Stage 1: Log token read with expiry info
  const { value: expiryValue } = await Preferences.get({ key: STORAGE_KEYS.SPOTIFY_TOKEN_EXPIRY });
  if (value && expiryValue) {
    const expiresAt = parseInt(expiryValue, 10);
    const now = Date.now();
    const timeUntilExpirySeconds = Math.floor((expiresAt - now) / 1000);
    const isExpired = now >= expiresAt - 5 * 60 * 1000;
    
    console.log('[Auth:TokenRead]', JSON.stringify({
      timestamp: now,
      action: 'token_read',
      hasToken: true,
      expiresAt,
      timeUntilExpirySeconds,
      isExpired,
    }));
  } else if (!value) {
    console.log('[Auth:TokenRead]', JSON.stringify({
      timestamp: Date.now(),
      action: 'token_read',
      hasToken: false,
    }));
  }
  
  return value;
};

/**
 * Check if the access token is expired
 */
export const isTokenExpired = async (): Promise<boolean> => {
  const { value } = await Preferences.get({ key: STORAGE_KEYS.SPOTIFY_TOKEN_EXPIRY });
  if (!value) {
    console.log('[Auth:ExpiryCheck]', JSON.stringify({
      timestamp: Date.now(),
      action: 'expiry_check',
      result: true,
      reason: 'no_expiry_value',
    }));
    return true;
  }

  const expiresAt = parseInt(value, 10);
  const now = Date.now();
  const timeUntilExpirySeconds = Math.floor((expiresAt - now) / 1000);
  const isExpired = now >= expiresAt - 5 * 60 * 1000;
  
  // Consider expired if less than 5 minutes remaining
  console.log('[Auth:ExpiryCheck]', JSON.stringify({
    timestamp: now,
    action: 'expiry_check',
    result: isExpired,
    expiresAt,
    timeUntilExpirySeconds,
    reason: isExpired ? 'expired_or_expiring_soon' : 'valid',
  }));
  
  return isExpired;
};

/**
 * Get current user profile from Spotify
 * Stage 6: Uses TokenManager for guaranteed fresh token
 */
export const getCurrentUser = async (): Promise<SpotifyUser> => {
  console.log('[SpotifyAuth] Fetching current user profile...');
  
  try {
    const token = await TokenManager.getInstance().getValidToken();
    console.log('[SpotifyAuth] Access token retrieved for user profile request');

    const response = await axios.get(`${SPOTIFY_CONFIG.API_BASE_URL}/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const user: SpotifyUser = {
      id: response.data.id,
      display_name: response.data.display_name,
      email: response.data.email,
      images: response.data.images,
      product: response.data.product,
    };
    
    console.log('[SpotifyAuth] User profile fetched', {
      id: user.id,
      displayName: user.display_name,
      email: user.email,
      product: user.product
    });

    // Store user data
    await Preferences.set({
      key: STORAGE_KEYS.SPOTIFY_USER,
      value: JSON.stringify(user),
    });
    console.log('[SpotifyAuth] User profile stored successfully');

    return user;
  } catch (error) {
    console.error('[SpotifyAuth] Error getting user profile:', error);
    if (axios.isAxiosError(error)) {
      console.error('[SpotifyAuth] API error details:', {
        status: error.response?.status,
        data: error.response?.data
      });
    }
    throw new Error('Failed to get user profile');
  }
};

/**
 * Get stored user data
 */
export const getStoredUser = async (): Promise<SpotifyUser | null> => {
  const { value } = await Preferences.get({ key: STORAGE_KEYS.SPOTIFY_USER });
  return value ? JSON.parse(value) : null;
};

/**
 * Logout - clear all stored tokens and user data
 * Stage 6: Also clears TokenManager
 */
export const logout = async (): Promise<void> => {
  // Clear TokenManager (also clears Preferences and stops auto-refresh)
  await TokenManager.getInstance().clearTokens();
  
  // Clear user data
  await Preferences.remove({ key: STORAGE_KEYS.SPOTIFY_USER });
  
  // Remove auth listener on logout
  removeAuthListener();
};

/**
 * Check authentication status on app launch
 * Stage 6: Uses TokenManager to check for valid token
 */
export const checkAuthStatus = async (): Promise<boolean> => {
  console.log('[SpotifyAuth] Checking authentication status...');
  
  try {
    await TokenManager.getInstance().getValidToken();
    console.log('[SpotifyAuth] Valid access token found');
    return true;
  } catch {
    console.log('[SpotifyAuth] No valid access token found');
    return false;
  }
};

/**
 * Setup Electron OAuth callback listener for macOS
 * Uses the IPC bridge to receive OAuth callbacks from the main process
 */
const setupElectronAuthListener = (onCallback: (url: string) => void): (() => void) => {
  if (!(window as any).electron?.spotify) {
    console.error('[SpotifyAuth] Electron Spotify OAuth bridge not available');
    return () => {};
  }

  console.log('[SpotifyAuth] Setting up Electron OAuth listener');
  const removeListener = (window as any).electron.spotify.onOAuthCallback((url: string) => {
    console.log('[SpotifyAuth] Electron OAuth callback received:', url);
    onCallback(url);
  });

  return removeListener;
};

/**
 * Setup app URL listener for OAuth callback
 * Should be called on app initialization
 * Automatically removes previous listener to prevent accumulation
 */
export const setupAuthListener = async (
  onCallback: (code: string, state: string) => void
): Promise<{ remove: () => void }> => {
  console.log('[SpotifyAuth] Setting up OAuth callback listener');
  
  // Remove existing listener if present
  if (currentAuthListener) {
    console.log('[SpotifyAuth] Removing previous auth listener to prevent accumulation');
    currentAuthListener.remove();
    currentAuthListener = null;
  }

  // Process OAuth callback URL (shared logic for all platforms)
  const processCallback = (callbackUrl: string) => {
    try {
      const url = new URL(callbackUrl);
      console.log('[SpotifyAuth] Parsed callback URL:', {
        protocol: url.protocol,
        host: url.host,
        pathname: url.pathname,
        search: url.search
      });
      
      // Check if this is our OAuth callback
      // Support multiple URL schemes for backward compatibility
      const isCallback = (
        (url.protocol === 'com.slideshowbuddy:' && url.host === 'callback') ||
        (url.protocol === 'slideshowbuddy:' && url.host === 'callback') ||
        (url.protocol === 'com.slideshowbuddy.app:' && url.host === 'callback')
      );
      
      if (isCallback) {
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        
        console.log('[SpotifyAuth] OAuth callback detected', {
          hasCode: !!code,
          hasState: !!state
        });
        
        if (code && state) {
          console.log('[SpotifyAuth] Invoking callback handler...');
          onCallback(code, state);
        } else {
          console.error('[SpotifyAuth] Missing code or state in callback URL');
        }
      } else {
        console.log('[SpotifyAuth] URL is not an OAuth callback');
      }
    } catch (error) {
      console.error('[SpotifyAuth] Error parsing callback URL:', error);
    }
  };
  
  // Platform-specific listener setup
  if (isMacOS()) {
    console.log('[SpotifyAuth] Setting up macOS Electron OAuth listener');
    const removeElectronListener = setupElectronAuthListener(processCallback);
    
    // Store cleanup function
    const cleanup = () => {
      console.log('[SpotifyAuth] Removing Electron auth listener');
      removeElectronListener();
      currentAuthListener = null;
    };
    
    const listener = { remove: cleanup };
    currentAuthListener = listener;
    console.log('[SpotifyAuth] Electron auth listener setup complete');
    
    return listener;
  } else {
    console.log('[SpotifyAuth] Setting up mobile OAuth listener');
    
    // Mobile implementation using Capacitor App listener
    const listener = await App.addListener('appUrlOpen', (data) => {
      console.log('[SpotifyAuth] App URL opened:', data.url);
      processCallback(data.url);
    });
    
    // Store listener reference for cleanup
    currentAuthListener = listener;
    console.log('[SpotifyAuth] Mobile auth listener setup complete');
    
    return listener;
  }
};

/**
 * Remove the current auth listener
 * Call this when you no longer need OAuth callback handling
 */
export const removeAuthListener = (): void => {
  if (currentAuthListener) {
    console.log('[SpotifyAuth] Removing auth listener');
    currentAuthListener.remove();
    currentAuthListener = null;
  }
};
