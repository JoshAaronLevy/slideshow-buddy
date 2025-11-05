/**
 * Photo Store - Manages photo library state using Zustand
 */

import { create } from 'zustand';
import { Photo } from '../types';
import { importPhotos as importPhotosService } from '../services/PhotoService';

interface PhotoState {
  // State
  photos: Photo[];
  selectedPhotos: Photo[];
  isLoading: boolean;
  error: string | null;

  // Actions
  importPhotos: () => Promise<void>;
  togglePhotoSelection: (photoId: string) => void;
  clearSelection: () => void;
  selectAll: () => void;
  removePhoto: (photoId: string) => void;
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
   * Import photos from the device library
   */
  importPhotos: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const importedPhotos = await importPhotosService();
      
      set((state) => ({
        photos: [...state.photos, ...importedPhotos],
        isLoading: false,
      }));
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
      const updatedPhotos = state.photos.filter((photo) => photo.id !== photoId);
      const selectedPhotos = updatedPhotos.filter((photo) => photo.selected);

      return {
        photos: updatedPhotos,
        selectedPhotos,
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
