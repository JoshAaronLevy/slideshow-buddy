/**
 * Photo Store - Manages photo library state using Zustand
 */

import { create } from 'zustand';
import { Photo, PhotoImportResult, PhotoValidationResult } from '../types';
import { importPhotos as importPhotosService, revokeBlobUrl, selectImageFilesForImport } from '../services/PhotoService';
import * as PhotoLibraryService from '../services/PhotoLibraryService';
import * as StorageService from '../services/StorageService';
import { isMacOS } from '../utils/platform';

// Constants for cache management
const MAX_PHOTOS_IN_MEMORY = 100;
const MAX_MEMORY_MB = 50;

interface PhotoState {
  // State
  photos: Photo[];
  selectedPhotos: Photo[];
  isLoading: boolean;
  error: string | null;
  lastImportResult: PhotoImportResult | null;
  lastValidationResult: PhotoValidationResult | null;

  // Actions
  loadPhotos: () => Promise<void>;
  importPhotos: () => Promise<void>;
  importPhotosToLibrary: () => Promise<PhotoImportResult>;
  validateLibraryPhotos: () => Promise<PhotoValidationResult>;
  togglePhotoSelection: (photoId: string) => void;
  clearSelection: () => void;
  selectAll: () => void;
  removePhoto: (photoId: string) => void;
  clearAllPhotos: () => void;
  setError: (error: string | null) => void;
}

/**
 * Photo store with Zustand
 * Manages the photo library and selection state
 */
