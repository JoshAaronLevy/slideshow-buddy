/**
 * useSpotifyAuth Hook
 * 
 * React hook for Spotify OAuth with PKCE flow
 * Uses Capacitor Browser for system browser authentication
 * Handles deep link callback via App URL listener
 * 
 * @example
 * ```tsx
 * const { loginWithSpotify, status, error } = useSpotifyAuth({
 *   onSuccess: (tokens) => {
 *     console.log('Access token:', tokens.access_token);
 *     // TODO: Store tokens securely (e.g., Capacitor Preferences, secure storage)
 *   },
 *   onError: (error) => {
 *     console.error('Auth failed:', error);
 *   },
 * });
 * ```
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Browser } from '@capacitor/browser';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import {
  buildAuthUrl,
  exchangeCodeForTokens,
  verifyState,
  clearOAuthSession,
  SpotifyTokenResponse,
} from '../services/spotifyAuth';

/**
 * OAuth flow status
 */
type AuthStatus = 'idle' | 'pending' | 'exchanging' | 'success' | 'error';

/**
 * Hook configuration options
 */
interface UseSpotifyAuthOptions {
  /**
   * Called when OAuth flow completes successfully
   * @param tokens - Access token and optional refresh token
   * 
   * TODO: Implement token storage (e.g., Capacitor Preferences, secure storage)
   */
  onSuccess?: (tokens: SpotifyTokenResponse) => void;

  /**
   * Called when OAuth flow fails
   * @param error - Error object describing the failure
   */
  onError?: (error: Error) => void;
}

/**
 * Hook return value
 */
interface UseSpotifyAuthReturn {
  /**
   * Initiate Spotify OAuth login flow
   * Opens system browser for authentication
   */
  loginWithSpotify: () => Promise<void>;

  /**
   * Current status of the OAuth flow
   */
  status: AuthStatus;

  /**
   * Error message if flow failed
   */
  error: string | null;

  /**
   * Tokens received on success (also passed to onSuccess callback)
   * 
   * TODO: Consider removing this from state if tokens should only be handled via callback
   */
  tokens: SpotifyTokenResponse | null;
}

/**
 * Custom hook for Spotify OAuth with PKCE
 */
export const useSpotifyAuth = (options: UseSpotifyAuthOptions = {}): UseSpotifyAuthReturn => {
  const { onSuccess, onError } = options;

  const [status, setStatus] = useState<AuthStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<SpotifyTokenResponse | null>(null);

  // Track whether callback is being processed to prevent duplicate handling
  const isProcessingCallback = useRef(false);

  /**
   * Handle deep link callback from Spotify
   */
  const handleAppUrlOpen = useCallback(
    async (event: URLOpenListenerEvent) => {
      const url = event.url;

      // Check if this is our OAuth callback
      if (!url.startsWith('com.slideshowbuddy://callback')) {
        return;
      }

      // Prevent duplicate processing
      if (isProcessingCallback.current) {
        console.warn('Callback already being processed, ignoring duplicate');
        return;
      }

      isProcessingCallback.current = true;

      try {
        // Close the browser
        await Browser.close();

        // Parse URL parameters
        const urlObj = new URL(url);
        const code = urlObj.searchParams.get('code');
        const state = urlObj.searchParams.get('state');
        const errorParam = urlObj.searchParams.get('error');

        // Handle user denial or errors from Spotify
        if (errorParam) {
          throw new Error(`Spotify authorization failed: ${errorParam}`);
        }

        if (!code || !state) {
          throw new Error('Missing code or state parameter in callback URL');
        }

        // Verify state to prevent CSRF
        if (!verifyState(state)) {
          throw new Error('State verification failed. Possible CSRF attack or expired session.');
        }

        // Exchange authorization code for tokens
        setStatus('exchanging');
        const tokenResponse = await exchangeCodeForTokens(code);

        // Update state
        setStatus('success');
        setTokens(tokenResponse);
        setError(null);

        // Call success callback
        if (onSuccess) {
          onSuccess(tokenResponse);
        }

        // Clear OAuth session data
        clearOAuthSession();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error during OAuth';
        console.error('OAuth callback error:', err);

        setStatus('error');
        setError(errorMessage);
        setTokens(null);

        // Call error callback
        if (onError) {
          onError(err instanceof Error ? err : new Error(errorMessage));
        }

        // Clear OAuth session data
        clearOAuthSession();
      } finally {
        isProcessingCallback.current = false;
      }
    },
    [onSuccess, onError]
  );

  /**
   * Set up App URL listener on mount, clean up on unmount
   */
  useEffect(() => {
    let listenerHandle: Awaited<ReturnType<typeof App.addListener>> | null = null;

    const setupListener = async () => {
      listenerHandle = await App.addListener('appUrlOpen', handleAppUrlOpen);
    };

    setupListener();

    // Cleanup listener on unmount
    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, [handleAppUrlOpen]);

  /**
   * Initiate Spotify login flow
   */
  const loginWithSpotify = useCallback(async () => {
    // Reset state
    setStatus('pending');
    setError(null);
    setTokens(null);
    isProcessingCallback.current = false;

    try {
      // Build authorization URL
      const { url } = await buildAuthUrl();

      // Open Spotify authorization page in system browser
      await Browser.open({
        url,
        windowName: '_self',
      });

      // Note: Status remains 'pending' until callback is received
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start login';
      console.error('Login error:', err);

      setStatus('error');
      setError(errorMessage);

      if (onError) {
        onError(err instanceof Error ? err : new Error(errorMessage));
      }

      // Clear any partial OAuth session data
      clearOAuthSession();
    }
  }, [onError]);

  return {
    loginWithSpotify,
    status,
    error,
    tokens,
  };
};

export default useSpotifyAuth;
