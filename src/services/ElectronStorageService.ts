/**
 * ElectronStorageService - Electron-specific storage using electron-store
 * Provides same API as Capacitor Preferences for compatibility
 */

// Extend window interface for ElectronStorageService
declare global {
  interface Window {
    electron?: {
      storage?: {
        get: (key: string) => Promise<any>;
        set: (key: string, value: any) => Promise<void>;
        remove: (key: string) => Promise<void>;
        clear: () => Promise<void>;
      };
    };
  }
}

class ElectronStorageService {
  /**
   * Get a value from storage
   * Matches Capacitor Preferences.get() API
   */
  async get(options: { key: string }): Promise<{ value: string | null }> {
    try {
      if (!window.electron?.storage) {
        console.warn('Electron storage not available');
        return { value: null };
      }
      
      const value = await window.electron.storage.get(options.key);
      return { value: value || null };
    } catch (error) {
      console.error('[ElectronStorage] Get error:', error);
      return { value: null };
    }
  }

  /**
   * Set a value in storage
   * Matches Capacitor Preferences.set() API
   */
  async set(options: { key: string; value: string }): Promise<void> {
    try {
      if (!window.electron?.storage) {
        console.warn('Electron storage not available');
        return;
      }
      
      await window.electron.storage.set(options.key, options.value);
    } catch (error) {
      console.error('[ElectronStorage] Set error:', error);
    }
  }

  /**
   * Remove a value from storage
   * Matches Capacitor Preferences.remove() API
   */
  async remove(options: { key: string }): Promise<void> {
    try {
      if (!window.electron?.storage) {
        console.warn('Electron storage not available');
        return;
      }
      
      await window.electron.storage.remove(options.key);
    } catch (error) {
      console.error('[ElectronStorage] Remove error:', error);
    }
  }

  /**
   * Clear all storage
   */
  async clear(): Promise<void> {
    try {
      if (!window.electron?.storage) {
        console.warn('Electron storage not available');
        return;
      }
      
      await window.electron.storage.clear();
    } catch (error) {
      console.error('[ElectronStorage] Clear error:', error);
    }
  }
}

export default new ElectronStorageService();