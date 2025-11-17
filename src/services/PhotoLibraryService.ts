/**
 * PhotoLibraryService - Manages photo library operations for macOS
 * Handles import, thumbnail generation, duplicate detection, and validation
 * 
 * macOS-specific implementation using Electron APIs
 */

import { Photo, PhotoImportResult, PhotoValidationResult, SelectedImageFile } from '../types';
import { isMacOS } from '../utils/platform';
import * as StorageService from './StorageService';

// Type for photoLibrary API
interface PhotoLibraryAPI {
  generateHash: (filePath: string) => Promise<{ success: boolean; hash?: string; error?: string }>;
  validateFile: (filePath: string) => Promise<{ success: boolean; exists?: boolean; error?: string }>;
  getFileSize: (filePath: string) => Promise<{ success: boolean; size?: number; error?: string }>;
}

// Helper to get photoLibrary API safely
const getPhotoLibraryAPI = (): PhotoLibraryAPI | null => {
  if (!isMacOS()) return null;
  const electron = (window as Window & { electron?: { photoLibrary?: PhotoLibraryAPI } }).electron;
  return electron?.photoLibrary || null;
};

// Thumbnail configuration
const THUMBNAIL_MAX_SIZE = 512; // pixels
const THUMBNAIL_QUALITY = 0.8; // 80% JPEG quality

/**
 * Generate a hash from file content for duplicate detection
 * Uses Electron IPC to compute hash on main process
 * @param filePath - Absolute path to the file
 * @returns Promise<string> - SHA256 hash of file content
 */
export const generatePhotoHash = async (filePath: string): Promise<string> => {
  const photoLibraryAPI = getPhotoLibraryAPI();
  if (!photoLibraryAPI) {
    throw new Error('Photo hash generation only available on macOS');
  }

  try {
    const result = await photoLibraryAPI.generateHash(filePath);
    if (!result.success) {
      throw new Error(result.error || 'Failed to generate photo hash');
    }
    return result.hash!;
  } catch (error) {
    console.error('[PhotoLibraryService] Error generating hash:', error);
    throw error;
  }
};

/**
 * Generate a compressed thumbnail from an image file
 * Uses canvas API to resize and compress
 * @param dataUri - Original image data URI
 * @param filename - Original filename for logging
 * @returns Promise<string> - Compressed thumbnail as data URI
 */
export const generateThumbnail = async (
  dataUri: string,
  filename: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      try {
        // Calculate dimensions maintaining aspect ratio
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > THUMBNAIL_MAX_SIZE) {
            height = (height * THUMBNAIL_MAX_SIZE) / width;
            width = THUMBNAIL_MAX_SIZE;
          }
        } else {
          if (height > THUMBNAIL_MAX_SIZE) {
            width = (width * THUMBNAIL_MAX_SIZE) / height;
            height = THUMBNAIL_MAX_SIZE;
          }
        }
        
        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to JPEG with specified quality
        const thumbnailDataUri = canvas.toDataURL('image/jpeg', THUMBNAIL_QUALITY);
        
        console.log(`[PhotoLibraryService] Generated thumbnail for ${filename}: ${Math.round(thumbnailDataUri.length / 1024)}KB`);
        resolve(thumbnailDataUri);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error(`Failed to load image: ${filename}`));
    };
    
    img.src = dataUri;
  });
};

/**
 * Validate that a photo file still exists at its original path
 * @param filePath - Absolute path to the file
 * @returns Promise<boolean> - true if file exists, false otherwise
 */
export const validatePhotoExists = async (filePath: string): Promise<boolean> => {
  const photoLibraryAPI = getPhotoLibraryAPI();
  if (!photoLibraryAPI) {
    console.warn('[PhotoLibraryService] File validation only available on macOS');
    return false;
  }

  try {
    const result = await photoLibraryAPI.validateFile(filePath);
    return result.success && (result.exists || false);
  } catch (error) {
    console.error('[PhotoLibraryService] Error validating file:', error);
    return false;
  }
};

/**
 * Import photos to the library with thumbnail generation and duplicate detection
 * @param files - Array of selected image files
 * @returns Promise<PhotoImportResult> - Import results with success/failure counts
 */
