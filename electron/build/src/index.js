"use strict";
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const electron_1 = require("@capacitor-community/electron");
const electron_2 = require("electron");
const electron_is_dev_1 = tslib_1.__importDefault(require("electron-is-dev"));
const electron_unhandled_1 = tslib_1.__importDefault(require("electron-unhandled"));
const worker_threads_1 = require("worker_threads");
// electron-store will be dynamically imported to handle ESM compatibility
const keytar = tslib_1.__importStar(require("keytar"));
const fs = tslib_1.__importStar(require("fs"));
const path = tslib_1.__importStar(require("path"));
const setup_1 = require("./setup");
const PhotosLibraryFFI_1 = require("./native/PhotosLibraryFFI");
const menu_1 = require("./menu");
// Graceful handling of unhandled errors.
(0, electron_unhandled_1.default)();
/**
 * Get autoUpdater instance only when explicitly enabled via environment variable.
 * This prevents electron-updater from being imported in local unsigned builds,
 * which would cause it to attempt reading app-update.yml and crash with ENOENT.
 *
 * @returns autoUpdater instance if enabled, null otherwise
 */
async function getAutoUpdater() {
    // For now, completely disable auto-updates in local builds.
    // We only want this code path to be used in real production builds later.
    if (process.env.ENABLE_AUTO_UPDATE !== 'true') {
        return null;
    }
    // Only import electron-updater when we explicitly enable it.
    // This prevents it from trying to read app-update.yml in local unsigned builds.
    const { autoUpdater } = await Promise.resolve().then(() => tslib_1.__importStar(require('electron-updater')));
    return autoUpdater;
}
class PhotosWorkerManager {
    constructor() {
        this.worker = null;
        this.pendingRequests = new Map();
        this.requestIdCounter = 0;
    }
    /**
     * Get the path to the compiled worker file
     * Handles both development and production scenarios
     */
    getWorkerPath() {
        if (electron_is_dev_1.default) {
            // Development: worker is in electron/build/src/workers/
            const devPath = path.join(__dirname, 'workers', 'photosPermissionWorker.js');
            console.log('[Photos Worker Manager] Dev worker path:', devPath);
            return devPath;
        }
        else {
            // Production: worker should be in app.asar or extraResources
            // Try app.asar first, then extraResources
            const asarPath = path.join(__dirname, 'workers', 'photosPermissionWorker.js');
            const resourcesPath = path.join(process.resourcesPath, 'workers', 'photosPermissionWorker.js');
            console.log('[Photos Worker Manager] Checking production paths:');
            console.log('[Photos Worker Manager]   asar:', asarPath);
            console.log('[Photos Worker Manager]   resources:', resourcesPath);
            // Check if file exists (asar path is usually the right one for bundled code)
            if (fs.existsSync(asarPath)) {
                console.log('[Photos Worker Manager] ✓ Found worker in asar');
                return asarPath;
            }
            else if (fs.existsSync(resourcesPath)) {
                console.log('[Photos Worker Manager] ✓ Found worker in resources');
                return resourcesPath;
            }
            else {
                console.error('[Photos Worker Manager] ✗ Worker not found in either location');
                return asarPath; // Try asar path anyway
            }
        }
    }
    /**
     * Initialize the worker thread (lazy initialization)
     */
    ensureWorker() {
        if (this.worker) {
            return; // Worker already exists
        }
        try {
            console.log('[Photos Worker Manager] ═══════════════════════════════════════');
            console.log('[Photos Worker Manager] Initializing worker thread...');
            console.log('[Photos Worker Manager] Environment:', electron_is_dev_1.default ? 'DEVELOPMENT' : 'PRODUCTION');
            const workerPath = this.getWorkerPath();
            console.log('[Photos Worker Manager] Worker path:', workerPath);
            // Pass environment info to worker via workerData
            // This allows PhotosLibraryFFI to determine dev vs prod without electron-is-dev
            const workerData = {
                isDev: electron_is_dev_1.default,
                resourcesPath: process.resourcesPath,
                nodeEnv: process.env.NODE_ENV || (electron_is_dev_1.default ? 'development' : 'production')
            };
            // Set NODE_ENV for the worker thread environment
            const workerEnv = Object.assign(Object.assign({}, process.env), { NODE_ENV: workerData.nodeEnv, SLIDESHOW_BUDDY_DEV: electron_is_dev_1.default ? 'true' : 'false' });
            console.log('[Photos Worker Manager] Worker data:', workerData);
            console.log('[Photos Worker Manager] Worker env.NODE_ENV:', workerEnv.NODE_ENV);
            this.worker = new worker_threads_1.Worker(workerPath, {
                workerData,
                env: workerEnv
            });
            console.log('[Photos Worker Manager] ✓ Worker thread created');
            // Handle messages from worker
            this.worker.on('message', (response) => {
                var _a;
                console.log('[Photos Worker Manager] Received response from worker:', {
                    id: response.id,
                    success: response.success,
                    hasPermission: response.hasPermission,
                    hasError: !!response.error
                });
                const pending = this.pendingRequests.get(response.id);
                if (!pending) {
                    console.warn('[Photos Worker Manager] ⚠️  Received response for unknown request ID:', response.id);
                    return;
                }
                // Remove from pending map
                this.pendingRequests.delete(response.id);
                // Resolve or reject the promise
                if (response.success) {
                    console.log('[Photos Worker Manager] ✓ Resolving request', response.id, 'with:', response.hasPermission);
                    pending.resolve((_a = response.hasPermission) !== null && _a !== void 0 ? _a : false);
                }
                else {
                    console.error('[Photos Worker Manager] ✗ Rejecting request', response.id, 'with error:', response.error);
                    pending.reject(new Error(response.error || 'Worker request failed'));
                }
            });
            // Handle worker errors
            this.worker.on('error', (error) => {
                console.error('[Photos Worker Manager] ✗✗✗ Worker error:', error);
                console.error('[Photos Worker Manager] Error message:', error.message);
                console.error('[Photos Worker Manager] Stack:', error.stack);
                // Reject all pending requests
                this.pendingRequests.forEach((pending, id) => {
                    console.error('[Photos Worker Manager] Rejecting pending request', id, 'due to worker error');
                    pending.reject(new Error(`Worker error: ${error.message}`));
                });
                this.pendingRequests.clear();
                // Clean up worker
                this.worker = null;
            });
            // Handle worker exit
            this.worker.on('exit', (code) => {
                console.log('[Photos Worker Manager] Worker exited with code:', code);
                if (code !== 0) {
                    console.error('[Photos Worker Manager] ✗ Worker exited with non-zero code');
                    // Reject all pending requests
                    this.pendingRequests.forEach((pending, id) => {
                        console.error('[Photos Worker Manager] Rejecting pending request', id, 'due to worker exit');
                        pending.reject(new Error(`Worker exited with code ${code}`));
                    });
                    this.pendingRequests.clear();
                }
                // Clean up worker reference
                this.worker = null;
            });
            console.log('[Photos Worker Manager] ✓ Worker initialized successfully');
            console.log('[Photos Worker Manager] ═══════════════════════════════════════');
        }
        catch (error) {
            console.error('[Photos Worker Manager] ✗✗✗ Failed to initialize worker:', error);
            console.error('[Photos Worker Manager] Error:', error instanceof Error ? error.message : 'Unknown error');
            if (error instanceof Error && error.stack) {
                console.error('[Photos Worker Manager] Stack:', error.stack);
            }
            throw error;
        }
    }
    /**
     * Send a request to the worker and return a promise that resolves with the result
     */
    async sendRequest(type) {
        this.ensureWorker();
        if (!this.worker) {
            throw new Error('Failed to initialize worker');
        }
        const id = `req_${++this.requestIdCounter}_${Date.now()}`;
        console.log('[Photos Worker Manager] Sending request to worker:', { id, type });
        const promise = new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });
            const request = { id, type };
            this.worker.postMessage(request);
            console.log('[Photos Worker Manager] Request sent, waiting for response...');
        });
        return promise;
    }
    /**
     * Request Photos permission via worker thread
     */
    async requestPermission() {
        console.log('[Photos Worker Manager] requestPermission() called');
        return this.sendRequest('requestPermission');
    }
    /**
     * Check Photos permission via worker thread
     */
    async checkPermission() {
        console.log('[Photos Worker Manager] checkPermission() called');
        return this.sendRequest('checkPermission');
    }
    /**
     * Cleanup worker and reject all pending requests
     */
    dispose() {
        console.log('[Photos Worker Manager] Disposing worker...');
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        // Reject all pending requests
        this.pendingRequests.forEach((pending, id) => {
            pending.reject(new Error('Worker manager disposed'));
        });
        this.pendingRequests.clear();
        console.log('[Photos Worker Manager] ✓ Worker disposed');
    }
}
// Create singleton instance
const photosWorkerManager = new PhotosWorkerManager();
// Cleanup worker on app quit
electron_2.app.on('will-quit', () => {
    photosWorkerManager.dispose();
});
// Register custom protocol for OAuth callbacks
// This must be done before app.whenReady() to ensure proper registration
if (process.defaultApp) {
    if (process.argv.length >= 2) {
        electron_2.app.setAsDefaultProtocolClient('com.slideshowbuddy', process.execPath, [process.argv[1]]);
    }
}
else {
    electron_2.app.setAsDefaultProtocolClient('com.slideshowbuddy');
}
// Define our menu templates (these are optional)
const trayMenuTemplate = [new electron_2.MenuItem({ label: 'Quit App', role: 'quit' })];
// Get Config options from capacitor.config
const capacitorFileConfig = (0, electron_1.getCapacitorElectronConfig)();
// Initialize our app. We'll set up the custom menu after app initialization.
const myCapacitorApp = new setup_1.ElectronCapacitorApp(capacitorFileConfig, trayMenuTemplate);
// If deeplinking is enabled then we will set it up here.
if ((_a = capacitorFileConfig.electron) === null || _a === void 0 ? void 0 : _a.deepLinkingEnabled) {
    (0, electron_1.setupElectronDeepLinking)(myCapacitorApp, {
        customProtocol: (_b = capacitorFileConfig.electron.deepLinkingCustomProtocol) !== null && _b !== void 0 ? _b : 'mycapacitorapp',
    });
}
// If we are in Dev mode, use the file watcher components.
if (electron_is_dev_1.default) {
    (0, setup_1.setupReloadWatcher)(myCapacitorApp);
}
// Run Application
(async () => {
    // Wait for electron app to be ready.
    await electron_2.app.whenReady();
    // Security - Set Content-Security-Policy based on whether or not we are in dev mode.
    (0, setup_1.setupContentSecurityPolicy)(myCapacitorApp.getCustomURLScheme());
    // Initialize our app, build windows, and load content.
    await myCapacitorApp.init();
    // Check for updates only when explicitly enabled via ENABLE_AUTO_UPDATE environment variable
    // This prevents electron-updater from being imported in local unsigned builds
    const autoUpdater = await getAutoUpdater();
    if (autoUpdater) {
        console.log('[Auto-Update] Auto-updater enabled, checking for updates...');
        autoUpdater.checkForUpdatesAndNotify();
    }
    else {
        console.log('[Auto-Update] Auto-updater disabled (ENABLE_AUTO_UPDATE not set to "true")');
        console.log('[Auto-Update] electron-updater will not be loaded, preventing app-update.yml read errors');
    }
})();
// Handle when all of our windows are close (platforms have their own expectations).
electron_2.app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        electron_2.app.quit();
    }
});
// When the dock icon is clicked.
electron_2.app.on('activate', async function () {
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
        const isDark = electron_2.nativeTheme.shouldUseDarkColors;
        mainWindow.webContents.send('theme-changed', isDark ? 'dark' : 'light');
        // Update window background color based on theme
        if (process.platform === 'darwin') {
            mainWindow.setBackgroundColor(isDark ? '#1c1c1e' : '#ffffff');
        }
    }
}
// Listen for system theme changes
electron_2.nativeTheme.on('updated', updateTheme);
// macOS-specific window configuration after initialization
const originalInit = myCapacitorApp.init;
myCapacitorApp.init = async function (...args) {
    const result = await originalInit.apply(this, args);
    // Set up macOS-specific window features
    if (process.platform === 'darwin') {
        const mainWindow = myCapacitorApp.getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
            // Create macOS menu bar
            (0, menu_1.createMenu)(mainWindow);
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
let powerSaveBlockerId = null;
// Spotify OAuth Callback Handling
// Store pending OAuth callback URL in case window isn't ready yet
let pendingOAuthCallback = null;
/**
 * Log Photos library status without making blocking calls
 * This is safe to call on startup
 */
function logPhotosLibraryStatus() {
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
    console.log('[Photos Library] FFI Ready:', PhotosLibraryFFI_1.photosLibraryFFI.isReady());
    if (!PhotosLibraryFFI_1.photosLibraryFFI.isReady()) {
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
async function checkAndRequestPhotosPermission() {
    console.log('='.repeat(80));
    console.log('[Photos Permission] Starting permission check on app startup');
    console.log('[Photos Permission] Platform:', process.platform);
    console.log('[Photos Permission] Timestamp:', new Date().toISOString());
    console.log('[Photos Permission] Running on setImmediate to avoid blocking main thread');
    try {
        // Verify FFI is ready
        if (!PhotosLibraryFFI_1.photosLibraryFFI.isReady()) {
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
            const checkPromise = new Promise((resolve, reject) => {
                try {
                    const result = PhotosLibraryFFI_1.photosLibraryFFI.checkPermission();
                    resolve(result);
                }
                catch (error) {
                    reject(error);
                }
            });
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Permission check timed out after 5 seconds')), 5000);
            });
            hasPermission = await Promise.race([checkPromise, timeoutPromise]);
            console.log('[Photos Permission] Current permission status:', hasPermission ? '✓ GRANTED' : '✗ NOT GRANTED');
        }
        catch (error) {
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
            const requestPromise = PhotosLibraryFFI_1.photosLibraryFFI.requestPermission();
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Permission request timed out after 30 seconds')), 30000);
            });
            const permissionGranted = await Promise.race([requestPromise, timeoutPromise]);
            console.log('[Photos Permission] User responded to permission request');
            console.log('[Photos Permission] Permission granted:', permissionGranted ? '✓ YES' : '✗ NO');
            if (permissionGranted) {
                console.log('[Photos Permission] ✓✓✓ SUCCESS ✓✓✓');
                console.log('[Photos Permission] App now has access to Photos library');
                console.log('[Photos Permission] Photos can be accessed via PhotoKit APIs');
            }
            else {
                console.log('[Photos Permission] ⚠️  Permission denied by user');
                console.log('[Photos Permission] App will fall back to file browser for photo selection');
                console.log('[Photos Permission] User can grant permission later in System Settings > Privacy & Security > Photos');
            }
        }
        catch (error) {
            console.error('[Photos Permission] ❌ Error requesting permission:', error);
            console.error('[Photos Permission] Error details:', error.message);
            if (error.stack) {
                console.error('[Photos Permission] Error stack:', error.stack);
            }
            console.error('[Photos Permission] This is non-fatal - app will continue without Photos access');
        }
    }
    catch (error) {
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
electron_2.app.on('open-url', (event, url) => {
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
        }
        else {
            // Store callback for when window becomes ready
            pendingOAuthCallback = url;
            // console.log('[Electron Main] OAuth callback queued - window not ready yet');
        }
    }
    else {
        // console.log('[Electron Main] URL does not match expected callback pattern');
    }
});
// Window Management IPC Handlers
/**
 * Set window title dynamically
 * Returns: { success: boolean, message?: string, error?: string }
 */
