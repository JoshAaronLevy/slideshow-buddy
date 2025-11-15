import type { CapacitorElectronConfig } from '@capacitor-community/electron';
import { getCapacitorElectronConfig, setupElectronDeepLinking } from '@capacitor-community/electron';
import type { MenuItemConstructorOptions } from 'electron';
import { app, MenuItem, ipcMain, powerSaveBlocker } from 'electron';
import electronIsDev from 'electron-is-dev';
import unhandled from 'electron-unhandled';
import { autoUpdater } from 'electron-updater';

import { ElectronCapacitorApp, setupContentSecurityPolicy, setupReloadWatcher } from './setup';
import { photosLibraryFFI } from './native/PhotosLibraryFFI';

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
const appMenuBarMenuTemplate: (MenuItemConstructorOptions | MenuItem)[] = [
  { role: process.platform === 'darwin' ? 'appMenu' : 'fileMenu' },
  { role: 'viewMenu' },
];

// Get Config options from capacitor.config
const capacitorFileConfig: CapacitorElectronConfig = getCapacitorElectronConfig();

// Initialize our app. You can pass menu templates into the app here.
// const myCapacitorApp = new ElectronCapacitorApp(capacitorFileConfig);
const myCapacitorApp = new ElectronCapacitorApp(capacitorFileConfig, trayMenuTemplate, appMenuBarMenuTemplate);

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

/**
 * Send pending OAuth callback when app initializes
 * This handles the case where OAuth callback arrives before window is ready
 */
const originalInit = myCapacitorApp.init;
myCapacitorApp.init = async function(...args) {
  const result = await originalInit.apply(this, args);
  
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