export const usePhotoStore = create<PhotoState>((set) => ({
  // Initial state
  photos: [],
  selectedPhotos: [],
  isLoading: false,
  error: null,
  lastImportResult: null,
  lastValidationResult: null,

  /**
   * Load photos from persistent storage
   * For macOS: Loads library photos with thumbnails
   * For iOS/Android: Blob URLs are ephemeral and won't work after app restart
   */
  loadPhotos: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const photos = await PhotoLibraryService.getLibraryPhotos();
      
      console.log(`[PhotoStore] Loaded ${photos.length} photos from library`);
      
      // On macOS, library photos have thumbnails that persist
      // On iOS/Android, warn about blob URL limitations
      if (!isMacOS() && photos.length > 0) {
        console.warn('[PhotoStore] Note: Blob URLs from storage may be invalid. Re-import photos if needed.');
      }
      
      set({ 
        photos,
        isLoading: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load photos';
      set({ 
        error: errorMessage,
        isLoading: false,
      });
    }
  },

  /**
   * Import photos from the device library and persist them
   * Legacy method - uses device photo library (iOS/Android)
   * For macOS library import, use importPhotosToLibrary()
   */
  importPhotos: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const importedPhotos = await importPhotosService();
      
      // Save to persistent storage
      const allPhotos = await StorageService.savePhotos(importedPhotos);
      
      // Implement cache eviction if over limit
      let finalPhotos = allPhotos;
      if (allPhotos.length > MAX_PHOTOS_IN_MEMORY) {
        const photosToRemove = allPhotos.slice(0, allPhotos.length - MAX_PHOTOS_IN_MEMORY);
        
        console.warn(`[PhotoStore] Evicting ${photosToRemove.length} oldest photos (over limit of ${MAX_PHOTOS_IN_MEMORY})`);
        
        // Revoke blob URLs for evicted photos
        photosToRemove.forEach(photo => {
          if (photo.uri) {
            revokeBlobUrl(photo.uri);
          }
        });
        
        // Keep only the most recent photos
        finalPhotos = allPhotos.slice(-MAX_PHOTOS_IN_MEMORY);
        
        console.log(`[PhotoStore] Cache after eviction: ${finalPhotos.length} photos`);
      }
      
      set({
        photos: finalPhotos,
        isLoading: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to import photos';
      set({ 
        error: errorMessage,
        isLoading: false,
      });
    }
  },

  /**
   * Import photos to library (macOS-specific)
   * Opens file dialog, processes files with thumbnails and duplicate detection
   * @returns PhotoImportResult with detailed import statistics
   */
  importPhotosToLibrary: async (): Promise<PhotoImportResult> => {
    set({ isLoading: true, error: null });
    
    try {
      // Open file dialog to select photos
      const selectedFiles = await selectImageFilesForImport();
      
      if (selectedFiles.length === 0) {
        const emptyResult: PhotoImportResult = {
          success: true,
          imported: [],
          duplicates: 0,
          failed: 0,
        };
        set({ isLoading: false, lastImportResult: emptyResult });
        return emptyResult;
      }

      // Import photos with thumbnail generation and duplicate detection
      const importResult = await PhotoLibraryService.importPhotosToLibrary(selectedFiles);
      
      // Reload photos from library
      const allPhotos = await PhotoLibraryService.getLibraryPhotos();
      
      // Update metadata
      await StorageService.updatePhotoLibraryMetadata();
      
      set({
        photos: allPhotos,
        isLoading: false,
        lastImportResult: importResult,
      });
      
      return importResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to import photos to library';
      const failedResult: PhotoImportResult = {
        success: false,
        imported: [],
        duplicates: 0,
        failed: 0,
        errors: [errorMessage],
      };
      
      set({ 
        error: errorMessage,
        isLoading: false,
        lastImportResult: failedResult,
      });
      
      return failedResult;
    }
  },

  /**
   * Validate library photos to check if original files still exist
   * @returns PhotoValidationResult with valid/invalid photo lists
   */
  validateLibraryPhotos: async (): Promise<PhotoValidationResult> => {
    set({ isLoading: true, error: null });
    
    try {
      const validationResult = await PhotoLibraryService.validateLibraryPhotos();
      
      set({
        isLoading: false,
        lastValidationResult: validationResult,
      });
      
      // If there are invalid photos, optionally update the store
      if (validationResult.invalid.length > 0) {
        console.warn(`[PhotoStore] Found ${validationResult.invalid.length} photos with missing files`);
      }
      
      return validationResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to validate photos';
      const emptyResult: PhotoValidationResult = {
        valid: [],
        invalid: [],
        missing: [],
      };
      
      set({ 
        error: errorMessage,
        isLoading: false,
        lastValidationResult: emptyResult,
      });
      
      return emptyResult;
    }
  },

  /**
   * Toggle selection state of a photo
   * @param photoId - ID of the photo to toggle
   */
  togglePhotoSelection: (photoId: string) => {
    set((state) => {
      const updatedPhotos = state.photos.map((photo) =>
        photo.id === photoId
          ? { ...photo, selected: !photo.selected }
          : photo
      );

      const selectedPhotos = updatedPhotos.filter((photo) => photo.selected);

      return {
        photos: updatedPhotos,
        selectedPhotos,
      };
    });
  },

  /**
   * Clear all photo selections
   */
  clearSelection: () => {
    set((state) => ({
      photos: state.photos.map((photo) => ({ ...photo, selected: false })),
      selectedPhotos: [],
    }));
  },

  /**
   * Select all photos
   */
  selectAll: () => {
    set((state) => {
      const updatedPhotos = state.photos.map((photo) => ({
        ...photo,
        selected: true,
      }));

      return {
        photos: updatedPhotos,
        selectedPhotos: [...updatedPhotos],
      };
    });
  },

  /**
   * Remove a photo from the library
   * @param photoId - ID of the photo to remove
   */
  removePhoto: (photoId: string) => {
    set((state) => {
      // Find the photo to revoke its blob URL
      const photoToRemove = state.photos.find((photo) => photo.id === photoId);
      
      if (photoToRemove?.uri) {
        console.log('[PhotoStore] Revoking blob URL for removed photo');
        revokeBlobUrl(photoToRemove.uri);
      }
      
      const updatedPhotos = state.photos.filter((photo) => photo.id !== photoId);
      const selectedPhotos = updatedPhotos.filter((photo) => photo.selected);

      return {
        photos: updatedPhotos,
        selectedPhotos,
      };
    });
  },
  
  /**
   * Clear all photos and revoke all blob URLs
   */
  clearAllPhotos: () => {
    set((state) => {
      console.log(`[PhotoStore] Clearing all photos and revoking ${state.photos.length} blob URLs`);
      
      // Revoke all blob URLs
      state.photos.forEach(photo => {
        if (photo.uri) {
          revokeBlobUrl(photo.uri);
        }
      });
      
      return {
        photos: [],
        selectedPhotos: [],
      };
    });
  },

  /**
   * Set error message
   * @param error - Error message or null to clear
   */
  setError: (error: string | null) => {
    set({ error });
  },
}));
