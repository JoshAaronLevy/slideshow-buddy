/**
 * SlideshowService - Core slideshow functionality
 */

import { KeepAwake } from '@capacitor-community/keep-awake';

/**
 * Keep the screen awake during slideshow playback
 */
export const keepAwake = async (): Promise<void> => {
  try {
    await KeepAwake.keepAwake();
    console.log('Screen will stay awake');
  } catch (error) {
    console.error('Error keeping screen awake:', error);
  }
};

/**
 * Allow the screen to sleep again
 */
export const allowSleep = async (): Promise<void> => {
  try {
    await KeepAwake.allowSleep();
    console.log('Screen can sleep again');
  } catch (error) {
    console.error('Error allowing screen sleep:', error);
  }
};

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
