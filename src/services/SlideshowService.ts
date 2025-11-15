/**
 * SlideshowService - Core slideshow functionality
 */

import { KeepAwake } from '@capacitor-community/keep-awake';
import { isMacOS } from '../utils/platform';

/**
 * Activate keep-awake functionality during slideshow playback
 * Uses Electron powerSaveBlocker on macOS, Capacitor KeepAwake on mobile
 */
export const activateKeepAwake = async (): Promise<void> => {
  try {
    if (isMacOS() && window.electron?.slideshow) {
      // Use Electron powerSaveBlocker on macOS
      const result = await window.electron.slideshow.keepAwakeStart();
      if (result.success) {
        console.log('PowerSave blocker activated:', result.message);
      } else {
        console.error('Failed to activate power save blocker:', result.error);
        // Fallback to KeepAwake if available
        await KeepAwake.keepAwake();
      }
    } else {
      // Use Capacitor KeepAwake on mobile platforms
      await KeepAwake.keepAwake();
      console.log('Screen will stay awake');
    }
  } catch (error) {
    console.error('Error activating keep-awake:', error);
    // Try fallback if not already attempted
    if (isMacOS()) {
      try {
        await KeepAwake.keepAwake();
      } catch (fallbackError) {
        console.error('Fallback keep-awake also failed:', fallbackError);
      }
    }
  }
};

/**
 * Deactivate keep-awake functionality after slideshow
 * Cleans up Electron powerSaveBlocker on macOS, Capacitor KeepAwake on mobile
 */
export const deactivateKeepAwake = async (): Promise<void> => {
  try {
    if (isMacOS() && window.electron?.slideshow) {
      // Clean up Electron powerSaveBlocker on macOS
      const result = await window.electron.slideshow.keepAwakeStop();
      if (result.success) {
        console.log('PowerSave blocker deactivated:', result.message);
      } else {
        console.error('Failed to deactivate power save blocker:', result.error);
        // Fallback to KeepAwake cleanup if available
        await KeepAwake.allowSleep();
      }
    } else {
      // Use Capacitor KeepAwake on mobile platforms
      await KeepAwake.allowSleep();
      console.log('Screen can sleep again');
    }
  } catch (error) {
    console.error('Error deactivating keep-awake:', error);
    // Try fallback cleanup if not already attempted
    if (isMacOS()) {
      try {
        await KeepAwake.allowSleep();
      } catch (fallbackError) {
        console.error('Fallback keep-awake cleanup also failed:', fallbackError);
      }
    }
  }
};

/**
 * @deprecated Use activateKeepAwake() instead
 * Keep the screen awake during slideshow playback
 */
export const keepAwake = activateKeepAwake;

/**
 * @deprecated Use deactivateKeepAwake() instead
 * Allow the screen to sleep again
 */
export const allowSleep = deactivateKeepAwake;

/**
 * Preload an image to ensure smooth transitions
 * @param url - Image URL to preload
 * @returns Promise that resolves when image is loaded
 */
export const preloadImage = (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      resolve();
    };
    
    img.onerror = (error) => {
      console.error(`Failed to preload image: ${url}`, error);
      reject(error);
    };
    
    img.src = url;
  });
};

/**
 * Preload multiple images
 * @param urls - Array of image URLs to preload
 * @returns Promise that resolves when all images are loaded
 */
export const preloadImages = async (urls: string[]): Promise<void> => {
  try {
    await Promise.all(urls.map((url) => preloadImage(url)));
    console.log(`Preloaded ${urls.length} images`);
  } catch (error) {
    console.error('Error preloading images:', error);
    // Don't throw - continue even if some images fail
  }
};

/**
 * Preload the next N images for smoother playback
 * @param photos - Array of photo objects
 * @param currentIndex - Current photo index
 * @param count - Number of images to preload ahead (default: 2)
 */
export const preloadNextImages = async (
  photos: Array<{ uri: string }>,
  currentIndex: number,
  count: number = 2
): Promise<void> => {
  const urlsToPreload: string[] = [];
  
  for (let i = 1; i <= count; i++) {
    const nextIndex = currentIndex + i;
    if (nextIndex < photos.length) {
      urlsToPreload.push(photos[nextIndex].uri);
    }
  }
  
  if (urlsToPreload.length > 0) {
    await preloadImages(urlsToPreload);
  }
};

/**
 * Format time in seconds to MM:SS
 * @param seconds - Time in seconds
 * @returns Formatted time string
 */
export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Calculate total slideshow duration
 * @param photoCount - Number of photos
 * @param transitionTime - Transition time per photo in seconds
 * @returns Total duration in seconds
 */
export const calculateDuration = (
  photoCount: number,
  transitionTime: number
): number => {
  return photoCount * transitionTime;
};
