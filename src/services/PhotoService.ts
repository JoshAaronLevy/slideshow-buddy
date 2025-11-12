/**
 * PhotoService - Handles photo library access and import functionality
 */

import { Camera } from '@capacitor/camera';
import { Media } from '@capacitor-community/media';
import { Capacitor } from '@capacitor/core';
import { Photo, PhotoAlbum } from '../types';

/**
 * Convert base64 string to Blob URL
 * Blob URLs are revocable and use less memory than base64 strings
 */
const convertBase64ToBlob = (base64Data: string): Blob => {
  // Remove data URI prefix if present
  const base64 = base64Data.includes('base64,') 
    ? base64Data.split('base64,')[1] 
    : base64Data;
  
  // Convert base64 to binary
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  
  return new Blob([byteArray], { type: 'image/jpeg' });
};

/**
 * Create a blob URL from base64 data
 */
const createBlobUrl = (base64Data: string): string => {
  const blob = convertBase64ToBlob(base64Data);
  return URL.createObjectURL(blob);
};

/**
 * Revoke a blob URL to free memory
 */
export const revokeBlobUrl = (blobUrl: string): void => {
  if (blobUrl && blobUrl.startsWith('blob:')) {
    console.log('[PhotoService] Revoking blob URL');
    URL.revokeObjectURL(blobUrl);
  }
};

/**
 * Request permission to access the photo library
 * @returns Promise<boolean> - true if permission granted, false otherwise
 */
export const requestPhotoLibraryPermission = async (): Promise<boolean> => {
  try {
    const permissions = await Camera.checkPermissions();
    
    if (permissions.photos === 'granted') {
      return true;
    }
    
    // Request permission if not granted
    const result = await Camera.requestPermissions({ permissions: ['photos'] });
    return result.photos === 'granted';
  } catch (error) {
    console.error('Error requesting photo library permission:', error);
    return false;
  }
};

/**
 * Import photos from the device photo library using multi-select
 * Uses @capacitor-community/media for true multi-select capability
 * @param quantity - Maximum number of photos to fetch (default: 50)
 * @returns Promise<Photo[]> - Array of imported photos
 */
export const importPhotos = async (quantity: number = 50): Promise<Photo[]> => {
  try {
    // Check/request permissions first
    const hasPermission = await requestPhotoLibraryPermission();
    if (!hasPermission) {
      throw new Error('Photo library permission denied');
    }

    const platform = Capacitor.getPlatform();

    if (platform === 'ios') {
      // Use Media plugin for iOS with multi-select
      const result = await Media.getMedias({
        quantity,
        types: 'photos',
        thumbnailWidth: 512,
        thumbnailHeight: 512,
        thumbnailQuality: 90,
      });

      if (!result.medias || result.medias.length === 0) {
        return [];
      }

      // Convert MediaAsset to Photo
      // For iOS, we need to use the identifier and base64 data
      const photos: Photo[] = result.medias.map((media) => {
        // Create blob URL from base64 (more memory efficient)
        const blobUrl = createBlobUrl(media.data);
        
        return {
          id: media.identifier,
          uri: blobUrl,
          filename: `photo_${media.creationDate}.jpg`,
          timestamp: new Date(media.creationDate).getTime(),
          selected: false,
        };
      });

      console.log(`[PhotoService] Created ${photos.length} blob URLs for iOS photos`);
      return photos;
    } else if (platform === 'android') {
      // On Android, Media plugin's identifier IS the file path
      const result = await Media.getMedias({
        quantity,
        types: 'photos',
        thumbnailWidth: 512,
        thumbnailHeight: 512,
        thumbnailQuality: 90,
      });

      if (!result.medias || result.medias.length === 0) {
        return [];
      }

      const photos: Photo[] = result.medias.map((media) => {
        // On Android, identifier is the file path
        // Create blob URL from base64 (more memory efficient)
        const blobUrl = createBlobUrl(media.data);
        
        return {
          id: media.identifier,
          uri: blobUrl,
          filename: media.identifier.split('/').pop() || `photo_${Date.now()}.jpg`,
          timestamp: new Date(media.creationDate).getTime(),
          selected: false,
        };
      });

      console.log(`[PhotoService] Created ${photos.length} blob URLs for Android photos`);
      return photos;
    } else {
      // Web fallback - not fully functional but prevents errors
      console.warn('Photo import not supported on web platform');
      throw new Error('Photo import only available on iOS and Android');
    }
  } catch (error) {
    console.error('Error importing photos:', error);
    throw error;
  }
};



