"use strict";
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Photos Library FFI Bridge
 * Provides TypeScript interface to Swift Photos library through koffi FFI
 *
 * This module handles:
 * - Loading the Swift dynamic library
 * - Memory management for C strings
 * - Type-safe wrappers around FFI functions
 * - JSON parsing of Swift responses
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhotosLibraryFFI = exports.photosLibraryFFI = void 0;
const tslib_1 = require("tslib");
const koffi = tslib_1.__importStar(require("koffi"));
const path = tslib_1.__importStar(require("path"));
const fs = tslib_1.__importStar(require("fs"));
const types_1 = require("./types");
/**
 * Worker-safe environment detection
 * Uses process.env and process.resourcesPath instead of electron-is-dev
 * to work correctly inside Node.js Worker threads.
 */
function isDevEnvironment() {
    // Check NODE_ENV first (standard Node convention)
    if (process.env.NODE_ENV === 'development') {
        return true;
    }
    // Check if SLIDESHOW_BUDDY_DEV is explicitly set
    if (process.env.SLIDESHOW_BUDDY_DEV === 'true') {
        return true;
    }
    // In packaged apps, process.resourcesPath is always defined and points to .app/Contents/Resources
    // In dev mode, it's usually undefined or points to electron binary location
    // This is a reliable fallback for worker threads
    if (!process.resourcesPath || process.resourcesPath.includes('/node_modules/electron/')) {
        return true;
    }
    return false;
}
class PhotosLibraryFFI {
    constructor() {
        this.lib = null;
        this.ffiInterface = null;
        this.isInitialized = false;
        this.initializeLibrary();
    }
    /**
     * Initialize the Swift dynamic library and set up FFI bindings
     */
    initializeLibrary() {
        try {
            const isDev = isDevEnvironment();
            console.log('[FFI-Init] ═════════════════════════════════════════════');
            console.log('[FFI-Init] Initializing Swift Photos Library FFI');
            console.log('[FFI-Init] Environment:', isDev ? 'DEVELOPMENT' : 'PRODUCTION');
            console.log('[FFI-Init] Platform:', process.platform);
            console.log('[FFI-Init] __dirname:', __dirname);
            console.log('[FFI-Init] process.resourcesPath:', process.resourcesPath);
            console.log('[FFI-Init] NODE_ENV:', process.env.NODE_ENV);
            console.log('[FFI-Init] SLIDESHOW_BUDDY_DEV:', process.env.SLIDESHOW_BUDDY_DEV);
            // Build list of candidate paths to try
            const possiblePaths = [];
            if (isDev) {
                // Development mode: dylib is built to electron/build/native/ or electron/assets/
                // __dirname in compiled JS is electron/build/src/native, so go up to build/ then into native/
                possiblePaths.push(path.join(__dirname, '../native/libPhotosLibraryBridge.dylib'), path.join(__dirname, '../../assets/libPhotosLibraryBridge.dylib'));
            }
            else {
                // Production mode (packaged app):
                // - process.resourcesPath = "Slideshow Buddy.app/Contents/Resources"
                // - dylib should be at "Contents/Resources/assets/libPhotosLibraryBridge.dylib"
                // IMPORTANT: Do NOT use app.getAppPath() because that points inside app.asar,
                // and native binaries cannot be loaded from inside asar files.
                possiblePaths.push(path.join(process.resourcesPath, 'assets', 'libPhotosLibraryBridge.dylib'), path.join(process.resourcesPath, 'libPhotosLibraryBridge.dylib'));
            }
            console.log('[FFI-Init] Candidate paths to try:');
            possiblePaths.forEach((p, i) => {
                console.log(`[FFI-Init]   ${i + 1}. ${p}`);
            });
            let libraryPath = null;
            for (const testPath of possiblePaths) {
                console.log(`[FFI-Init] Checking: ${testPath}`);
                try {
                    if (fs.existsSync(testPath)) {
                        const stats = fs.statSync(testPath);
                        if (stats.isFile()) {
                            console.log(`[FFI-Init] ✓ Found dylib at: ${testPath}`);
                            console.log(`[FFI-Init]   File size: ${stats.size} bytes`);
                            libraryPath = testPath;
                            break;
                        }
                        else {
                            console.log(`[FFI-Init] ✗ Path exists but is not a file`);
                        }
                    }
                    else {
                        console.log(`[FFI-Init] ✗ Path does not exist`);
                    }
                }
                catch (error) {
                    console.log(`[FFI-Init] ✗ Error checking path:`, error.message);
                }
            }
            if (!libraryPath) {
                const isDev = isDevEnvironment();
                const errorMsg = [
                    'Swift Photos library not found. Tried the following paths:',
                    ...possiblePaths.map((p, i) => `  ${i + 1}. ${p}`),
                    '',
                    isDev
                        ? 'In DEV mode: Run "npm run build:swift" to build the dylib first.'
                        : 'In PRODUCTION mode: Ensure electron-builder is configured to copy the dylib to Resources/assets/.'
                ].join('\n');
                console.error('[FFI-Init] ✗✗✗ LIBRARY NOT FOUND ✗✗✗');
                console.error(errorMsg);
                throw new types_1.PhotosLibraryError(errorMsg, 'LIBRARY_NOT_FOUND');
            }
            console.log('[FFI-Init] Loading dylib via koffi.load()...');
            // Load the dynamic library
            this.lib = koffi.load(libraryPath);
            console.log('[FFI-Init] ✓ koffi.load() successful');
            // Define FFI function signatures
            // Note: Modern koffi auto-converts char* returns to JavaScript strings
            console.log('[FFI-Init] Binding Swift functions via koffi...');
            this.ffiInterface = {
                // Permission functions
                photos_request_permission: this.lib.func('photos_request_permission', 'string', []),
                photos_check_permission: this.lib.func('photos_check_permission', 'string', []),
                // Data retrieval functions
                photos_get_albums: this.lib.func('photos_get_albums', 'string', []),
                photos_get_photos: this.lib.func('photos_get_photos', 'string', [
                    'string', // albumId (nullable, koffi handles null conversion)
                    'int32' // quantity
                ])
            };
            this.isInitialized = true;
            console.log('[FFI-Init] ✓ All functions bound successfully');
            console.log('[FFI-Init] Photos Library FFI initialized successfully');
            console.log('[FFI-Init] ═══════════════════════════════════════════════════════════════');
        }
        catch (error) {
            console.error('[FFI-Init] ✗✗✗ INITIALIZATION FAILED ✗✗✗');
            console.error('[FFI-Init] Error:', error);
            console.error('[FFI-Init] Error message:', error.message);
            if (error.stack) {
                console.error('[FFI-Init] Stack trace:', error.stack);
            }
            console.error('[FFI-Init] ═══════════════════════════════════════════════════════════════');
            throw new types_1.PhotosLibraryError(`Failed to load Swift Photos library: ${error.message}`, 'INITIALIZATION_FAILED');
        }
    }
    /**
     * Call FFI function that returns a string (modern koffi auto-converts)
     */
    callStringFunction(fn) {
        console.log('[FFI] callStringFunction() invoked');
        if (!this.isInitialized || !this.ffiInterface) {
            console.error('[FFI] callStringFunction: FFI not initialized');
            throw new types_1.PhotosLibraryError('FFI not initialized', 'NOT_INITIALIZED');
        }
        const result = fn();
        console.log('[FFI] callStringFunction raw result:', result, 'Type:', typeof result);
        if (!result) {
            console.error('[FFI] callStringFunction: Native function returned null/undefined');
            throw new types_1.PhotosLibraryError('Native function returned null', 'NULL_RESULT');
        }
        // Modern koffi auto-converts char* to string
        if (typeof result === 'string') {
            console.log('[FFI] callStringFunction: Result is already a string, returning directly');
            return result;
        }
        console.warn('[FFI] callStringFunction: Result is not a string (unexpected), attempting fallback decode');
        // Fallback for older koffi versions
        try {
            const decoded = koffi.decode(result, 'char*');
            koffi.free(result);
            console.log('[FFI] callStringFunction: Fallback decode successful');
            return decoded;
        }
        catch (error) {
            console.error('[FFI] callStringFunction: Fallback decode failed:', error);
            throw error;
        }
    }
    /**
     * Parse JSON response and handle errors
     */
    parseJsonResponse(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            // Check for error in response
            if (parsed.error) {
                throw new types_1.PhotosLibraryError(parsed.error, 'SWIFT_ERROR');
            }
            return parsed;
        }
        catch (error) {
            if (error instanceof types_1.PhotosLibraryError) {
                throw error;
            }
            throw new types_1.PhotosLibraryError(`Failed to parse JSON response: ${error.message}`, 'JSON_PARSE_ERROR');
        }
    }
    /**
     * Request permission to access photos
     */
    async requestPermission() {
        try {
            console.log('='.repeat(60));
            console.log('[FFI-DIAGNOSTIC] REQUEST PERMISSION START');
            console.log('[FFI-DIAGNOSTIC] Process platform:', process.platform);
            console.log('[FFI-DIAGNOSTIC] FFI initialized:', this.isInitialized);
            console.log('[FFI-DIAGNOSTIC] FFI ready:', this.isReady());
            console.log('[FFI-DIAGNOSTIC] Library path exists:', this.lib !== null);
            console.log('[FFI-DIAGNOSTIC] Interface exists:', this.ffiInterface !== null);
            if (!this.isInitialized || !this.ffiInterface) {
                console.error('[FFI-DIAGNOSTIC] FFI not properly initialized!');
                throw new Error('FFI not initialized');
            }
            console.log('[FFI-DIAGNOSTIC] About to call Swift photos_request_permission...');
            const startTime = Date.now();
            const jsonResult = this.callStringFunction(() => {
                console.log('[FFI-DIAGNOSTIC] Inside callStringFunction, calling native function...');
                return this.ffiInterface.photos_request_permission();
            });
            const duration = Date.now() - startTime;
            console.log('[FFI-DIAGNOSTIC] Native call completed in', duration, 'ms');
            console.log('[FFI-DIAGNOSTIC] Raw result from Swift:', jsonResult, '(type:', typeof jsonResult, ')');
            // Swift returns "true" or "false" as string for this function
            const hasPermission = jsonResult === 'true';
            console.log('[FFI-DIAGNOSTIC] Parsed permission result:', hasPermission);
            console.log('[FFI-DIAGNOSTIC] REQUEST PERMISSION END');
            console.log('='.repeat(60));
            return hasPermission;
        }
        catch (error) {
            console.error('[FFI-DIAGNOSTIC] ERROR in requestPermission:', error);
            console.error('[FFI-DIAGNOSTIC] Error stack:', error.stack);
            console.log('='.repeat(60));
            throw error;
        }
    }
    /**
     * Check current permission status
     */
    checkPermission() {
        console.log('[FFI] checkPermission() called');
        try {
            const jsonResult = this.callStringFunction(() => {
                console.log('[FFI] Calling photos_check_permission via koffi...');
                return this.ffiInterface.photos_check_permission();
            });
            console.log('[FFI] photos_check_permission raw result:', jsonResult, 'Type:', typeof jsonResult);
            // Swift returns "true" or "false" as string for this function
            const hasPermission = jsonResult === 'true';
            console.log('[FFI] checkPermission final result:', hasPermission);
            return hasPermission;
        }
        catch (error) {
            console.error('[FFI] Exception in checkPermission:', error);
            throw error;
        }
    }
    /**
     * Get photo albums from the library
     */
    async getAlbums() {
        var _a;
        console.log('[FFI] getAlbums() called');
        try {
            const jsonResult = this.callStringFunction(() => {
                console.log('[FFI] Calling photos_get_albums via koffi...');
                return this.ffiInterface.photos_get_albums();
            });
            console.log('[FFI] photos_get_albums raw result:', jsonResult, 'Type:', typeof jsonResult);
            const response = this.parseJsonResponse(jsonResult);
            console.log('[FFI] Parsed albums result:', response);
            if (response.error) {
                console.error('[FFI] getAlbums returned error:', response.error);
                throw new types_1.PhotosLibraryError(response.error, 'FETCH_ERROR');
            }
            console.log('[FFI] getAlbums returning', ((_a = response.albums) === null || _a === void 0 ? void 0 : _a.length) || 0, 'albums');
            return response.albums || [];
        }
        catch (error) {
            console.error('[FFI] Exception in getAlbums:', error);
            throw error;
        }
    }
    /**
     * Get photos from a specific album (or all photos if albumId is null)
     */
    async getPhotos(albumId, quantity = 50) {
        try {
            console.log('[Photos Debug] Getting photos - albumId:', albumId, 'quantity:', quantity);
            console.log('[Photos Debug] Parameter types - albumId:', typeof albumId, 'quantity:', typeof quantity);
            // Pass albumId directly - koffi handles null/undefined conversion to NULL pointer
            const albumParam = albumId || null;
            console.log('[Photos Debug] Processed albumParam:', albumParam, 'type:', typeof albumParam);
            const jsonResult = this.callStringFunction(() => this.ffiInterface.photos_get_photos(albumParam, quantity));
            const response = this.parseJsonResponse(jsonResult);
            return response.photos || [];
        }
        catch (error) {
            console.error('[Photos Debug] Error getting photos:', error);
            throw error;
        }
    }
    /**
     * Check if the library is ready for use
     */
    isReady() {
        return this.isInitialized && this.lib !== null && this.ffiInterface !== null;
    }
    /**
     * Cleanup resources (if needed)
     */
    dispose() {
        if (this.lib) {
            // koffi automatically handles library cleanup
            this.lib = null;
            this.ffiInterface = null;
            this.isInitialized = false;
        }
    }
}
exports.PhotosLibraryFFI = PhotosLibraryFFI;
// Export singleton instance
exports.photosLibraryFFI = new PhotosLibraryFFI();
