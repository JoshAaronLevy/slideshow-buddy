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
  try {
    // Verify state to prevent CSRF
    const { value: storedState } = await Preferences.get({ key: 'spotify_state' });
    if (state !== storedState) {
      throw new Error('State mismatch - possible CSRF attack');
    }

    // Get code verifier
    const { value: codeVerifier } = await Preferences.get({ key: 'spotify_code_verifier' });
    if (!codeVerifier) {
      throw new Error('Code verifier not found');
    }

    // Exchange authorization code for tokens
    const response = await axios.post(
      SPOTIFY_CONFIG.TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: SPOTIFY_CONFIG.REDIRECT_URI,
        client_id: SPOTIFY_CONFIG.CLIENT_ID,
        code_verifier: codeVerifier,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const tokens: SpotifyTokens = {
      ...response.data,
      expires_at: Date.now() + response.data.expires_in * 1000,
    };

    // Store tokens securely
    await storeTokens(tokens);

    // Clean up temporary data
    await Preferences.remove({ key: 'spotify_code_verifier' });
    await Preferences.remove({ key: 'spotify_state' });

    return tokens;
  } catch (error) {
    console.error('Error handling Spotify callback:', error);
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

    const response = await axios.post(
      SPOTIFY_CONFIG.TOKEN_URL,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: SPOTIFY_CONFIG.CLIENT_ID,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
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
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('No access token available');
    }

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

    // Store user data
    await Preferences.set({
      key: STORAGE_KEYS.SPOTIFY_USER,
      value: JSON.stringify(user),
    });

    return user;
  } catch (error) {
    console.error('Error getting Spotify user:', error);
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
  const token = await getAccessToken();
  if (!token) return false;

  const expired = await isTokenExpired();
  if (expired) {
    try {
      await refreshAccessToken();
      return true;
    } catch {
      return false;
    }
  }

  return true;
};

/**
 * Setup app URL listener for OAuth callback
 * Should be called on app initialization
 */
export const setupAuthListener = (onCallback: (code: string, state: string) => void): void => {
  App.addListener('appUrlOpen', (data) => {
    const url = new URL(data.url);
    
    // Check if this is our OAuth callback
    if (url.protocol === 'slideshowbuddy:' && url.host === 'callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      
      if (code && state) {
        onCallback(code, state);
      }
    }
  });
};
