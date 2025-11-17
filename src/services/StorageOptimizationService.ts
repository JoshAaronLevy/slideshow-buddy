/**
 * StorageOptimizationService - Handles storage optimization and quota management
 * Monitors storage usage, performs cleanup, and provides storage statistics
 */

import * as StorageService from './StorageService';
import * as PhotoLibraryService from './PhotoLibraryService';
import { Photo } from '../types';

// Storage quota constants (IndexedDB typical limits)
const STORAGE_WARNING_THRESHOLD = 0.8; // 80% usage
const STORAGE_CRITICAL_THRESHOLD = 0.95; // 95% usage
const ESTIMATED_QUOTA_MB = 1024; // Conservative estimate (browser dependent)

export interface StorageStats {
  totalPhotos: number;
  totalThumbnailSize: number;
  totalSlideshows: number;
  estimatedTotalSize: number;
  estimatedQuota: number;
  usagePercentage: number;
  isWarning: boolean;
  isCritical: boolean;
}

export interface CleanupRecommendations {
  unusedPhotos: Photo[];
  orphanedPhotos: Photo[];
  duplicateThumbnails: Photo[];
  estimatedSavings: number;
}

export interface CleanupResult {
  photosRemoved: number;
  spaceFreed: number;
  errors: string[];
}

/**
 * Calculate storage statistics
 * @returns Promise<StorageStats> - Detailed storage statistics
 */
export const getStorageStats = async (): Promise<StorageStats> => {
  try {
    const photos = await PhotoLibraryService.getLibraryPhotos();
    const slideshows = await StorageService.getSlideshows();
    
    // Calculate thumbnail sizes
    const totalThumbnailSize = photos.reduce((sum, photo) => {
      if (photo.thumbnailUri) {
        // Estimate base64 data URI size
        return sum + photo.thumbnailUri.length;
      }
      return sum;
    }, 0);
    
    // Estimate total storage (thumbnails + metadata)
    const metadataSize = JSON.stringify(photos).length + JSON.stringify(slideshows).length;
    const estimatedTotalSize = totalThumbnailSize + metadataSize;
    
    // Calculate quota usage
    const estimatedQuota = ESTIMATED_QUOTA_MB * 1024 * 1024; // Convert to bytes
    const usagePercentage = estimatedTotalSize / estimatedQuota;
    
    return {
      totalPhotos: photos.length,
      totalThumbnailSize,
      totalSlideshows: slideshows.length,
      estimatedTotalSize,
      estimatedQuota,
      usagePercentage,
      isWarning: usagePercentage >= STORAGE_WARNING_THRESHOLD,
      isCritical: usagePercentage >= STORAGE_CRITICAL_THRESHOLD,
    };
  } catch (error) {
    console.error('[StorageOptimizationService] Error calculating storage stats:', error);
    throw error;
  }
};

/**
 * Get cleanup recommendations based on usage analysis
 * @returns Promise<CleanupRecommendations> - Recommended cleanup actions
 */
export const getCleanupRecommendations = async (): Promise<CleanupRecommendations> => {
  try {
    const photos = await PhotoLibraryService.getLibraryPhotos();
    const slideshows = await StorageService.getSlideshows();
    
    // Build map of photos used in slideshows
    const usedPhotoIds = new Set<string>();
    slideshows.forEach(slideshow => {
      slideshow.photoIds.forEach(id => usedPhotoIds.add(id));
    });
    
    // Find unused photos
    const unusedPhotos = photos.filter(photo => !usedPhotoIds.has(photo.id));
    
    // Find orphaned photos (no original file)
    const validationResult = await PhotoLibraryService.validateLibraryPhotos(photos);
    const orphanedPhotos = validationResult.invalid;
    
    // Find potential duplicate thumbnails (same hash)
    const hashMap = new Map<string, Photo[]>();
    photos.forEach(photo => {
      if (photo.fileHash) {
        const existing = hashMap.get(photo.fileHash);
        if (existing) {
          existing.push(photo);
        } else {
          hashMap.set(photo.fileHash, [photo]);
        }
      }
    });
    
    const duplicateThumbnails: Photo[] = [];
    hashMap.forEach(photoList => {
      if (photoList.length > 1) {
        // Keep first, mark rest as duplicates
        duplicateThumbnails.push(...photoList.slice(1));
      }
    });
    
    // Estimate savings
    const estimatedSavings = 
      unusedPhotos.reduce((sum, p) => sum + (p.thumbnailUri?.length || 0), 0) +
      orphanedPhotos.reduce((sum, p) => sum + (p.thumbnailUri?.length || 0), 0) +
      duplicateThumbnails.reduce((sum, p) => sum + (p.thumbnailUri?.length || 0), 0);
    
    return {
      unusedPhotos,
      orphanedPhotos,
      duplicateThumbnails,
      estimatedSavings,
    };
  } catch (error) {
    console.error('[StorageOptimizationService] Error getting cleanup recommendations:', error);
    throw error;
  }
};

/**
 * Perform automatic cleanup of orphaned photos
 * Removes photos whose original files no longer exist
 * @returns Promise<CleanupResult> - Results of cleanup operation
 */
