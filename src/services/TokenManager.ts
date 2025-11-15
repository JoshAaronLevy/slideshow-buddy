/**
 * TokenManager - Centralized token management with auto-refresh
 * Stage 6: Singleton pattern to replace scattered getAccessToken() calls
 * 
 * Features:
 * - In-memory token cache + Preferences persistence
 * - Auto-refresh 5 min before expiry (background timer)
 * - Guarantees valid tokens via getValidToken()
 * - Thread-safe refresh with mutex
 */

import { Preferences } from '@capacitor/preferences';
import lifecycleService from './LifecycleService';

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp (ms)
}

class TokenManager {
  private static instance: TokenManager;
  
  // In-memory cache
  private tokenData: TokenData | null = null;
  
  // Auto-refresh timer
  private refreshTimer: NodeJS.Timeout | null = null;
  
  // Lifecycle event handlers
  private backgroundHandler: (() => void) | null = null;
  private foregroundHandler: (() => void) | null = null;
  
  // Mutex for refresh operations
  private refreshPromise: Promise<string> | null = null;
  
  // Storage keys
  private readonly STORAGE_KEYS = {
    ACCESS_TOKEN: 'SPOTIFY_ACCESS_TOKEN',
    REFRESH_TOKEN: 'SPOTIFY_REFRESH_TOKEN',
    TOKEN_EXPIRY: 'SPOTIFY_TOKEN_EXPIRY',
  };
  
  // Constants
  private readonly REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes before expiry
  private readonly CHECK_INTERVAL_MS = 1 * 60 * 1000; // Check every 1 minute
  
  private constructor() {
    console.log('[TokenManager] Instance created');
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }
  
  /**
   * Initialize TokenManager - load tokens from Preferences
   * Call this on app start (App.tsx)
   */
  public async initialize(): Promise<void> {
    console.log('[TokenManager] Initializing...');
    
    try {
      const [accessTokenResult, refreshTokenResult, expiryResult] = await Promise.all([
        Preferences.get({ key: this.STORAGE_KEYS.ACCESS_TOKEN }),
        Preferences.get({ key: this.STORAGE_KEYS.REFRESH_TOKEN }),
        Preferences.get({ key: this.STORAGE_KEYS.TOKEN_EXPIRY }),
      ]);
      
      const accessToken = accessTokenResult.value;
      const refreshToken = refreshTokenResult.value;
      const expiryStr = expiryResult.value;
      
      if (accessToken && refreshToken && expiryStr) {
        const expiresAt = parseInt(expiryStr, 10);
        
        this.tokenData = {
          accessToken,
          refreshToken,
          expiresAt,
        };
        
        const now = Date.now();
        const isExpired = expiresAt <= now;
        const timeUntilExpiry = Math.floor((expiresAt - now) / 1000 / 60);
        
        console.log('[TokenManager] Loaded tokens from storage', {
          hasAccessToken: true,
          hasRefreshToken: true,
          expiresAt: new Date(expiresAt).toISOString(),
          isExpired,
          timeUntilExpiryMinutes: timeUntilExpiry,
        });
        
        // Start auto-refresh timer
        this.startAutoRefresh();
      } else {
        console.log('[TokenManager] No tokens found in storage');
      }
    } catch (error) {
      console.error('[TokenManager] Error initializing:', error);
      throw error;
    }
  }
  
  /**
   * Get a valid access token
   * Auto-refreshes if expired or near expiry
   * Thread-safe - multiple simultaneous calls will reuse the same refresh
   */
  public async getValidToken(): Promise<string> {
    // If refresh is already in progress, wait for it
    if (this.refreshPromise) {
      console.log('[TokenManager] Refresh in progress, waiting...');
      return this.refreshPromise;
    }
    
    // Check if we have a token
    if (!this.tokenData) {
      console.error('[TokenManager] No token data available');
      throw new Error('No access token available. Please log in.');
    }
    
    const now = Date.now();
    const { accessToken, expiresAt } = this.tokenData;
    
    // Check if token is expired or will expire soon
    const isExpired = expiresAt <= now;
    const willExpireSoon = expiresAt - now < this.REFRESH_BUFFER_MS;
    
    if (isExpired || willExpireSoon) {
      const timeUntilExpiry = Math.floor((expiresAt - now) / 1000 / 60);
      console.log('[TokenManager] Token needs refresh', {
        isExpired,
        willExpireSoon,
        timeUntilExpiryMinutes: timeUntilExpiry,
      });
      
      // Trigger refresh (with mutex)
      this.refreshPromise = this.performRefresh();
      
      try {
        const newToken = await this.refreshPromise;
        return newToken;
      } finally {
        this.refreshPromise = null;
      }
    }
    
    // Token is still valid
    console.log('[TokenManager] Returning cached token', {
      expiresAt: new Date(expiresAt).toISOString(),
      timeUntilExpiryMinutes: Math.floor((expiresAt - now) / 1000 / 60),
    });
    
    return accessToken;
  }
  
  /**
   * Set tokens (after OAuth exchange or refresh)
   * Updates memory + Preferences
   */
  public async setTokens(
    accessToken: string,
    refreshToken: string,
    expiresInSeconds: number
  ): Promise<void> {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    
    console.log('[TokenManager] Setting tokens', {
      expiresInSeconds,
      expiresAt: new Date(expiresAt).toISOString(),
    });
    
    // Update memory
    this.tokenData = {
      accessToken,
      refreshToken,
      expiresAt,
    };
    
    // Persist to storage
    await Promise.all([
      Preferences.set({ key: this.STORAGE_KEYS.ACCESS_TOKEN, value: accessToken }),
      Preferences.set({ key: this.STORAGE_KEYS.REFRESH_TOKEN, value: refreshToken }),
      Preferences.set({ key: this.STORAGE_KEYS.TOKEN_EXPIRY, value: expiresAt.toString() }),
    ]);
    
    console.log('[TokenManager] Tokens saved to storage');
    
    // Restart auto-refresh timer
    this.startAutoRefresh();
  }
  
