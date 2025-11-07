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

    // Open browser for authentication
    await Browser.open({ url: authUrl.toString() });
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

    // Store tokens securely
    await storeTokens(tokens);
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
  try {
    const { value: refreshToken } = await Preferences.get({
      key: STORAGE_KEYS.SPOTIFY_REFRESH_TOKEN,
    });

    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    
    console.log('[SpotifyAuth] Refreshing token via backend server...');
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
    return tokens;
  } catch (error) {
    console.error('Error refreshing Spotify token:', error);
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
 */
export const getAccessToken = async (): Promise<string | null> => {
  const { value } = await Preferences.get({ key: STORAGE_KEYS.SPOTIFY_ACCESS_TOKEN });
  return value;
};

/**
 * Check if the access token is expired
 */
export const isTokenExpired = async (): Promise<boolean> => {
  const { value } = await Preferences.get({ key: STORAGE_KEYS.SPOTIFY_TOKEN_EXPIRY });
  if (!value) return true;

  const expiresAt = parseInt(value, 10);
  // Consider expired if less than 5 minutes remaining
  return Date.now() >= expiresAt - 5 * 60 * 1000;
};

/**
 * Get current user profile from Spotify
 */
export const getCurrentUser = async (): Promise<SpotifyUser> => {
  console.log('[SpotifyAuth] Fetching current user profile...');
  
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('No access token available');
    }
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
 */
export const logout = async (): Promise<void> => {
  await Preferences.remove({ key: STORAGE_KEYS.SPOTIFY_ACCESS_TOKEN });
  await Preferences.remove({ key: STORAGE_KEYS.SPOTIFY_REFRESH_TOKEN });
  await Preferences.remove({ key: STORAGE_KEYS.SPOTIFY_TOKEN_EXPIRY });
  await Preferences.remove({ key: STORAGE_KEYS.SPOTIFY_USER });
};

/**
 * Check authentication status on app launch
 */
export const checkAuthStatus = async (): Promise<boolean> => {
  console.log('[SpotifyAuth] Checking authentication status...');
  
  const token = await getAccessToken();
  if (!token) {
    console.log('[SpotifyAuth] No access token found');
    return false;
  }
  console.log('[SpotifyAuth] Access token found');

  const expired = await isTokenExpired();
  console.log('[SpotifyAuth] Token expired:', expired);
  
  if (expired) {
    try {
      console.log('[SpotifyAuth] Attempting to refresh token...');
      await refreshAccessToken();
      console.log('[SpotifyAuth] Token refreshed successfully');
      return true;
    } catch (error) {
      console.error('[SpotifyAuth] Token refresh failed:', error);
      return false;
    }
  }

  console.log('[SpotifyAuth] Authentication status: valid');
  return true;
};

/**
 * Setup app URL listener for OAuth callback
 * Should be called on app initialization
 */
export const setupAuthListener = (onCallback: (code: string, state: string) => void): void => {
  console.log('[SpotifyAuth] Setting up app URL listener for OAuth callback');
  
  App.addListener('appUrlOpen', (data) => {
    console.log('[SpotifyAuth] App URL opened:', data.url);
    
    try {
      const url = new URL(data.url);
      console.log('[SpotifyAuth] Parsed URL:', {
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
      console.error('[SpotifyAuth] Error parsing app URL:', error);
    }
  });
};