export const cleanupOrphanedPhotos = async (): Promise<CleanupResult> => {
  const result: CleanupResult = {
    photosRemoved: 0,
    spaceFreed: 0,
    errors: [],
  };
  
  try {
    const photos = await PhotoLibraryService.getLibraryPhotos();
    const validationResult = await PhotoLibraryService.validateLibraryPhotos(photos);
    
    if (validationResult.invalid.length === 0) {
      console.log('[StorageOptimizationService] No orphaned photos to clean up');
      return result;
    }
    
    // Calculate space to be freed
    const spaceToFree = validationResult.invalid.reduce((sum, photo) => {
      return sum + (photo.thumbnailUri?.length || 0);
    }, 0);
    
    // Delete orphaned photos
    const photoIdsToDelete = validationResult.invalid.map(p => p.id);
    const deleted = await PhotoLibraryService.deleteFromLibrary(photoIdsToDelete);
    
    if (deleted) {
      result.photosRemoved = photoIdsToDelete.length;
      result.spaceFreed = spaceToFree;
      console.log(`[StorageOptimizationService] Cleaned up ${result.photosRemoved} orphaned photos, freed ~${(result.spaceFreed / 1024).toFixed(2)} KB`);
    } else {
      result.errors.push('Failed to delete orphaned photos');
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error during cleanup';
    result.errors.push(errorMsg);
    console.error('[StorageOptimizationService] Error cleaning up orphaned photos:', error);
  }
  
  return result;
};

/**
 * Perform cleanup of unused photos
 * Removes photos not used in any slideshow
 * @param autoClean - If true, automatically removes unused photos; if false, returns recommendations only
 * @returns Promise<CleanupResult> - Results of cleanup operation
 */
export const cleanupUnusedPhotos = async (autoClean: boolean = false): Promise<CleanupResult> => {
  const result: CleanupResult = {
    photosRemoved: 0,
    spaceFreed: 0,
    errors: [],
  };
  
  try {
    const recommendations = await getCleanupRecommendations();
    
    if (recommendations.unusedPhotos.length === 0) {
      console.log('[StorageOptimizationService] No unused photos to clean up');
      return result;
    }
    
    if (!autoClean) {
      // Return recommendations without deleting
      console.log(`[StorageOptimizationService] Found ${recommendations.unusedPhotos.length} unused photos`);
      return result;
    }
    
    // Calculate space to be freed
    const spaceToFree = recommendations.unusedPhotos.reduce((sum, photo) => {
      return sum + (photo.thumbnailUri?.length || 0);
    }, 0);
    
    // Delete unused photos
    const photoIdsToDelete = recommendations.unusedPhotos.map(p => p.id);
    const deleted = await PhotoLibraryService.deleteFromLibrary(photoIdsToDelete);
    
    if (deleted) {
      result.photosRemoved = photoIdsToDelete.length;
      result.spaceFreed = spaceToFree;
      console.log(`[StorageOptimizationService] Cleaned up ${result.photosRemoved} unused photos, freed ~${(result.spaceFreed / 1024).toFixed(2)} KB`);
    } else {
      result.errors.push('Failed to delete unused photos');
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error during cleanup';
    result.errors.push(errorMsg);
    console.error('[StorageOptimizationService] Error cleaning up unused photos:', error);
  }
  
  return result;
};

/**
 * Check storage quota and return status
 * @returns Promise<{ isNearLimit: boolean; isCritical: boolean; usagePercentage: number }>
 */
export const checkStorageQuota = async (): Promise<{
  isNearLimit: boolean;
  isCritical: boolean;
  usagePercentage: number;
  message: string;
}> => {
  try {
    const stats = await getStorageStats();
    
    let message = '';
    if (stats.isCritical) {
      message = `Storage critically low (${(stats.usagePercentage * 100).toFixed(1)}%). Immediate cleanup recommended.`;
    } else if (stats.isWarning) {
      message = `Storage usage high (${(stats.usagePercentage * 100).toFixed(1)}%). Consider cleanup.`;
    } else {
      message = `Storage usage normal (${(stats.usagePercentage * 100).toFixed(1)}%).`;
    }
    
    return {
      isNearLimit: stats.isWarning,
      isCritical: stats.isCritical,
      usagePercentage: stats.usagePercentage,
      message,
    };
  } catch (error) {
    console.error('[StorageOptimizationService] Error checking storage quota:', error);
    return {
      isNearLimit: false,
      isCritical: false,
      usagePercentage: 0,
      message: 'Unable to check storage status',
    };
  }
};

/**
 * Format bytes to human-readable format
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

/**
 * Optimize storage by performing recommended cleanups
 * @returns Promise<CleanupResult> - Combined results of all cleanup operations
 */
export const optimizeStorage = async (): Promise<CleanupResult> => {
  console.log('[StorageOptimizationService] Starting storage optimization...');
  
  const result: CleanupResult = {
    photosRemoved: 0,
    spaceFreed: 0,
    errors: [],
  };
  
  try {
    // Step 1: Clean up orphaned photos
    const orphanedResult = await cleanupOrphanedPhotos();
    result.photosRemoved += orphanedResult.photosRemoved;
    result.spaceFreed += orphanedResult.spaceFreed;
    result.errors.push(...orphanedResult.errors);
    
    console.log(`[StorageOptimizationService] Optimization complete: ${result.photosRemoved} photos removed, ${formatBytes(result.spaceFreed)} freed`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error during optimization';
    result.errors.push(errorMsg);
    console.error('[StorageOptimizationService] Error during storage optimization:', error);
  }
  
  return result;
};
