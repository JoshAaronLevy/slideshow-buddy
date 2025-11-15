import type { CapacitorElectronConfig } from '@capacitor-community/electron';
import { getCapacitorElectronConfig, setupElectronDeepLinking } from '@capacitor-community/electron';
import type { MenuItemConstructorOptions } from 'electron';
import { app, MenuItem, ipcMain, powerSaveBlocker, nativeTheme } from 'electron';
import electronIsDev from 'electron-is-dev';
import unhandled from 'electron-unhandled';
import { autoUpdater } from 'electron-updater';
import Store from 'electron-store';
import * as keytar from 'keytar';

import { ElectronCapacitorApp, setupContentSecurityPolicy, setupReloadWatcher } from './setup';
import { photosLibraryFFI } from './native/PhotosLibraryFFI';
import { createMenu, updateMenuState } from './menu';

// Graceful handling of unhandled errors.
unhandled();

// Register custom protocol for OAuth callbacks
// This must be done before app.whenReady() to ensure proper registration
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('com.slideshowbuddy', process.execPath, [process.argv[1]]);
  }
} else {
  app.setAsDefaultProtocolClient('com.slideshowbuddy');
}

// Define our menu templates (these are optional)
const trayMenuTemplate: (MenuItemConstructorOptions | MenuItem)[] = [new MenuItem({ label: 'Quit App', role: 'quit' })];

// Get Config options from capacitor.config
const capacitorFileConfig: CapacitorElectronConfig = getCapacitorElectronConfig();

// Initialize our app. We'll set up the custom menu after app initialization.
const myCapacitorApp = new ElectronCapacitorApp(capacitorFileConfig, trayMenuTemplate);

// If deeplinking is enabled then we will set it up here.
if (capacitorFileConfig.electron?.deepLinkingEnabled) {
  setupElectronDeepLinking(myCapacitorApp, {
    customProtocol: capacitorFileConfig.electron.deepLinkingCustomProtocol ?? 'mycapacitorapp',
  });
}

// If we are in Dev mode, use the file watcher components.
if (electronIsDev) {
  setupReloadWatcher(myCapacitorApp);
}

// Run Application
(async () => {
  // Wait for electron app to be ready.
  await app.whenReady();
  // Security - Set Content-Security-Policy based on whether or not we are in dev mode.
  setupContentSecurityPolicy(myCapacitorApp.getCustomURLScheme());
  // Initialize our app, build windows, and load content.
  await myCapacitorApp.init();
  // Check for updates if we are in a packaged app.
  autoUpdater.checkForUpdatesAndNotify();
})();

// Handle when all of our windows are close (platforms have their own expectations).
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// When the dock icon is clicked.
app.on('activate', async function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (myCapacitorApp.getMainWindow().isDestroyed()) {
    await myCapacitorApp.init();
  }
});

// Place all ipc or other electron api calls and custom functionality under this line

// System Theme Integration
function updateTheme() {
  const mainWindow = myCapacitorApp.getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    const isDark = nativeTheme.shouldUseDarkColors;
    mainWindow.webContents.send('theme-changed', isDark ? 'dark' : 'light');
    
    // Update window background color based on theme
    if (process.platform === 'darwin') {
      mainWindow.setBackgroundColor(isDark ? '#1c1c1e' : '#ffffff');
    }
  }
}

// Listen for system theme changes
nativeTheme.on('updated', updateTheme);

// macOS-specific window configuration after initialization
const originalInit = myCapacitorApp.init;
myCapacitorApp.init = async function(...args) {
  const result = await originalInit.apply(this, args);
  
  // Set up macOS-specific window features
  if (process.platform === 'darwin') {
    const mainWindow = myCapacitorApp.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      // Create macOS menu bar
      createMenu(mainWindow);
      
      // Enable traffic light buttons
      mainWindow.setWindowButtonVisibility(true);
      // Set initial theme
      updateTheme();
    }
  }
  
  // Send any pending OAuth callback after window is ready
  if (pendingOAuthCallback) {
    const mainWindow = myCapacitorApp.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send('spotify:oauth-callback', pendingOAuthCallback);
      mainWindow.show();
      mainWindow.focus();
      console.log('Pending OAuth callback sent to renderer:', pendingOAuthCallback);
    }
    pendingOAuthCallback = null;
  }
  
  return result;
};