export const importPhotosToLibrary = async (
  files: SelectedImageFile[]
): Promise<PhotoImportResult> => {
  if (!isMacOS()) {
    throw new Error('Photo library import only available on macOS');
  }

  const result: PhotoImportResult = {
    success: false,
    imported: [],
    duplicates: 0,
    failed: 0,
    errors: [],
  };

  if (files.length === 0) {
    result.success = true;
    return result;
  }

  console.log(`[PhotoLibraryService] Starting import of ${files.length} photos...`);

  // Get existing photos to check for duplicates
  const existingPhotos = await StorageService.getPhotos();
  const existingHashes = new Set(
    existingPhotos
      .map(p => p.fileHash)
      .filter((hash): hash is string => hash !== undefined)
  );
  const existingPaths = new Set(
    existingPhotos
      .map(p => p.originalPath)
      .filter((path): path is string => path !== undefined)
  );

  // Process each file
  for (const file of files) {
    try {
      // Check for duplicate by path first (fastest)
      if (existingPaths.has(file.path)) {
        console.log(`[PhotoLibraryService] Skipping duplicate (by path): ${file.filename}`);
        result.duplicates++;
        continue;
      }

      // Generate hash for content-based duplicate detection
      let fileHash: string | undefined;
      try {
        fileHash = await generatePhotoHash(file.path);
        
        // Check for duplicate by hash
        if (existingHashes.has(fileHash)) {
          console.log(`[PhotoLibraryService] Skipping duplicate (by hash): ${file.filename}`);
          result.duplicates++;
          continue;
        }
      } catch {
        console.warn(`[PhotoLibraryService] Failed to generate hash for ${file.filename}, continuing without hash`);
        // Continue without hash - better to import than fail
      }

      // Generate thumbnail
      const thumbnailUri = await generateThumbnail(file.uri, file.filename);

      // Get file size
      let fileSize: number | undefined;
      try {
        const photoLibraryAPI = getPhotoLibraryAPI();
        if (photoLibraryAPI) {
          const sizeResult = await photoLibraryAPI.getFileSize(file.path);
          if (sizeResult?.success) {
            fileSize = sizeResult.size;
          }
        }
      } catch {
        console.warn(`[PhotoLibraryService] Failed to get file size for ${file.filename}`);
      }

      // Create photo object with library metadata
      const photo: Photo = {
        id: file.id,
        uri: thumbnailUri, // Use thumbnail for display
        filename: file.filename,
        timestamp: Date.now(),
        selected: false,
        // Library-specific fields
        originalPath: file.path,
        thumbnailUri,
        fileHash,
        importedAt: Date.now(),
        fileSize,
      };

      result.imported.push(photo);
      
      console.log(`[PhotoLibraryService] Successfully imported: ${file.filename}`);
    } catch (error) {
      console.error(`[PhotoLibraryService] Failed to import ${file.filename}:`, error);
      result.failed++;
      result.errors?.push(`${file.filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Save imported photos to storage
  if (result.imported.length > 0) {
    try {
      await StorageService.savePhotos(result.imported);
      result.success = true;
      console.log(`[PhotoLibraryService] Import complete: ${result.imported.length} imported, ${result.duplicates} duplicates, ${result.failed} failed`);
    } catch (error) {
      console.error('[PhotoLibraryService] Failed to save photos to storage:', error);
      result.success = false;
      result.errors?.push('Failed to save photos to storage');
    }
  } else {
    // No photos imported, but not necessarily an error
    result.success = result.failed === 0;
  }

  return result;
};

/**
 * Get all photos from the library
 * @returns Promise<Photo[]> - Array of library photos
 */
export const getLibraryPhotos = async (): Promise<Photo[]> => {
  try {
    const photos = await StorageService.getPhotos();
    console.log(`[PhotoLibraryService] Retrieved ${photos.length} photos from library`);
    return photos;
  } catch (error) {
    console.error('[PhotoLibraryService] Error getting library photos:', error);
    return [];
  }
};

/**
 * Delete photos from the library (app-only, preserves original files)
 * @param photoIds - Array of photo IDs to delete
 * @returns Promise<boolean> - true if any photos were deleted
 */
export const deleteFromLibrary = async (photoIds: string[]): Promise<boolean> => {
  if (photoIds.length === 0) {
    return false;
  }

  try {
    const result = await StorageService.deletePhotos(photoIds);
    
    if (result) {
      console.log(`[PhotoLibraryService] Deleted ${photoIds.length} photos from library (originals preserved)`);
    }
    
    return result;
  } catch (error) {
    console.error('[PhotoLibraryService] Error deleting photos from library:', error);
    return false;
  }
};

/**
 * Validate library photos and identify missing files
 * @param photos - Array of photos to validate (defaults to all library photos)
 * @returns Promise<PhotoValidationResult> - Validation results
 */
export const validateLibraryPhotos = async (
  photos?: Photo[]
): Promise<PhotoValidationResult> => {
  const photosToValidate = photos || await getLibraryPhotos();
  
  const result: PhotoValidationResult = {
    valid: [],
    invalid: [],
    missing: [],
  };

  if (!isMacOS()) {
    // On non-macOS platforms, assume all photos are valid
    result.valid = photosToValidate;
    return result;
  }

  console.log(`[PhotoLibraryService] Validating ${photosToValidate.length} photos...`);

  for (const photo of photosToValidate) {
    // Only validate photos that have original paths (library photos)
    if (!photo.originalPath) {
      result.valid.push(photo);
      continue;
    }

    const exists = await validatePhotoExists(photo.originalPath);
    
    if (exists) {
      result.valid.push(photo);
    } else {
      result.invalid.push(photo);
      result.missing.push(photo.id);
      console.warn(`[PhotoLibraryService] Photo file missing: ${photo.filename} (${photo.originalPath})`);
    }
  }

  console.log(`[PhotoLibraryService] Validation complete: ${result.valid.length} valid, ${result.invalid.length} invalid`);
  
  return result;
};

/**
 * Get library statistics
 * @returns Promise<object> - Library statistics
 */
export const getLibraryStats = async (): Promise<{
  totalPhotos: number;
  totalThumbnailSize: number;
  oldestImport?: number;
  newestImport?: number;
}> => {
  const photos = await getLibraryPhotos();
  
  const importDates = photos
    .map(p => p.importedAt)
    .filter((date): date is number => date !== undefined);
  
  const thumbnailSizes = photos
    .map(p => p.thumbnailUri ? p.thumbnailUri.length : 0)
    .reduce((sum, size) => sum + size, 0);
  
  return {
    totalPhotos: photos.length,
    totalThumbnailSize: thumbnailSizes,
    oldestImport: importDates.length > 0 ? Math.min(...importDates) : undefined,
    newestImport: importDates.length > 0 ? Math.max(...importDates) : undefined,
  };
};
