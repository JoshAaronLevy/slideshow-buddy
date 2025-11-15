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

import * as koffi from 'koffi';
import * as path from 'path';
import { app } from 'electron';
import {
  SwiftPhotosLibraryFFI,
  PhotoAlbum,
  Photo,
  PhotosPermissionResponse,
  PhotoAlbumsResponse,
  PhotosResponse,
  PhotosLibraryError
} from './types';

class PhotosLibraryFFI {
  private lib: koffi.IKoffiLib | null = null;
  private ffiInterface: SwiftPhotosLibraryFFI | null = null;
  private isInitialized = false;

  constructor() {
    this.initializeLibrary();
  }

  /**
   * Initialize the Swift dynamic library and set up FFI bindings
   */
  private initializeLibrary(): void {
    try {
      // Determine library path - check multiple locations
      const possiblePaths = [
        // Development build location
        path.join(__dirname, '../../build/native/libPhotosLibraryBridge.dylib'),
        // Packaged app location
        path.join(app.getAppPath(), 'assets/libPhotosLibraryBridge.dylib'),
        // Alternative packaged location
        path.join(process.resourcesPath, 'libPhotosLibraryBridge.dylib')
      ];

      let libraryPath: string | null = null;
      for (const testPath of possiblePaths) {
        try {
          // Check if file exists
          require('fs').accessSync(testPath);
          libraryPath = testPath;
          break;
        } catch {
          // Continue to next path
        }
      }

      if (!libraryPath) {
        throw new PhotosLibraryError(
          'Swift Photos library not found. Make sure to run "npm run build:swift" first.',
          'LIBRARY_NOT_FOUND'
        );
      }

      // Load the dynamic library
      this.lib = koffi.load(libraryPath);

      // Define FFI function signatures
      // Note: Swift @_cdecl functions return char* (C strings) that need to be freed
      
      this.ffiInterface = {
        // Permission functions
        photos_request_permission: this.lib.func('photos_request_permission', 'char*', []),
        photos_check_permission: this.lib.func('photos_check_permission', 'char*', []),
        
        // Data retrieval functions
        photos_get_albums: this.lib.func('photos_get_albums', 'char*', []),
        photos_get_photos: this.lib.func('photos_get_photos', 'char*', [
          'char*', // albumId (nullable)
          'int32'  // quantity
        ])
      };

      this.isInitialized = true;
      console.log('Photos Library FFI initialized successfully');

    } catch (error) {
      console.error('Failed to initialize Photos Library FFI:', error);
      throw new PhotosLibraryError(
        `Failed to load Swift Photos library: ${error.message}`,
        'INITIALIZATION_FAILED'
      );
    }
  }

  /**
   * Call FFI function and handle C string memory management
   * Swift allocates strings with strdup() that need to be freed
   */
  private callStringFunction(fn: () => any): string {
    if (!this.isInitialized || !this.ffiInterface) {
      throw new PhotosLibraryError('FFI not initialized', 'NOT_INITIALIZED');
    }

    const stringPtr = fn();
    if (!stringPtr) {
      throw new PhotosLibraryError('Native function returned null', 'NULL_RESULT');
    }

    // Read the C string - koffi automatically handles CString conversion
    const result = koffi.decode(stringPtr, 'char*');
    
    // Free the memory allocated by Swift (strdup)
    // Note: We need to use C's free() function for strings created with strdup()
    koffi.free(stringPtr);
    
    return result;
  }

  /**
   * Parse JSON response and handle errors
   */
  private parseJsonResponse<T>(jsonString: string): T {
    try {
      const parsed = JSON.parse(jsonString);
      
      // Check for error in response
      if (parsed.error) {
        throw new PhotosLibraryError(parsed.error, 'SWIFT_ERROR');
      }
      
      return parsed;
    } catch (error) {
      if (error instanceof PhotosLibraryError) {
        throw error;
      }
      throw new PhotosLibraryError(
        `Failed to parse JSON response: ${error.message}`,
        'JSON_PARSE_ERROR'
      );
    }
  }

  /**
   * Request permission to access photos
   */
  public async requestPermission(): Promise<boolean> {
    try {
      const jsonResult = this.callStringFunction(() => 
        this.ffiInterface!.photos_request_permission()
      );
      
      // Swift returns "true" or "false" as string for this function
      return jsonResult === 'true';
    } catch (error) {
      console.error('Error requesting photos permission:', error);
      throw error;
    }
  }

  /**
   * Check current permission status
   */
  public checkPermission(): boolean {
    try {
      const jsonResult = this.callStringFunction(() => 
        this.ffiInterface!.photos_check_permission()
      );
      
      // Swift returns "true" or "false" as string for this function
      return jsonResult === 'true';
    } catch (error) {
      console.error('Error checking photos permission:', error);
      throw error;
    }
  }

  /**
   * Get photo albums from the library
   */
  public async getAlbums(): Promise<PhotoAlbum[]> {
    try {
      const jsonResult = this.callStringFunction(() => 
        this.ffiInterface!.photos_get_albums()
      );
      
      const response = this.parseJsonResponse<PhotoAlbumsResponse>(jsonResult);
      return response.albums || [];
    } catch (error) {
      console.error('Error getting photo albums:', error);
      throw error;
    }
  }

  /**
   * Get photos from a specific album (or all photos if albumId is null)
   */
  public async getPhotos(albumId?: string, quantity: number = 50): Promise<Photo[]> {
    try {
      const jsonResult = this.callStringFunction(() =>
        this.ffiInterface!.photos_get_photos(albumId || null, quantity)
      );
      
      const response = this.parseJsonResponse<PhotosResponse>(jsonResult);
      return response.photos || [];
    } catch (error) {
      console.error('Error getting photos:', error);
      throw error;
    }
  }

  /**
   * Check if the library is ready for use
   */
  public isReady(): boolean {
    return this.isInitialized && this.lib !== null && this.ffiInterface !== null;
  }

  /**
   * Cleanup resources (if needed)
   */
  public dispose(): void {
    if (this.lib) {
      // koffi automatically handles library cleanup
      this.lib = null;
      this.ffiInterface = null;
      this.isInitialized = false;
    }
  }
}

// Export singleton instance
export const photosLibraryFFI = new PhotosLibraryFFI();

// Export class for testing or multiple instances
export { PhotosLibraryFFI };