// PowerSave Blocker for slideshow keep-awake functionality
let powerSaveBlockerId: number | null = null;

// Spotify OAuth Callback Handling
// Store pending OAuth callback URL in case window isn't ready yet
let pendingOAuthCallback: string | null = null;

/**
 * Handle OAuth callback URLs from com.slideshowbuddy://callback
 * This is triggered when user completes OAuth flow in browser
 */
app.on('open-url', (event, url) => {
  event.preventDefault();
  console.log('OAuth callback received:', url);
  
  // Check if this is a Spotify OAuth callback
  if (url.startsWith('com.slideshowbuddy://callback')) {
    const mainWindow = myCapacitorApp.getMainWindow();
    
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      // Send callback immediately if window is ready
      mainWindow.webContents.send('spotify:oauth-callback', url);
      mainWindow.show();
      mainWindow.focus();
      console.log('OAuth callback sent to renderer:', url);
    } else {
      // Store callback for when window becomes ready
      pendingOAuthCallback = url;
      console.log('OAuth callback queued - window not ready yet');
    }
  }
});

// Window Management IPC Handlers

/**
 * Set window title dynamically
 * Returns: { success: boolean, message?: string, error?: string }
 */
ipcMain.handle('window:set-title', async (event, title: string) => {
  try {
    const mainWindow = myCapacitorApp.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setTitle(title || 'Slideshow Buddy');
      return { success: true, message: 'Window title updated successfully' };
    }
    return { success: false, error: 'Main window not available' };
  } catch (error) {
    console.error('Failed to set window title:', error);
    return {
      success: false,
      error: error.message || 'Failed to set window title'
    };
  }
});

/**
 * Get current system theme
 * Returns: { success: boolean, theme?: string, error?: string }
 */
ipcMain.handle('system:get-theme', async () => {
  try {
    const isDark = nativeTheme.shouldUseDarkColors;
    return { success: true, theme: isDark ? 'dark' : 'light' };
  } catch (error) {
    console.error('Failed to get system theme:', error);
    return {
      success: false,
      error: error.message || 'Failed to get system theme'
    };
  }
});

// Photos Library IPC Handlers
// These handlers bridge the renderer process to the native Swift Photos library via FFI

/**
 * Request permission to access the Photos library
 * Returns: { success: boolean, hasPermission?: boolean, error?: string }
 */
ipcMain.handle('photos:requestPermission', async () => {
  if (process.platform !== 'darwin') {
    return { success: false, error: 'Photos library only available on macOS' };
  }

  try {
    if (!photosLibraryFFI.isReady()) {
      return { success: false, error: 'Photos library FFI not initialized' };
    }
    
    const hasPermission = await photosLibraryFFI.requestPermission();
    return { success: true, hasPermission };
  } catch (error) {
    console.error('Photos permission request failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to request Photos library permission'
    };
  }
});

/**
 * Check current Photos library permission status
 * Returns: { success: boolean, hasPermission?: boolean, error?: string }
 */
ipcMain.handle('photos:checkPermission', async () => {
  if (process.platform !== 'darwin') {
    return { success: false, error: 'Photos library only available on macOS' };
  }

  try {
    if (!photosLibraryFFI.isReady()) {
      return { success: false, error: 'Photos library FFI not initialized' };
    }
    
    const hasPermission = photosLibraryFFI.checkPermission();
    return { success: true, hasPermission };
  } catch (error) {
    console.error('Photos permission check failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to check Photos library permission'
    };
  }
});

/**
 * Get list of photo albums from the library
 * Returns: { success: boolean, albums?: PhotoAlbum[], error?: string }
 */
