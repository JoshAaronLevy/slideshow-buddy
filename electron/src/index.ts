/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CapacitorElectronConfig } from '@capacitor-community/electron';
import { getCapacitorElectronConfig, setupElectronDeepLinking } from '@capacitor-community/electron';
import type { MenuItemConstructorOptions } from 'electron';
import { app, MenuItem, ipcMain, powerSaveBlocker, nativeTheme, dialog, shell } from 'electron';
import electronIsDev from 'electron-is-dev';
import unhandled from 'electron-unhandled';
import { autoUpdater } from 'electron-updater';
// electron-store will be dynamically imported to handle ESM compatibility
import * as keytar from 'keytar';
import * as fs from 'fs';
import * as path from 'path';

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
      
      // Log Photos library availability on startup (non-blocking)
      setTimeout(() => {
        logPhotosLibraryStatus();
      }, 1000);
    }
  }
  
  // Send any pending OAuth callback after window is ready
  if (pendingOAuthCallback) {
    const mainWindow = myCapacitorApp.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send('spotify:oauth-callback', pendingOAuthCallback);
      mainWindow.show();
      mainWindow.focus();
      // console.log('Pending OAuth callback sent to renderer:', pendingOAuthCallback);
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
 * Log Photos library status without making blocking calls
 * This is safe to call on startup
 */
function logPhotosLibraryStatus(): void {
  console.log('='.repeat(80));
  console.log('[Photos Library] Status Check (Non-Blocking)');
  console.log('[Photos Library] Platform:', process.platform);
  console.log('[Photos Library] Timestamp:', new Date().toISOString());
  
  if (process.platform !== 'darwin') {
    console.log('[Photos Library] ⚠️  Not on macOS - Photos library not available');
    console.log('='.repeat(80));
    return;
  }
  
  console.log('[Photos Library] ✓ Running on macOS');
  console.log('[Photos Library] FFI Ready:', photosLibraryFFI.isReady());
  
  if (!photosLibraryFFI.isReady()) {
    console.error('[Photos Library] ❌ FFI not initialized');
    console.error('[Photos Library] Swift library may not be loaded correctly');
    console.log('='.repeat(80));
    return;
  }
  
  console.log('[Photos Library] ✓ Swift FFI bridge is ready');
  console.log('[Photos Library] ℹ️  Permission will be requested when user accesses Photos');
  console.log('[Photos Library] ℹ️  Use IPC handler "photos:requestPermission" to request access');
  console.log('='.repeat(80));
}

/**
 * Check and request Photos library permission on app startup (macOS only)
 * This function is called after the app window is fully initialized
 * 
 * IMPORTANT: This function contains blocking FFI calls that use semaphores.
 * It should only be called via setImmediate() to avoid blocking the main thread.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function checkAndRequestPhotosPermission(): Promise<void> {
  console.log('='.repeat(80));
  console.log('[Photos Permission] Starting permission check on app startup');
  console.log('[Photos Permission] Platform:', process.platform);
  console.log('[Photos Permission] Timestamp:', new Date().toISOString());
  console.log('[Photos Permission] Running on setImmediate to avoid blocking main thread');
  
  try {
    // Verify FFI is ready
    if (!photosLibraryFFI.isReady()) {
      console.error('[Photos Permission] ❌ PhotosLibraryFFI is not initialized');
      console.error('[Photos Permission] Cannot proceed with permission check');
      console.error('[Photos Permission] This is non-fatal - app will use file browser');
      console.log('='.repeat(80));
      return;
    }
    
    console.log('[Photos Permission] ✓ PhotosLibraryFFI is initialized and ready');
    
    // Step 1: Check current permission status
    console.log('[Photos Permission] Step 1: Checking current permission status...');
    console.log('[Photos Permission] Note: This call uses a blocking semaphore in Swift');
    let hasPermission = false;
    
    try {
      // Wrap in a timeout to prevent infinite hang
      const checkPromise = new Promise<boolean>((resolve, reject) => {
        try {
          const result = photosLibraryFFI.checkPermission();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        setTimeout(() => reject(new Error('Permission check timed out after 5 seconds')), 5000);
      });
      
      hasPermission = await Promise.race([checkPromise, timeoutPromise]);
      console.log('[Photos Permission] Current permission status:', hasPermission ? '✓ GRANTED' : '✗ NOT GRANTED');
    } catch (error) {
      console.error('[Photos Permission] ❌ Error checking permission:', error);
      console.error('[Photos Permission] This is non-fatal - app will continue without Photos access');
      console.log('='.repeat(80));
      return;
    }
    
    // Step 2: If permission already granted, we're done
    if (hasPermission) {
      console.log('[Photos Permission] ✓ Permission already granted');
      console.log('[Photos Permission] ✓ App has access to Photos library');
      console.log('[Photos Permission] No action needed');
      console.log('='.repeat(80));
      return;
    }
    
    // Step 3: Permission not granted, request it
    console.log('[Photos Permission] Step 2: Permission not granted, requesting permission...');
    console.log('[Photos Permission] System alert will be shown to user');
    console.log('[Photos Permission] Waiting for user response (with 30 second timeout)...');
    
    try {
      // Add timeout for permission request as well (user might not respond)
      const requestPromise = photosLibraryFFI.requestPermission();
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        setTimeout(() => reject(new Error('Permission request timed out after 30 seconds')), 30000);
      });
      
      const permissionGranted = await Promise.race([requestPromise, timeoutPromise]);
      
      console.log('[Photos Permission] User responded to permission request');
      console.log('[Photos Permission] Permission granted:', permissionGranted ? '✓ YES' : '✗ NO');
      
      if (permissionGranted) {
        console.log('[Photos Permission] ✓✓✓ SUCCESS ✓✓✓');
        console.log('[Photos Permission] App now has access to Photos library');
        console.log('[Photos Permission] Photos can be accessed via PhotoKit APIs');
      } else {
        console.log('[Photos Permission] ⚠️  Permission denied by user');
        console.log('[Photos Permission] App will fall back to file browser for photo selection');
        console.log('[Photos Permission] User can grant permission later in System Settings > Privacy & Security > Photos');
      }
    } catch (error) {
      console.error('[Photos Permission] ❌ Error requesting permission:', error);
      console.error('[Photos Permission] Error details:', error.message);
      if (error.stack) {
        console.error('[Photos Permission] Error stack:', error.stack);
      }
      console.error('[Photos Permission] This is non-fatal - app will continue without Photos access');
    }
    
  } catch (error) {
    console.error('[Photos Permission] ❌ Unexpected error in permission flow:', error);
    console.error('[Photos Permission] This is non-fatal - app will continue without Photos access');
  }
  
  console.log('[Photos Permission] Permission check completed');
  console.log('='.repeat(80));
}

/**
 * Handle OAuth callback URLs from com.slideshowbuddy://callback
 * This is triggered when user completes OAuth flow in browser
 */
app.on('open-url', (event, url) => {
  event.preventDefault();
  // console.log('[Electron Main] OAuth callback received:', url);
  // console.log('[Electron Main] URL details:', {
  //   length: url.length,
  //   startsWithExpected: url.startsWith('com.slideshowbuddy://callback'),
  //   hasQueryParams: url.includes('?'),
  // });
  
  // Check if this is a Spotify OAuth callback
  if (url.startsWith('com.slideshowbuddy://callback')) {
    // console.log('[Electron Main] Confirmed Spotify OAuth callback');
    const mainWindow = myCapacitorApp.getMainWindow();
    
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      // Send callback immediately if window is ready
      // console.log('[Electron Main] Sending callback to renderer via IPC');
      mainWindow.webContents.send('spotify:oauth-callback', url);
      mainWindow.show();
      mainWindow.focus();
      // console.log('[Electron Main] OAuth callback sent to renderer:', url);
    } else {
      // Store callback for when window becomes ready
      pendingOAuthCallback = url;
      // console.log('[Electron Main] OAuth callback queued - window not ready yet');
    }
  } else {
    // console.log('[Electron Main] URL does not match expected callback pattern');
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
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         [MAIN-PROCESS] photos:requestPermission IPC            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('[MAIN-PROCESS-IPC] Handler invoked');
  console.log('[MAIN-PROCESS-IPC] Timestamp:', new Date().toISOString());
  console.log('[MAIN-PROCESS-IPC] Process platform:', process.platform);
  console.log('[MAIN-PROCESS-IPC] Process version:', process.version);
  console.log('[MAIN-PROCESS-IPC] Electron version:', process.versions.electron);
  
  if (process.platform !== 'darwin') {
    console.error('[MAIN-PROCESS-IPC] ✗ Not running on macOS');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    return { success: false, error: 'Photos library only available on macOS' };
  }

  try {
    console.log('[MAIN-PROCESS-IPC] Step 1: Checking FFI initialization status...');
    console.log('[MAIN-PROCESS-IPC] FFI isReady():', photosLibraryFFI.isReady());
    
    if (!photosLibraryFFI.isReady()) {
      console.error('[MAIN-PROCESS-IPC] ✗ Photos library FFI not initialized');
      console.error('[MAIN-PROCESS-IPC] This means the Swift dylib failed to load');
      console.log('╚════════════════════════════════════════════════════════════════╝');
      return { success: false, error: 'Photos library FFI not initialized' };
    }
    
    console.log('[MAIN-PROCESS-IPC] ✓ FFI is ready');
    console.log('[MAIN-PROCESS-IPC] Step 2: Calling photosLibraryFFI.requestPermission()...');
    console.log('[MAIN-PROCESS-IPC] This will invoke Swift via koffi FFI bridge');
    
    const ffiStartTime = Date.now();
    const hasPermission = await photosLibraryFFI.requestPermission();
    const ffiDuration = Date.now() - ffiStartTime;
    
    console.log('[MAIN-PROCESS-IPC] ━━━ FFI call completed ━━━');
    console.log('[MAIN-PROCESS-IPC] Duration:', ffiDuration, 'ms');
    console.log('[MAIN-PROCESS-IPC] Result (hasPermission):', hasPermission);
    console.log('[MAIN-PROCESS-IPC] Result type:', typeof hasPermission);
    console.log('[MAIN-PROCESS-IPC] Returning success response to renderer');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    
    return { success: true, hasPermission };
  } catch (error) {
    console.error('[MAIN-PROCESS-IPC] ⚠️  Exception caught in IPC handler');
    console.error('[MAIN-PROCESS-IPC] Error:', error);
    console.error('[MAIN-PROCESS-IPC] Error message:', error.message);
    console.error('[MAIN-PROCESS-IPC] Error stack:', error.stack);
    console.log('╚════════════════════════════════════════════════════════════════╝');
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
  console.log('[IPC Main] photos:checkPermission called');
  if (process.platform !== 'darwin') {
    console.log('[IPC Main] Not on macOS, returning error');
    return { success: false, error: 'Photos library only available on macOS' };
  }

  try {
    if (!photosLibraryFFI.isReady()) {
      console.error('[IPC Main] PhotosLibraryFFI not ready');
      return { success: false, error: 'Photos library FFI not initialized' };
    }
    
    console.log('[IPC Main] Calling PhotosLibraryFFI.checkPermission()...');
    const hasPermission = photosLibraryFFI.checkPermission();
    console.log('[IPC Main] PhotosLibraryFFI.checkPermission result:', hasPermission);
    return { success: true, hasPermission };
  } catch (error) {
    console.error('[IPC Main] Error in photos:checkPermission:', error);
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
  console.log('[IPC Main] photos:getAlbums called');
  if (process.platform !== 'darwin') {
    console.log('[IPC Main] Not on macOS, returning error');
    return { success: false, error: 'Photos library only available on macOS' };
  }

  try {
    if (!photosLibraryFFI.isReady()) {
      console.error('[IPC Main] PhotosLibraryFFI not ready');
      return { success: false, error: 'Photos library FFI not initialized' };
    }
    
    console.log('[IPC Main] Calling PhotosLibraryFFI.getAlbums()...');
    const albums = await photosLibraryFFI.getAlbums();
    console.log('[IPC Main] PhotosLibraryFFI.getAlbums result:', albums ? `${albums.length} albums` : 'null/undefined');
    return { success: true, albums };
  } catch (error) {
    console.error('[IPC Main] Error in photos:getAlbums:', error);
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
// Dynamic import and initialization for ESM compatibility
let store: any = null;

/**
 * Initialize electron-store using dynamic import to handle ESM compatibility
 * Returns: Promise<void>
 */
async function initializeStore(): Promise<void> {
  if (store) return; // Already initialized
  
  try {
    console.log('[Storage] Initializing electron-store...');
    // Use Function constructor to prevent TypeScript from transpiling dynamic import to require()
    const dynamicImport = new Function('specifier', 'return import(specifier)');
    const Store = (await dynamicImport('electron-store')).default;
    store = new Store({
      projectName: 'slideshow-buddy',
      name: 'slideshow-buddy-data',
      encryptionKey: 'slideshow-buddy-secure-key-2024', // Optional encryption for sensitive data
      cwd: electronIsDev ? undefined : app.getPath('userData') // Use app data directory in production
    });
    console.log('[Storage] electron-store initialized successfully');
  } catch (error) {
    console.error('[Storage] Failed to initialize electron-store:', error);
    throw error;
  }
}

// Storage IPC Handlers
// These handlers bridge the renderer process to electron-store for persistent storage

/**
 * Get a value from storage
 * Params: key (string)
 * Returns: any (the stored value or undefined if not found)
 */
ipcMain.handle('storage:get', async (event, key: string) => {
  try {
    if (!store) await initializeStore();
    const value = store.get(key);
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
    if (!store) await initializeStore();
    store.set(key, value);
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
    if (!store) await initializeStore();
    store.delete(key);
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
    if (!store) await initializeStore();
    store.clear();
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

// File Dialog IPC Handlers
// These handlers provide file system access for photo selection on macOS

/**
 * Open file dialog for image selection
 * Returns: { canceled: boolean, files: SelectedImageFile[] }
 */
ipcMain.handle('dialog:selectImages', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'heic', 'heif', 'webp'] }
      ],
      title: 'Select Photos for Slideshow'
    });

    if (result.canceled) {
      return { canceled: true, filePaths: [] };
    }

    // Read files and convert to base64 data URIs
    const files = await Promise.all(
      result.filePaths.map(async (filePath) => {
        const data = await fs.promises.readFile(filePath);
        const ext = path.extname(filePath).slice(1).toLowerCase();
        const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
        const base64 = data.toString('base64');
        const dataUri = `data:${mimeType};base64,${base64}`;
        
        return {
          id: path.basename(filePath, path.extname(filePath)) + '_' + Date.now(),
          uri: dataUri,
          filename: path.basename(filePath),
          path: filePath
        };
      })
    );

    return { canceled: false, files };
  } catch (error) {
    console.error('[IPC Main] Error in dialog:selectImages:', error);
    throw error;
  }
});

// Photo Library IPC Handlers
// These handlers provide photo library management operations for macOS

/**
 * Generate SHA256 hash of a file for duplicate detection
 * Returns: { success: boolean, hash?: string, error?: string }
 */
ipcMain.handle('photoLibrary:generateHash', async (_event, filePath: string) => {
  try {
    const crypto = await import('crypto');
    const fileBuffer = await fs.promises.readFile(filePath);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    
    return { success: true, hash };
  } catch (error) {
    console.error('[IPC Main] Error generating hash:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate hash'
    };
  }
});

/**
 * Validate that a file exists at the specified path
 * Returns: { success: boolean, exists?: boolean, error?: string }
 */
ipcMain.handle('photoLibrary:validateFile', async (_event, filePath: string) => {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return { success: true, exists: true };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { success: true, exists: false };
    }
    console.error('[IPC Main] Error validating file:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to validate file'
    };
  }
});

/**
 * Get file size in bytes
 * Returns: { success: boolean, size?: number, error?: string }
 */
ipcMain.handle('photoLibrary:getFileSize', async (_event, filePath: string) => {
  try {
    const stats = await fs.promises.stat(filePath);
    return { success: true, size: stats.size };
  } catch (error) {
    console.error('[IPC Main] Error getting file size:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get file size'
    };
  }
});

// Browser IPC Handlers
// These handlers provide external URL opening for OAuth flows

/**
 * Open a URL in the system's default external browser
 * Params: url (string)
 * Returns: { success: boolean, error?: string }
 */
ipcMain.handle('browser:openExternal', async (_event, url: string) => {
  try {
    console.log('[IPC Main] Opening external URL:', url);
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('[IPC Main] Error opening external URL:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to open URL'
    };
  }
});
