/**
 * Auth Store - Manages Spotify authentication state using Zustand
 */

import { create } from 'zustand';
import { SpotifyUser } from '../types';
import * as SpotifyAuthService from '../services/SpotifyAuthService';
import TokenManager from '../services/TokenManager';

interface AuthState {
  // State
  isAuthenticated: boolean;
  user: SpotifyUser | null;
  accessToken: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: () => Promise<void>;
  handleCallback: (code: string, state: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
  setError: (error: string | null) => void;
}

/**
 * Auth store with Zustand
 * Manages Spotify authentication state
 */
export const useAuthStore = create<AuthState>((set) => ({
  // Initial state
  isAuthenticated: false,
  user: null,
  accessToken: null,
  isLoading: false,
  error: null,

  /**
   * Start Spotify login flow
   */
  login: async () => {
    set({ isLoading: true, error: null });

    try {
      await SpotifyAuthService.login();
      // Note: Authentication completes in handleCallback
      // Just set loading to false here
      set({ isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start login';
      set({
        error: errorMessage,
        isLoading: false,
      });
    }
  },

  /**
   * Handle OAuth callback
   * Called when user is redirected back to app
   */
  handleCallback: async (code: string, state: string) => {
    console.log('[AuthStore] handleCallback invoked');
    set({ isLoading: true, error: null });

    try {
      // Exchange code for tokens
      console.log('[AuthStore] Exchanging code for tokens...');
      const tokens = await SpotifyAuthService.handleCallback(code, state);
      console.log('[AuthStore] Tokens received successfully');

      // Get user profile
      console.log('[AuthStore] Fetching user profile...');
      const user = await SpotifyAuthService.getCurrentUser();
      console.log('[AuthStore] User profile received:', user.display_name);

      set({
        isAuthenticated: true,
        user,
        accessToken: tokens.access_token,
        isLoading: false,
      });
      
      console.log('[AuthStore] Auth state updated - user is now authenticated');
    } catch (error) {
      console.error('[AuthStore] Error in handleCallback:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to complete authentication';
      set({
        error: errorMessage,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  },

  /**
   * Logout - clear tokens and user data
   */
  logout: async () => {
    set({ isLoading: true });

    try {
      await SpotifyAuthService.logout();

      set({
        isAuthenticated: false,
        user: null,
        accessToken: null,
        isLoading: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to logout';
      set({
        error: errorMessage,
        isLoading: false,
      });
    }
  },

  /**
   * Refresh access token
   */
  refreshToken: async () => {
    try {
      const tokens = await SpotifyAuthService.refreshAccessToken();
      set({ accessToken: tokens.access_token });
    } catch (error) {
      console.error('Failed to refresh token:', error);
      // If refresh fails, logout
      set({
        isAuthenticated: false,
        user: null,
        accessToken: null,
      });
    }
  },

  /**
   * Check authentication status
   * Should be called on app launch
   */
  checkAuthStatus: async () => {
    console.log('[AuthStore] checkAuthStatus called');
    set({ isLoading: true });

    try {
      const isAuthenticated = await SpotifyAuthService.checkAuthStatus();
      console.log('[AuthStore] Auth status check result:', isAuthenticated);

      if (isAuthenticated) {
        const user = await SpotifyAuthService.getStoredUser();
        // Stage 6: Get token from TokenManager for guaranteed freshness
        const accessToken = await TokenManager.getInstance().getValidToken();

        console.log('[AuthStore] User authenticated:', {
          hasUser: !!user,
          hasToken: !!accessToken,
          userName: user?.display_name
        });

        set({
          isAuthenticated: true,
          user,
          accessToken,
          isLoading: false,
        });
      } else {
        console.log('[AuthStore] User not authenticated');
        set({
          isAuthenticated: false,
          user: null,
          accessToken: null,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error('[AuthStore] Error checking auth status:', error);
      set({
        isAuthenticated: false,
        user: null,
        accessToken: null,
        isLoading: false,
      });
    }
  },

  /**
   * Set error message
   */
  setError: (error: string | null) => {
    set({ error });
  },
}));
