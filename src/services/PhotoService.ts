/**
 * PhotoService - Handles photo library access and import functionality
 */

import { Camera } from '@capacitor/camera';
import { Media } from '@capacitor-community/media';
import { Capacitor } from '@capacitor/core';
import { Photo } from '../types';

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
