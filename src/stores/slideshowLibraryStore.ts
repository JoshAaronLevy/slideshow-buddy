/**
 * slideshowLibraryStore - Zustand store for managing the collection of saved slideshows
 */

import { create } from 'zustand';
import { SavedSlideshow, NewSlideshow, SlideshowUpdate } from '../types/slideshow';
import * as StorageService from '../services/StorageService';

interface SlideshowLibraryState {
  // State
  slideshows: SavedSlideshow[];
  selectedSlideshow: SavedSlideshow | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadSlideshows: () => Promise<void>;
  createSlideshow: (slideshow: NewSlideshow) => Promise<SavedSlideshow>;
  updateSlideshow: (update: SlideshowUpdate) => Promise<SavedSlideshow | null>;
  deleteSlideshow: (id: string) => Promise<boolean>;
  selectSlideshow: (slideshow: SavedSlideshow | null) => void;
  recordPlay: (id: string) => Promise<void>;
  setError: (error: string | null) => void;
  clearError: () => void;
}

/**
 * Slideshow library store
 * Manages the collection of saved slideshows with persistence
 */
export const useSlideshowLibraryStore = create<SlideshowLibraryState>((set) => ({
  // Initial state
  slideshows: [],
  selectedSlideshow: null,
  isLoading: false,
  error: null,

  /**
   * Load all slideshows from storage
   */
  loadSlideshows: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const slideshows = await StorageService.getSlideshows();
      
      // Sort by most recently updated first
      slideshows.sort((a, b) => b.updatedAt - a.updatedAt);
      
      set({ slideshows, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load slideshows';
      set({ error: errorMessage, isLoading: false });
    }
  },

  /**
   * Create a new slideshow
   * @param slideshow - New slideshow data
   * @returns The created slideshow with generated ID and timestamps
   */
  createSlideshow: async (slideshow: NewSlideshow) => {
    set({ isLoading: true, error: null });
    
    try {
      const newSlideshow = await StorageService.saveSlideshow(slideshow);
      
      set((state) => ({
        slideshows: [newSlideshow, ...state.slideshows],
        isLoading: false,
      }));

      return newSlideshow;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create slideshow';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  /**
   * Update an existing slideshow
   * @param update - Partial slideshow data with ID
   * @returns The updated slideshow or null if not found
   */
  updateSlideshow: async (update: SlideshowUpdate) => {
    set({ error: null });
    
    try {
      const updated = await StorageService.updateSlideshow(update);
      
      if (!updated) {
        set({ error: 'Slideshow not found' });
        return null;
      }

      set((state) => ({
        slideshows: state.slideshows.map(s => s.id === updated.id ? updated : s),
      }));

      return updated;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update slideshow';
      set({ error: errorMessage });
      throw error;
    }
  },

  /**
   * Delete a slideshow by ID
   * @param id - Slideshow ID to delete
   * @returns True if deleted, false if not found
   */
  deleteSlideshow: async (id: string) => {
    set({ error: null });
    
    try {
      const deleted = await StorageService.deleteSlideshow(id);
      
      if (!deleted) {
        set({ error: 'Slideshow not found' });
        return false;
      }

      set((state) => ({
        slideshows: state.slideshows.filter(s => s.id !== id),
        selectedSlideshow: state.selectedSlideshow?.id === id ? null : state.selectedSlideshow,
      }));

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete slideshow';
      set({ error: errorMessage });
      throw error;
    }
  },

  /**
   * Select a slideshow (for viewing/editing/playing)
   * @param slideshow - Slideshow to select, or null to deselect
   */
  selectSlideshow: (slideshow: SavedSlideshow | null) => {
    set({ selectedSlideshow: slideshow });
  },

  /**
   * Record that a slideshow was played
   * Updates play count and last played timestamp
   * @param id - Slideshow ID
   */
  recordPlay: async (id: string) => {
    try {
      await StorageService.recordSlideshowPlay(id);
      
      // Reload to get updated stats
      const slideshow = await StorageService.getSlideshow(id);
      if (slideshow) {
        set((state) => ({
          slideshows: state.slideshows.map(s => s.id === id ? slideshow : s),
        }));
      }
    } catch (error) {
      console.error('Failed to record slideshow play:', error);
      // Don't throw - this is not critical
    }
  },

  /**
   * Set error message
   * @param error - Error message or null to clear
   */
  setError: (error: string | null) => {
    set({ error });
  },

  /**
   * Clear error message
   */
  clearError: () => {
    set({ error: null });
  },
}));
