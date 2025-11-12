/**
 * Photo Store - Manages photo library state using Zustand
 */

import { create } from 'zustand';
import { Photo } from '../types';
import { importPhotos as importPhotosService, revokeBlobUrl } from '../services/PhotoService';
import * as StorageService from '../services/StorageService';

// Constants for cache management
const MAX_PHOTOS_IN_MEMORY = 100;
const MAX_MEMORY_MB = 50;

interface PhotoState {
  // State
  photos: Photo[];
  selectedPhotos: Photo[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadPhotos: () => Promise<void>;
  importPhotos: () => Promise<void>;
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

  /**
   * Load photos from persistent storage
   * Note: Blob URLs are ephemeral and won't work after app restart.
   * Photos should be re-imported from device library on app launch.
   * Persisted photos are mainly for slideshow references.
   */
  loadPhotos: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const photos = await StorageService.getPhotos();
      
      console.log(`[PhotoStore] Loaded ${photos.length} photos from storage`);
      console.warn('[PhotoStore] Note: Blob URLs from storage may be invalid. Re-import photos if needed.');
      
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
