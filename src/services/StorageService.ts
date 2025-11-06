/**
 * StorageService - Handles persistent storage using Capacitor Preferences
 * All data is stored as JSON in key-value pairs
 */

import { Preferences } from '@capacitor/preferences';
import { SavedSlideshow, NewSlideshow, SlideshowUpdate } from '../types/slideshow';
import { CustomPlaylist, NewPlaylist, PlaylistUpdate } from '../types/playlist';
import { Photo } from '../types';
import { STORAGE_KEYS } from '../constants';

/**
 * Generate a unique ID using timestamp + random string
 */
const generateId = (): string => {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Generate a default slideshow name with current date
 * Format: "Slideshow-Nov-5-2024"
 */
export const generateSlideshowName = (): string => {
  const date = new Date();
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();
  const year = date.getFullYear();
  return `Slideshow-${month}-${day}-${year}`;
};

/**
 * Generate a default playlist name with current date
 * Format: "Playlist-Nov-5-2024"
 */
export const generatePlaylistName = (): string => {
  const date = new Date();
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();
  const year = date.getFullYear();
  return `Playlist-${month}-${day}-${year}`;
};

// ============================================================================
// SLIDESHOW STORAGE
// ============================================================================

/**
 * Get all saved slideshows
 */
export const getSlideshows = async (): Promise<SavedSlideshow[]> => {
  try {
    const { value } = await Preferences.get({ key: STORAGE_KEYS.SLIDESHOWS });
    if (!value) return [];
    
    const slideshows = JSON.parse(value) as SavedSlideshow[];
    return slideshows;
  } catch (error) {
    console.error('Error getting slideshows:', error);
    return [];
  }
};

/**
 * Get a single slideshow by ID
 */
export const getSlideshow = async (id: string): Promise<SavedSlideshow | null> => {
  const slideshows = await getSlideshows();
  return slideshows.find(s => s.id === id) || null;
};

/**
 * Save a new slideshow
 */
export const saveSlideshow = async (slideshow: NewSlideshow): Promise<SavedSlideshow> => {
  const now = Date.now();
  const newSlideshow: SavedSlideshow = {
    ...slideshow,
    id: slideshow.id || generateId(),
    createdAt: slideshow.createdAt || now,
    updatedAt: now,
    playCount: slideshow.playCount || 0,
  };

  const slideshows = await getSlideshows();
  slideshows.push(newSlideshow);
  
  await Preferences.set({
    key: STORAGE_KEYS.SLIDESHOWS,
    value: JSON.stringify(slideshows),
  });

  return newSlideshow;
};

/**
 * Update an existing slideshow
 */
export const updateSlideshow = async (update: SlideshowUpdate): Promise<SavedSlideshow | null> => {
  const slideshows = await getSlideshows();
  const index = slideshows.findIndex(s => s.id === update.id);
  
  if (index === -1) return null;

  const updatedSlideshow: SavedSlideshow = {
    ...slideshows[index],
    ...update,
    updatedAt: Date.now(),
  };

  slideshows[index] = updatedSlideshow;
  
  await Preferences.set({
    key: STORAGE_KEYS.SLIDESHOWS,
    value: JSON.stringify(slideshows),
  });

  return updatedSlideshow;
};

/**
 * Delete a slideshow by ID
 */
export const deleteSlideshow = async (id: string): Promise<boolean> => {
  const slideshows = await getSlideshows();
  const filtered = slideshows.filter(s => s.id !== id);
  
  if (filtered.length === slideshows.length) {
    return false; // No slideshow found with that ID
  }

  await Preferences.set({
    key: STORAGE_KEYS.SLIDESHOWS,
    value: JSON.stringify(filtered),
  });

  return true;
};

/**
 * Increment play count and update lastPlayedAt for a slideshow
 */
export const recordSlideshowPlay = async (id: string): Promise<void> => {
  const slideshow = await getSlideshow(id);
  if (!slideshow) return;

  await updateSlideshow({
    id,
    playCount: slideshow.playCount + 1,
    lastPlayedAt: Date.now(),
  });
};

// ============================================================================
// PLAYLIST STORAGE
// ============================================================================

/**
 * Get all custom playlists
 */
export const getPlaylists = async (): Promise<CustomPlaylist[]> => {
  try {
    const { value } = await Preferences.get({ key: STORAGE_KEYS.CUSTOM_PLAYLISTS });
    if (!value) return [];
    
    const playlists = JSON.parse(value) as CustomPlaylist[];
    return playlists;
  } catch (error) {
    console.error('Error getting playlists:', error);
    return [];
  }
};

/**
 * Get a single playlist by ID
 */
export const getPlaylist = async (id: string): Promise<CustomPlaylist | null> => {
  const playlists = await getPlaylists();
  return playlists.find(p => p.id === id) || null;
};

/**
 * Save a new playlist
 */
export const savePlaylist = async (playlist: NewPlaylist): Promise<CustomPlaylist> => {
  const now = Date.now();
  const newPlaylist: CustomPlaylist = {
    ...playlist,
    id: playlist.id || generateId(),
    createdAt: playlist.createdAt || now,
    updatedAt: now,
  };

  const playlists = await getPlaylists();
  playlists.push(newPlaylist);
  
  await Preferences.set({
    key: STORAGE_KEYS.CUSTOM_PLAYLISTS,
    value: JSON.stringify(playlists),
  });

  return newPlaylist;
};

/**
 * Update an existing playlist
 */
export const updatePlaylist = async (update: PlaylistUpdate): Promise<CustomPlaylist | null> => {
  const playlists = await getPlaylists();
  const index = playlists.findIndex(p => p.id === update.id);
  
  if (index === -1) return null;

  const updatedPlaylist: CustomPlaylist = {
    ...playlists[index],
    ...update,
    updatedAt: Date.now(),
  };

  playlists[index] = updatedPlaylist;
  
  await Preferences.set({
    key: STORAGE_KEYS.CUSTOM_PLAYLISTS,
    value: JSON.stringify(playlists),
  });

  return updatedPlaylist;
};

/**
 * Delete a playlist by ID
 */
export const deletePlaylist = async (id: string): Promise<boolean> => {
  const playlists = await getPlaylists();
  const filtered = playlists.filter(p => p.id !== id);
  
  if (filtered.length === playlists.length) {
    return false; // No playlist found with that ID
  }

  await Preferences.set({
    key: STORAGE_KEYS.CUSTOM_PLAYLISTS,
    value: JSON.stringify(filtered),
  });

  return true;
};

// ============================================================================
// PHOTO LIBRARY STORAGE
// ============================================================================

/**
 * Get all photos in the library
 */
export const getPhotos = async (): Promise<Photo[]> => {
  try {
    const { value } = await Preferences.get({ key: STORAGE_KEYS.PHOTO_LIBRARY });
    if (!value) return [];
    
    const photos = JSON.parse(value) as Photo[];
    return photos;
  } catch (error) {
    console.error('Error getting photos:', error);
    return [];
  }
};

/**
 * Save photos to the library
 * Appends new photos to existing library
 */
export const savePhotos = async (newPhotos: Photo[]): Promise<Photo[]> => {
  const existingPhotos = await getPhotos();
  const allPhotos = [...existingPhotos, ...newPhotos];
  
  await Preferences.set({
    key: STORAGE_KEYS.PHOTO_LIBRARY,
    value: JSON.stringify(allPhotos),
  });

  return allPhotos;
};

/**
 * Delete photos from the library by IDs
 * Note: This only removes from app library, not from device photo library
 */
export const deletePhotos = async (photoIds: string[]): Promise<boolean> => {
  const photos = await getPhotos();
  const filtered = photos.filter(p => !photoIds.includes(p.id));
  
  if (filtered.length === photos.length) {
    return false; // No photos found with those IDs
  }

  await Preferences.set({
    key: STORAGE_KEYS.PHOTO_LIBRARY,
    value: JSON.stringify(filtered),
  });

  return true;
};

/**
 * Get photos by IDs (used when loading a slideshow)
 */
export const getPhotosByIds = async (photoIds: string[]): Promise<Photo[]> => {
  const allPhotos = await getPhotos();
  return allPhotos.filter(p => photoIds.includes(p.id));
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Clear all app data (useful for testing and debugging)
 */
export const clearAllData = async (): Promise<void> => {
  await Preferences.remove({ key: STORAGE_KEYS.SLIDESHOWS });
  await Preferences.remove({ key: STORAGE_KEYS.CUSTOM_PLAYLISTS });
  await Preferences.remove({ key: STORAGE_KEYS.PHOTO_LIBRARY });
};

/**
 * Get storage statistics (for debugging)
 */
export const getStorageStats = async (): Promise<{
  slideshowCount: number;
  playlistCount: number;
  photoCount: number;
}> => {
  const [slideshows, playlists, photos] = await Promise.all([
    getSlideshows(),
    getPlaylists(),
    getPhotos(),
  ]);

  return {
    slideshowCount: slideshows.length,
    playlistCount: playlists.length,
    photoCount: photos.length,
  };
};