electron_2.ipcMain.handle('window:set-title', async (event, title) => {
    try {
        const mainWindow = myCapacitorApp.getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setTitle(title || 'Slideshow Buddy');
            return { success: true, message: 'Window title updated successfully' };
        }
        return { success: false, error: 'Main window not available' };
    }
    catch (error) {
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
electron_2.ipcMain.handle('system:get-theme', async () => {
    try {
        const isDark = electron_2.nativeTheme.shouldUseDarkColors;
        return { success: true, theme: isDark ? 'dark' : 'light' };
    }
    catch (error) {
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
 *
 * NOTE: This handler uses a worker thread to avoid blocking the main process.
 * The Swift bridge uses DispatchSemaphore which blocks the calling thread,
 * so we run it in a worker to keep the main process responsive.
 */
electron_2.ipcMain.handle('photos:requestPermission', async () => {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║         [MAIN-PROCESS-IPC] photos:requestPermission           ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('[MAIN-PROCESS-IPC] Handler invoked');
    console.log('[MAIN-PROCESS-IPC] Timestamp:', new Date().toISOString());
    console.log('[MAIN-PROCESS-IPC] Process platform:', process.platform);
    if (process.platform !== 'darwin') {
        console.error('[MAIN-PROCESS-IPC] ✗ Not running on macOS');
        console.log('╚════════════════════════════════════════════════════════════════╝');
        return { success: false, error: 'Photos library only available on macOS' };
    }
    try {
        console.log('[MAIN-PROCESS-IPC] Forwarding request to worker thread...');
        console.log('[MAIN-PROCESS-IPC] Worker will handle blocking Swift FFI call');
        console.log('[Main Process] photos:requestPermission IPC handler - dispatching to worker thread');
        const startTime = Date.now();
        const hasPermission = await photosWorkerManager.requestPermission();
        const duration = Date.now() - startTime;
        console.log('[MAIN-PROCESS-IPC] ━━━ Worker request completed ━━━');
        console.log('[MAIN-PROCESS-IPC] Duration:', duration, 'ms');
        console.log('[MAIN-PROCESS-IPC] Result (hasPermission):', hasPermission);
        console.log('[Main Process] Worker returned status:', hasPermission);
        console.log('[MAIN-PROCESS-IPC] Returning success response to renderer');
        console.log('╚════════════════════════════════════════════════════════════════╝');
        return { success: true, hasPermission };
    }
    catch (error) {
        console.error('[MAIN-PROCESS-IPC] ⚠️  Exception caught in IPC handler');
        console.error('[MAIN-PROCESS-IPC] Error:', error);
        console.error('[MAIN-PROCESS-IPC] Error message:', error instanceof Error ? error.message : 'Unknown error');
        if (error instanceof Error && error.stack) {
            console.error('[MAIN-PROCESS-IPC] Error stack:', error.stack);
        }
        console.log('╚════════════════════════════════════════════════════════════════╝');
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to request Photos library permission'
        };
    }
});
/**
 * Check current Photos library permission status
 * Returns: { success: boolean, hasPermission?: boolean, error?: string }
 *
 * NOTE: This handler uses a worker thread to avoid blocking the main process.
 * Even though checkPermission is typically fast, we route it through the worker
 * for consistency and to ensure the main thread never blocks on FFI calls.
 */
electron_2.ipcMain.handle('photos:checkPermission', async () => {
    console.log('[MAIN-PROCESS-IPC] photos:checkPermission called');
    if (process.platform !== 'darwin') {
        console.log('[MAIN-PROCESS-IPC] Not on macOS, returning error');
        return { success: false, error: 'Photos library only available on macOS' };
    }
    try {
        console.log('[MAIN-PROCESS-IPC] Forwarding request to worker thread...');
        const hasPermission = await photosWorkerManager.checkPermission();
        console.log('[MAIN-PROCESS-IPC] Worker result:', hasPermission);
        return { success: true, hasPermission };
    }
    catch (error) {
        console.error('[MAIN-PROCESS-IPC] Error in photos:checkPermission:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to check Photos library permission'
        };
    }
});
/**
 * Get list of photo albums from the library
 * Returns: { success: boolean, albums?: PhotoAlbum[], error?: string }
 */
electron_2.ipcMain.handle('photos:getAlbums', async () => {
    console.log('[IPC Main] photos:getAlbums called');
    if (process.platform !== 'darwin') {
        console.log('[IPC Main] Not on macOS, returning error');
        return { success: false, error: 'Photos library only available on macOS' };
    }
    try {
        if (!PhotosLibraryFFI_1.photosLibraryFFI.isReady()) {
            console.error('[IPC Main] PhotosLibraryFFI not ready');
            return { success: false, error: 'Photos library FFI not initialized' };
        }
        console.log('[IPC Main] Calling PhotosLibraryFFI.getAlbums()...');
        const albums = await PhotosLibraryFFI_1.photosLibraryFFI.getAlbums();
        console.log('[IPC Main] PhotosLibraryFFI.getAlbums result:', albums ? `${albums.length} albums` : 'null/undefined');
        return { success: true, albums };
    }
    catch (error) {
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
electron_2.ipcMain.handle('slideshow:keep-awake-start', async () => {
    try {
        if (powerSaveBlockerId !== null) {
            return {
                success: true,
                blockerId: powerSaveBlockerId,
                message: 'Power save blocker already active'
            };
        }
        powerSaveBlockerId = electron_2.powerSaveBlocker.start('prevent-display-sleep');
        console.log('PowerSave blocker started with ID:', powerSaveBlockerId);
        return {
            success: true,
            blockerId: powerSaveBlockerId,
            message: 'Display sleep prevented successfully'
        };
    }
    catch (error) {
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
electron_2.ipcMain.handle('slideshow:keep-awake-stop', async () => {
    try {
        if (powerSaveBlockerId !== null) {
            electron_2.powerSaveBlocker.stop(powerSaveBlockerId);
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
    }
    catch (error) {
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
electron_2.app.on('before-quit', () => {
    if (powerSaveBlockerId !== null) {
        try {
            electron_2.powerSaveBlocker.stop(powerSaveBlockerId);
            console.log('PowerSave blocker cleaned up on app quit');
            powerSaveBlockerId = null;
        }
        catch (error) {
            console.error('Failed to cleanup power save blocker on quit:', error);
        }
    }
});
/**
 * Get photos from a specific album or all photos
 * Params: { albumId?: string, quantity?: number }
 * Returns: { success: boolean, photos?: Photo[], error?: string }
 */
electron_2.ipcMain.handle('photos:getPhotos', async (event, params = {}) => {
    if (process.platform !== 'darwin') {
        return { success: false, error: 'Photos library only available on macOS' };
    }
    try {
        if (!PhotosLibraryFFI_1.photosLibraryFFI.isReady()) {
            return { success: false, error: 'Photos library FFI not initialized' };
        }
        const { albumId, quantity = 50 } = params;
        const photos = await PhotosLibraryFFI_1.photosLibraryFFI.getPhotos(albumId, quantity);
        return { success: true, photos };
    }
    catch (error) {
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
electron_2.ipcMain.handle('menu:update-state', async (event, state) => {
    try {
        if (process.platform === 'darwin') {
            (0, menu_1.updateMenuState)(state);
            return { success: true, message: 'Menu state updated successfully' };
        }
        return { success: true, message: 'Menu not available on this platform' };
    }
    catch (error) {
        console.error('Failed to update menu state:', error);
        return {
            success: false,
            error: error.message || 'Failed to update menu state'
        };
    }
});
// Storage Management using electron-store
// Dynamic import and initialization for ESM compatibility
let store = null;
/**
 * Initialize electron-store using dynamic import to handle ESM compatibility
 * Returns: Promise<void>
 */
async function initializeStore() {
    if (store)
        return; // Already initialized
    try {
        console.log('[Storage] Initializing electron-store...');
        // Use Function constructor to prevent TypeScript from transpiling dynamic import to require()
        const dynamicImport = new Function('specifier', 'return import(specifier)');
        const Store = (await dynamicImport('electron-store')).default;
        store = new Store({
            projectName: 'slideshow-buddy',
            name: 'slideshow-buddy-data',
            encryptionKey: 'slideshow-buddy-secure-key-2024', // Optional encryption for sensitive data
            cwd: electron_is_dev_1.default ? undefined : electron_2.app.getPath('userData') // Use app data directory in production
        });
        console.log('[Storage] electron-store initialized successfully');
    }
    catch (error) {
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
electron_2.ipcMain.handle('storage:get', async (event, key) => {
    try {
        if (!store)
            await initializeStore();
        const value = store.get(key);
        console.log(`[Storage] Get ${key}:`, value !== undefined ? 'found' : 'not found');
        return value;
    }
    catch (error) {
        console.error(`[Storage] Error getting ${key}:`, error);
        return undefined;
    }
});
/**
 * Set a value in storage
 * Params: key (string), value (any)
 * Returns: void
 */
electron_2.ipcMain.handle('storage:set', async (event, key, value) => {
    try {
        if (!store)
            await initializeStore();
        store.set(key, value);
        console.log(`[Storage] Set ${key}: success`);
    }
    catch (error) {
        console.error(`[Storage] Error setting ${key}:`, error);
        throw error;
    }
});
/**
 * Remove a value from storage
 * Params: key (string)
 * Returns: void
 */
electron_2.ipcMain.handle('storage:remove', async (event, key) => {
    try {
        if (!store)
            await initializeStore();
        store.delete(key);
        console.log(`[Storage] Removed ${key}: success`);
    }
    catch (error) {
        console.error(`[Storage] Error removing ${key}:`, error);
        throw error;
    }
});
/**
 * Clear all storage
 * Returns: void
 */
electron_2.ipcMain.handle('storage:clear', async () => {
    try {
        if (!store)
            await initializeStore();
        store.clear();
        console.log('[Storage] Clear: success');
    }
    catch (error) {
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
electron_2.ipcMain.handle('keychain:getPassword', async (event, account) => {
    try {
        if (process.platform !== 'darwin') {
            console.log('[Keychain] Not on macOS, keychain not available');
            return null;
        }
        const password = await keytar.getPassword(SERVICE_NAME, account);
        console.log(`[Keychain] Get ${account}:`, password !== null ? 'found' : 'not found');
        return password;
    }
    catch (error) {
        console.error(`[Keychain] Error getting password for ${account}:`, error);
        return null;
    }
});
/**
 * Set a password in macOS Keychain
 * Params: account (string), password (string)
 * Returns: boolean (success status)
 */
electron_2.ipcMain.handle('keychain:setPassword', async (event, account, password) => {
    try {
        if (process.platform !== 'darwin') {
            console.log('[Keychain] Not on macOS, keychain not available');
            return false;
        }
        await keytar.setPassword(SERVICE_NAME, account, password);
        console.log(`[Keychain] Set ${account}: success`);
        return true;
    }
    catch (error) {
        console.error(`[Keychain] Error setting password for ${account}:`, error);
        return false;
    }
});
/**
 * Delete a password from macOS Keychain
 * Params: account (string)
 * Returns: boolean (success status)
 */
electron_2.ipcMain.handle('keychain:deletePassword', async (event, account) => {
    try {
        if (process.platform !== 'darwin') {
            console.log('[Keychain] Not on macOS, keychain not available');
            return false;
        }
        const deleted = await keytar.deletePassword(SERVICE_NAME, account);
        console.log(`[Keychain] Delete ${account}:`, deleted ? 'success' : 'not found');
        return deleted;
    }
    catch (error) {
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
electron_2.ipcMain.handle('dialog:selectImages', async () => {
    try {
        const result = await electron_2.dialog.showOpenDialog({
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
        const files = await Promise.all(result.filePaths.map(async (filePath) => {
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
        }));
        return { canceled: false, files };
    }
    catch (error) {
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
electron_2.ipcMain.handle('photoLibrary:generateHash', async (_event, filePath) => {
    try {
        const crypto = await Promise.resolve().then(() => tslib_1.__importStar(require('crypto')));
        const fileBuffer = await fs.promises.readFile(filePath);
        const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        return { success: true, hash };
    }
    catch (error) {
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
electron_2.ipcMain.handle('photoLibrary:validateFile', async (_event, filePath) => {
    try {
        await fs.promises.access(filePath, fs.constants.F_OK);
        return { success: true, exists: true };
    }
    catch (error) {
        if (error.code === 'ENOENT') {
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
electron_2.ipcMain.handle('photoLibrary:getFileSize', async (_event, filePath) => {
    try {
        const stats = await fs.promises.stat(filePath);
        return { success: true, size: stats.size };
    }
    catch (error) {
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
electron_2.ipcMain.handle('browser:openExternal', async (_event, url) => {
    try {
        console.log('[IPC Main] Opening external URL:', url);
        await electron_2.shell.openExternal(url);
        return { success: true };
    }
    catch (error) {
        console.error('[IPC Main] Error opening external URL:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to open URL'
        };
    }
});
