/**
 * slideshowStore - Zustand store for managing slideshow state
 */

import { create } from 'zustand';
import { Photo } from '../types';
import { SLIDESHOW_DEFAULTS } from '../constants';

interface SlideshowConfig {
  shuffle: boolean;
  transitionTime: number; // in seconds
  loop: boolean;
}

interface SlideshowState {
  // Configuration
  config: SlideshowConfig;
  
  // Playback state
  isPlaying: boolean;
  isPaused: boolean;
  currentIndex: number;
  photos: Photo[]; // Ordered photos for playback (may be shuffled)
  
  // UI state
  showPlayer: boolean;
  
  // Actions
  updateConfig: (config: Partial<SlideshowConfig>) => void;
  start: (selectedPhotos: Photo[]) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  next: () => void;
  previous: () => void;
  goToIndex: (index: number) => void;
  reset: () => void;
}

const initialConfig: SlideshowConfig = {
  shuffle: SLIDESHOW_DEFAULTS.SHUFFLE_ENABLED,
  transitionTime: SLIDESHOW_DEFAULTS.TRANSITION_TIME,
  loop: SLIDESHOW_DEFAULTS.LOOP_ENABLED,
};

const initialState = {
  config: initialConfig,
  isPlaying: false,
  isPaused: false,
  currentIndex: 0,
  photos: [],
  showPlayer: false,
};

export const useSlideshowStore = create<SlideshowState>((set, get) => ({
  ...initialState,

  updateConfig: (newConfig: Partial<SlideshowConfig>) => {
    set((state) => ({
      config: { ...state.config, ...newConfig },
    }));
  },

  start: (selectedPhotos: Photo[]) => {
    const { config } = get();
    
    if (selectedPhotos.length === 0) {
      console.error('Cannot start slideshow: no photos provided');
      return;
    }

    // Create a copy and optionally shuffle
    const orderedPhotos = [...selectedPhotos];
    if (config.shuffle) {
      // Fisher-Yates shuffle algorithm
      for (let i = orderedPhotos.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [orderedPhotos[i], orderedPhotos[j]] = [orderedPhotos[j], orderedPhotos[i]];
      }
    }

    set({
      photos: orderedPhotos,
      currentIndex: 0,
      isPlaying: true,
      isPaused: false,
      showPlayer: true,
    });
  },

  pause: () => {
    set({ isPaused: true, isPlaying: false });
  },

  resume: () => {
    set({ isPaused: false, isPlaying: true });
  },

  stop: () => {
    set({
      isPlaying: false,
      isPaused: false,
      showPlayer: false,
      currentIndex: 0,
    });
  },

  next: () => {
    const { currentIndex, photos, config } = get();
    
    if (currentIndex < photos.length - 1) {
      set({ currentIndex: currentIndex + 1 });
    } else if (config.loop) {
      // Loop back to start
      set({ currentIndex: 0 });
    } else {
      // End of slideshow
      get().stop();
    }
  },

  previous: () => {
    const { currentIndex, photos, config } = get();
    
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1 });
    } else if (config.loop) {
      // Loop to end
      set({ currentIndex: photos.length - 1 });
    }
  },

  goToIndex: (index: number) => {
    const { photos } = get();
    if (index >= 0 && index < photos.length) {
      set({ currentIndex: index });
    }
  },

  reset: () => {
    set(initialState);
  },
}));