ipcMain.handle('photos:getAlbums', async () => {
  if (process.platform !== 'darwin') {
    return { success: false, error: 'Photos library only available on macOS' };
  }

  try {
    if (!photosLibraryFFI.isReady()) {
      return { success: false, error: 'Photos library FFI not initialized' };
    }
    
    const albums = await photosLibraryFFI.getAlbums();
    return { success: true, albums };
  } catch (error) {
    console.error('Failed to get photo albums:', error);
    return {
      success: false,
      error: error.message || 'Failed to retrieve photo albums'
    };
  }
});

// Slideshow Keep-Awake IPC Handlers
// These handlers manage the powerSaveBlocker to prevent display sleep during slideshows

/**
 * Start power save blocker to prevent display sleep during slideshow
 * Returns: { success: boolean, blockerId?: number, message?: string, error?: string }
 */
ipcMain.handle('slideshow:keep-awake-start', async () => {
  try {
    if (powerSaveBlockerId !== null) {
      return {
        success: true,
        blockerId: powerSaveBlockerId,
        message: 'Power save blocker already active'
      };
    }
    
    powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');
    console.log('PowerSave blocker started with ID:', powerSaveBlockerId);
    
    return {
      success: true,
      blockerId: powerSaveBlockerId,
      message: 'Display sleep prevented successfully'
    };
  } catch (error) {
    console.error('Failed to start power save blocker:', error);
    return {
      success: false,
      error: error.message || 'Failed to prevent display sleep'
    };
  }
});

/**
 * Stop power save blocker to allow display sleep after slideshow
 * Returns: { success: boolean, message?: string, error?: string }
 */
ipcMain.handle('slideshow:keep-awake-stop', async () => {
  try {
    if (powerSaveBlockerId !== null) {
      powerSaveBlocker.stop(powerSaveBlockerId);
      console.log('PowerSave blocker stopped for ID:', powerSaveBlockerId);
      powerSaveBlockerId = null;
      
      return {
        success: true,
        message: 'Display sleep allowed successfully'
      };
    }
    
    return {
      success: true,
      message: 'Power save blocker was not active'
    };
  } catch (error) {
    console.error('Failed to stop power save blocker:', error);
    // Still set to null to avoid zombie blockers
    powerSaveBlockerId = null;
    return {
      success: false,
      error: error.message || 'Failed to allow display sleep'
    };
  }
});

// Cleanup powerSaveBlocker when app is quitting
app.on('before-quit', () => {
  if (powerSaveBlockerId !== null) {
    try {
      powerSaveBlocker.stop(powerSaveBlockerId);
      console.log('PowerSave blocker cleaned up on app quit');
      powerSaveBlockerId = null;
    } catch (error) {
      console.error('Failed to cleanup power save blocker on quit:', error);
    }
  }
});

/**
 * Get photos from a specific album or all photos
 * Params: { albumId?: string, quantity?: number }
 * Returns: { success: boolean, photos?: Photo[], error?: string }
 */
ipcMain.handle('photos:getPhotos', async (event, params: { albumId?: string; quantity?: number } = {}) => {
  if (process.platform !== 'darwin') {
    return { success: false, error: 'Photos library only available on macOS' };
  }

  try {
    if (!photosLibraryFFI.isReady()) {
      return { success: false, error: 'Photos library FFI not initialized' };
    }
    
    const { albumId, quantity = 50 } = params;
    const photos = await photosLibraryFFI.getPhotos(albumId, quantity);
    return { success: true, photos };
  } catch (error) {
    console.error('Failed to get photos:', error);
    return {
      success: false,
      error: error.message || 'Failed to retrieve photos'
    };
  }
});

// Menu State Management IPC Handlers
// These handlers allow the renderer to update menu item states based on application context

/**
 * Update menu item states based on current application state
 * Params: { hasSlideshow?: boolean, isPlaying?: boolean, canExport?: boolean }
 * Returns: { success: boolean, message?: string, error?: string }
 */
ipcMain.handle('menu:update-state', async (event, state: { hasSlideshow?: boolean; isPlaying?: boolean; canExport?: boolean }) => {
  try {
    if (process.platform === 'darwin') {
      updateMenuState(state);
      return { success: true, message: 'Menu state updated successfully' };
    }
    return { success: true, message: 'Menu not available on this platform' };
  } catch (error) {
    console.error('Failed to update menu state:', error);
    return {
      success: false,
      error: error.message || 'Failed to update menu state'
    };
  }
});

