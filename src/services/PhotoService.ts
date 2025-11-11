/**
 * PhotoService - Handles photo library access and import functionality
 */

import { Camera } from '@capacitor/camera';
import { Media } from '@capacitor-community/media';
import { Capacitor } from '@capacitor/core';
import { Photo, PhotoAlbum } from '../types';

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
        // Create data URI from base64
        const dataUri = `data:image/jpeg;base64,${media.data}`;
        
        return {
          id: media.identifier,
          uri: dataUri,
          filename: `photo_${media.creationDate}.jpg`,
          timestamp: new Date(media.creationDate).getTime(),
          selected: false,
        };
      });

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
        const dataUri = `data:image/jpeg;base64,${media.data}`;
        
        return {
          id: media.identifier,
          uri: dataUri,
          filename: media.identifier.split('/').pop() || `photo_${Date.now()}.jpg`,
          timestamp: new Date(media.creationDate).getTime(),
          selected: false,
        };
      });

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
 * @param quantity - Maximum number of photos to fetch (default: 50)
 * @param createdBefore - Timestamp to fetch photos created before this time (for pagination)
 * @returns Promise<Photo[]> - Array of photos
 */
export const getPhotosFromAlbum = async (
  albumIdentifier?: string,
  quantity: number = 50,
  createdBefore?: number
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

      // Add createdBefore for pagination if provided
      // Subtract 1ms to ensure we don't include the last photo from previous batch
      if (createdBefore) {
        options.createdBefore = createdBefore - 1;
      }

      const result = await Media.getMedias(options);

      if (!result.medias || result.medias.length === 0) {
        return [];
      }

      // Convert MediaAsset to Photo
      const photos: Photo[] = result.medias.map((media) => {
        const dataUri = `data:image/jpeg;base64,${media.data}`;
        
        return {
          id: media.identifier,
          uri: dataUri,
          filename: platform === 'android' 
            ? (media.identifier.split('/').pop() || `photo_${Date.now()}.jpg`)
            : `photo_${media.creationDate}.jpg`,
          timestamp: new Date(media.creationDate).getTime(),
          selected: false,
        };
      });

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