/**
 * Get photo albums from the device
 * @returns Promise<PhotoAlbum[]> - Array of photo albums
 */
export const getPhotoAlbums = async (): Promise<PhotoAlbum[]> => {
  try {
    // Check/request permissions first
    const hasPermission = await requestPhotoLibraryPermission();
    if (!hasPermission) {
      throw new Error('Photo library permission denied');
    }

    const platform = Capacitor.getPlatform();

    if (platform === 'ios' || platform === 'android') {
      const result = await Media.getAlbums();
      
      if (!result.albums || result.albums.length === 0) {
        return [];
      }

      const albums: PhotoAlbum[] = result.albums.map((album) => ({
        identifier: album.identifier,
        name: album.name,
        type: album.type || 'album',
        count: 0, // Count not provided by Media plugin
      }));

      return albums;
    } else {
      // Web fallback
      console.warn('Photo albums not supported on web platform');
      throw new Error('Photo albums only available on iOS and Android');
    }
  } catch (error) {
    console.error('Error fetching photo albums:', error);
    throw error;
  }
};

/**
 * Get photos from a specific album or all photos
 * @param albumIdentifier - Album ID (optional, if not provided gets all photos)
 * @param quantity - Total number of photos to fetch from the beginning (for pagination, request 50, 100, 150, etc.)
 * @returns Promise<Photo[]> - Array of photos
 */
export const getPhotosFromAlbum = async (
  albumIdentifier?: string,
  quantity: number = 50
): Promise<Photo[]> => {
  try {
    // Check/request permissions first
    const hasPermission = await requestPhotoLibraryPermission();
    if (!hasPermission) {
      throw new Error('Photo library permission denied');
    }

    const platform = Capacitor.getPlatform();

    if (platform === 'ios' || platform === 'android') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const options: any = {
        quantity,
        types: 'photos',
        thumbnailWidth: 512,
        thumbnailHeight: 512,
        thumbnailQuality: 90,
      };

      // Add album identifier if provided
      if (albumIdentifier) {
        options.albumIdentifier = albumIdentifier;
      }

      const result = await Media.getMedias(options);

      if (!result.medias || result.medias.length === 0) {
        return [];
      }

      // Convert MediaAsset to Photo
      const photos: Photo[] = result.medias.map((media) => {
        // Create blob URL from base64 (more memory efficient)
        const blobUrl = createBlobUrl(media.data);
        
        return {
          id: media.identifier,
          uri: blobUrl,
          filename: platform === 'android' 
            ? (media.identifier.split('/').pop() || `photo_${Date.now()}.jpg`)
            : `photo_${media.creationDate}.jpg`,
          timestamp: new Date(media.creationDate).getTime(),
          selected: false,
        };
      });

      console.log(`[PhotoService] Created ${photos.length} blob URLs from album`);
      return photos;
    } else {
      // Web fallback
      console.warn('Photo loading not supported on web platform');
      throw new Error('Photo loading only available on iOS and Android');
    }
  } catch (error) {
    console.error('Error loading photos from album:', error);
    throw error;
  }
};

/**
 * Check if the app has photo library permission
 * @returns Promise<boolean>
 */
export const hasPhotoLibraryPermission = async (): Promise<boolean> => {
  try {
    const permissions = await Camera.checkPermissions();
    return permissions.photos === 'granted';
  } catch (error) {
    console.error('Error checking photo library permission:', error);
    return false;
  }
};

/**
 * Get permission status message for UI display
 * @returns Promise<string> - Human-readable permission status
 */
export const getPermissionStatusMessage = async (): Promise<string> => {
  try {
    const permissions = await Camera.checkPermissions();
    
    switch (permissions.photos) {
      case 'granted':
        return 'Photo library access granted';
      case 'denied':
        return 'Photo library access denied. Please enable in Settings.';
      case 'prompt':
        return 'Photo library access not yet requested';
      default:
        return 'Unknown permission status';
    }
  } catch {
    return 'Error checking permission status';
  }
};
