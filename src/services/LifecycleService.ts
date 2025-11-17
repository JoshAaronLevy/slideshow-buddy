/**
 * LifecycleService - Platform-agnostic app/window lifecycle events
 * 
 * Provides unified lifecycle events that work across:
 * - iOS/Android: Uses @capacitor/app appStateChange
 * - macOS Electron: Uses window focus/blur events
 * 
 * Events:
 * - 'active' - App/window is active and focused
 * - 'inactive' - App/window lost focus
 * - 'background' - App went to background (mobile) or minimized (desktop)
 * - 'foreground' - App returned from background/minimized
 */

import { App } from '@capacitor/app';
import { isMacOS } from '../utils/platform';

export type LifecycleEvent = 'active' | 'inactive' | 'background' | 'foreground';
export type LifecycleCallback = () => void;

class LifecycleService {
  private listeners: Map<LifecycleEvent, Set<LifecycleCallback>> = new Map();
  private initialized = false;
  
  // Platform-specific listener handles
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private appStateListener: any = null;
  private windowFocusHandler: (() => void) | null = null;
  private windowBlurHandler: (() => void) | null = null;
  private windowVisibilityHandler: (() => void) | null = null;

  /**
   * Initialize platform-specific lifecycle listeners
   * Called automatically on first listener registration
   */
  public init(): void {
    if (this.initialized) {
      console.log('[LifecycleService] Already initialized');
      return;
    }

    console.log('[LifecycleService] Initializing for platform:', isMacOS() ? 'macOS' : 'mobile');
    this.initialized = true;

    try {
      if (isMacOS()) {
        this.setupElectronListeners();
      } else {
        this.setupMobileListeners();
      }
    } catch (error) {
      console.error('[LifecycleService] Error during initialization:', error);
      // Don't throw - allow app to continue without lifecycle events
    }
  }

  /**
   * Set up Electron window event listeners
   */
  private setupElectronListeners(): void {
    console.log('[LifecycleService] Setting up Electron window listeners');

    // Window focus events
    this.windowFocusHandler = () => {
      console.log('[LifecycleService] Window focused');
      this.emit('active');
    };

    this.windowBlurHandler = () => {
      console.log('[LifecycleService] Window blurred');
      this.emit('inactive');
    };

    // Page visibility for minimize/restore detection
    this.windowVisibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        console.log('[LifecycleService] Window visible (restored)');
        this.emit('foreground');
      } else {
        console.log('[LifecycleService] Window hidden (minimized)');
        this.emit('background');
      }
    };

    // Add listeners
    window.addEventListener('focus', this.windowFocusHandler);
    window.addEventListener('blur', this.windowBlurHandler);
    document.addEventListener('visibilitychange', this.windowVisibilityHandler);
  }

  /**
   * Set up mobile app state listeners
   */
  private async setupMobileListeners(): Promise<void> {
    console.log('[LifecycleService] Setting up mobile app state listeners');

    try {
      this.appStateListener = await App.addListener('appStateChange', ({ isActive }) => {
        console.log('[LifecycleService] App state changed:', isActive ? 'ACTIVE' : 'BACKGROUND');
        
        if (isActive) {
          this.emit('active');
          this.emit('foreground');
        } else {
          this.emit('inactive');
          this.emit('background');
        }
      });
    } catch (error) {
      console.error('[LifecycleService] Error setting up mobile listeners:', error);
      // Continue without mobile listeners in case @capacitor/app is not available
    }
  }

  /**
   * Subscribe to lifecycle events
   * Automatically initializes service on first subscription
   */
  public on(event: LifecycleEvent, callback: LifecycleCallback): void {
    // Auto-initialize on first subscription
    if (!this.initialized) {
      this.init();
    }

    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(callback);
    console.log(`[LifecycleService] Subscription added for '${event}' (${this.listeners.get(event)!.size} total)`);
  }

  /**
   * Unsubscribe from lifecycle events
   */
  public off(event: LifecycleEvent, callback: LifecycleCallback): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
      console.log(`[LifecycleService] Subscription removed for '${event}' (${eventListeners.size} remaining)`);
      
      // Clean up empty event sets
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Remove all listeners for an event
   */
  public removeAllListeners(event?: LifecycleEvent): void {
    if (event) {
      this.listeners.delete(event);
      console.log(`[LifecycleService] All listeners removed for '${event}'`);
    } else {
      this.listeners.clear();
      console.log('[LifecycleService] All listeners removed');
    }
  }

  /**
   * Get current listener counts (for debugging)
   */
  public getListenerCounts(): Record<LifecycleEvent, number> {
    const result: Record<string, number> = {};
    for (const [event, listeners] of this.listeners.entries()) {
      result[event] = listeners.size;
    }
    return result as Record<LifecycleEvent, number>;
  }

  /**
   * Cleanup all platform listeners (useful for testing)
   */
  public cleanup(): void {
    console.log('[LifecycleService] Cleaning up platform listeners');

    // Remove mobile listeners
    if (this.appStateListener) {
      try {
        this.appStateListener.remove();
        this.appStateListener = null;
      } catch (error) {
        console.error('[LifecycleService] Error removing app state listener:', error);
      }
    }

    // Remove Electron listeners
    if (this.windowFocusHandler) {
      window.removeEventListener('focus', this.windowFocusHandler);
      this.windowFocusHandler = null;
    }

    if (this.windowBlurHandler) {
      window.removeEventListener('blur', this.windowBlurHandler);
      this.windowBlurHandler = null;
    }

    if (this.windowVisibilityHandler) {
      document.removeEventListener('visibilitychange', this.windowVisibilityHandler);
      this.windowVisibilityHandler = null;
    }

    // Clear all event listeners
    this.listeners.clear();
    this.initialized = false;
  }

  /**
   * Emit a lifecycle event to all subscribers
   */
  private emit(event: LifecycleEvent): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners && eventListeners.size > 0) {
      console.log(`[LifecycleService] Emitting '${event}' to ${eventListeners.size} listeners`);
      
      // Call all callbacks for this event
      eventListeners.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error(`[LifecycleService] Error in '${event}' callback:`, error);
        }
      });
    }
  }
}

// Export singleton instance
const lifecycleService = new LifecycleService();
export default lifecycleService;

// Export convenience functions for direct use
export const onLifecycleEvent = (event: LifecycleEvent, callback: LifecycleCallback) => {
  lifecycleService.on(event, callback);
};

export const offLifecycleEvent = (event: LifecycleEvent, callback: LifecycleCallback) => {
  lifecycleService.off(event, callback);
};

// Export initialization function for manual setup if needed
export const initializeLifecycleService = () => {
  lifecycleService.init();
};