  /**
   * Clear tokens (on logout)
   * Clears memory + Preferences + stops timer
   */
  public async clearTokens(): Promise<void> {
    console.log('[TokenManager] Clearing tokens');
    
    // Clear memory
    this.tokenData = null;
    
    // Stop auto-refresh
    this.stopAutoRefresh();
    
    // Clear storage
    await Promise.all([
      Preferences.remove({ key: this.STORAGE_KEYS.ACCESS_TOKEN }),
      Preferences.remove({ key: this.STORAGE_KEYS.REFRESH_TOKEN }),
      Preferences.remove({ key: this.STORAGE_KEYS.TOKEN_EXPIRY }),
    ]);
    
    console.log('[TokenManager] Tokens cleared from storage');
  }
  
  /**
   * Start auto-refresh timer
   * Checks every minute if token needs refresh
   * Also sets up app state listener to pause when backgrounded
   */
  private startAutoRefresh(): void {
    // Clear existing timer
    this.stopAutoRefresh();
    
    console.log('[TokenManager] Starting auto-refresh timer', {
      checkIntervalMinutes: this.CHECK_INTERVAL_MS / 1000 / 60,
      refreshBufferMinutes: this.REFRESH_BUFFER_MS / 1000 / 60,
    });
    
    this.refreshTimer = setInterval(() => {
      this.checkAndRefresh();
    }, this.CHECK_INTERVAL_MS);
    
    // Setup app state listener to pause/resume refresh
    this.setupAppStateListener();
  }
  
  /**
   * Stop auto-refresh timer
   */
  private stopAutoRefresh(): void {
    if (this.refreshTimer) {
      console.log('[TokenManager] Stopping auto-refresh timer');
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    
    // Remove app state listener
    this.removeAppStateListener();
  }
  
  /**
   * Check if token needs refresh and trigger if needed
   * Called by auto-refresh timer
   */
  private async checkAndRefresh(): Promise<void> {
    if (!this.tokenData) {
      return;
    }
    
    const now = Date.now();
    const { expiresAt } = this.tokenData;
    const willExpireSoon = expiresAt - now < this.REFRESH_BUFFER_MS;
    
    if (willExpireSoon) {
      const timeUntilExpiry = Math.floor((expiresAt - now) / 1000 / 60);
      console.log('[TokenManager] Auto-refresh triggered', {
        timeUntilExpiryMinutes: timeUntilExpiry,
      });
      
      try {
        await this.getValidToken(); // This will trigger refresh
      } catch (error) {
        console.error('[TokenManager] Auto-refresh failed:', error);
      }
    }
  }
  
  /**
   * Setup lifecycle listeners to pause/resume refresh based on app state
   */
  private setupAppStateListener(): void {
    // Remove existing listeners if any
    this.removeAppStateListener();
    
    console.log('[TokenManager] Setting up lifecycle listeners');
    
    this.backgroundHandler = () => {
      console.log('[TokenManager] App backgrounded - pausing auto-refresh');
      this.pauseAutoRefresh();
    };
    
    this.foregroundHandler = () => {
      console.log('[TokenManager] App foregrounded - resuming auto-refresh');
      this.startAutoRefresh();
    };
    
    lifecycleService.on('background', this.backgroundHandler);
    lifecycleService.on('foreground', this.foregroundHandler);
  }
  
  /**
   * Pause auto-refresh (called when app backgrounds)
   */
  private pauseAutoRefresh(): void {
    console.log('[TokenManager] Pausing auto-refresh');
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
  
  /**
   * Remove lifecycle listeners
   */
  private removeAppStateListener(): void {
    if (this.backgroundHandler) {
      console.log('[TokenManager] Removing lifecycle listeners');
      lifecycleService.off('background', this.backgroundHandler);
      this.backgroundHandler = null;
    }
    
    if (this.foregroundHandler) {
      lifecycleService.off('foreground', this.foregroundHandler);
      this.foregroundHandler = null;
    }
  }
  
  /**
   * Cleanup method - stops timers and removes listeners
   * Call this when app is shutting down or user logs out
   */
  public cleanup(): void {
    console.log('[TokenManager] Cleanup called');
    this.stopAutoRefresh();
  }
  
  /**
   * Perform actual token refresh
   * Calls backend /auth/spotify/refresh endpoint
   */
  private async performRefresh(): Promise<string> {
    if (!this.tokenData) {
      throw new Error('No refresh token available');
    }
    
    const { refreshToken } = this.tokenData;
    
    console.log('[TokenManager] Performing token refresh...');
    
    try {
      const response = await fetch('https://slideshow-buddy-server.onrender.com/auth/spotify/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[TokenManager] Refresh failed', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.access_token) {
        console.error('[TokenManager] Invalid refresh response - no access_token');
        throw new Error('Invalid token refresh response');
      }
      
      // Update tokens
      await this.setTokens(
        data.access_token,
        data.refresh_token || refreshToken, // Use new refresh token if provided
        data.expires_in || 3600
      );
      
      console.log('[TokenManager] Token refreshed successfully', {
        expiresInSeconds: data.expires_in,
      });
      
      return data.access_token;
    } catch (error) {
      console.error('[TokenManager] Error refreshing token:', error);
      throw error;
    }
  }
}

export default TokenManager;