// Storage Management using electron-store
// Initialize electron-store with encryption for security
const store = new Store({
  name: 'slideshow-buddy-data',
  encryptionKey: 'slideshow-buddy-secure-key-2024', // Optional encryption for sensitive data
  cwd: electronIsDev ? undefined : app.getPath('userData') // Use app data directory in production
});

// Storage IPC Handlers
// These handlers bridge the renderer process to electron-store for persistent storage

/**
 * Get a value from storage
 * Params: key (string)
 * Returns: any (the stored value or undefined if not found)
 */
ipcMain.handle('storage:get', async (event, key: string) => {
  try {
    const value = (store as any).get(key);
    console.log(`[Storage] Get ${key}:`, value !== undefined ? 'found' : 'not found');
    return value;
  } catch (error) {
    console.error(`[Storage] Error getting ${key}:`, error);
    return undefined;
  }
});

/**
 * Set a value in storage
 * Params: key (string), value (any)
 * Returns: void
 */
ipcMain.handle('storage:set', async (event, key: string, value: any) => {
  try {
    (store as any).set(key, value);
    console.log(`[Storage] Set ${key}: success`);
  } catch (error) {
    console.error(`[Storage] Error setting ${key}:`, error);
    throw error;
  }
});

/**
 * Remove a value from storage
 * Params: key (string)
 * Returns: void
 */
ipcMain.handle('storage:remove', async (event, key: string) => {
  try {
    (store as any).delete(key);
    console.log(`[Storage] Removed ${key}: success`);
  } catch (error) {
    console.error(`[Storage] Error removing ${key}:`, error);
    throw error;
  }
});

/**
 * Clear all storage
 * Returns: void
 */
ipcMain.handle('storage:clear', async () => {
  try {
    (store as any).clear();
    console.log('[Storage] Clear: success');
  } catch (error) {
    console.error('[Storage] Error clearing storage:', error);
    throw error;
  }
});

// Keychain Management using keytar for secure token storage on macOS
// Service name for all keychain entries
const SERVICE_NAME = 'Slideshow Buddy';

/**
 * Get a password from macOS Keychain
 * Params: account (string) - the account identifier for the password
 * Returns: string | null (the password or null if not found)
 */
ipcMain.handle('keychain:getPassword', async (event, account: string) => {
  try {
    if (process.platform !== 'darwin') {
      console.log('[Keychain] Not on macOS, keychain not available');
      return null;
    }
    
    const password = await keytar.getPassword(SERVICE_NAME, account);
    console.log(`[Keychain] Get ${account}:`, password !== null ? 'found' : 'not found');
    return password;
  } catch (error) {
    console.error(`[Keychain] Error getting password for ${account}:`, error);
    return null;
  }
});

/**
 * Set a password in macOS Keychain
 * Params: account (string), password (string)
 * Returns: boolean (success status)
 */
ipcMain.handle('keychain:setPassword', async (event, account: string, password: string) => {
  try {
    if (process.platform !== 'darwin') {
      console.log('[Keychain] Not on macOS, keychain not available');
      return false;
    }
    
    await keytar.setPassword(SERVICE_NAME, account, password);
    console.log(`[Keychain] Set ${account}: success`);
    return true;
  } catch (error) {
    console.error(`[Keychain] Error setting password for ${account}:`, error);
    return false;
  }
});

/**
 * Delete a password from macOS Keychain
 * Params: account (string)
 * Returns: boolean (success status)
 */
ipcMain.handle('keychain:deletePassword', async (event, account: string) => {
  try {
    if (process.platform !== 'darwin') {
      console.log('[Keychain] Not on macOS, keychain not available');
      return false;
    }
    
    const deleted = await keytar.deletePassword(SERVICE_NAME, account);
    console.log(`[Keychain] Delete ${account}:`, deleted ? 'success' : 'not found');
    return deleted;
  } catch (error) {
    console.error(`[Keychain] Error deleting password for ${account}:`, error);
    return false;
  }
});
