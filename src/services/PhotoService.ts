/**
 * PhotoService - Handles photo library access and import functionality
 */

import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
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
 * Import photos from the device photo library
 * Capacitor Camera plugin allows selecting multiple photos
 * @returns Promise<Photo[]> - Array of imported photos
 */
export const importPhotos = async (): Promise<Photo[]> => {
  try {
    // Check/request permissions first
    const hasPermission = await requestPhotoLibraryPermission();
    if (!hasPermission) {
      throw new Error('Photo library permission denied');
    }

    // Use Camera plugin to pick photos from gallery
    // Note: Capacitor Camera doesn't support true multi-select natively
    // For MVP, we'll import one photo at a time
    // In future, could use @capacitor-community/media for better multi-select
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Photos,
    });

    if (!photo.webPath) {
      throw new Error('No photo selected');
    }

    // Convert to our Photo interface
    const importedPhoto: Photo = {
      id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      uri: photo.webPath,
      filename: photo.path?.split('/').pop() || `photo_${Date.now()}.jpg`,
      timestamp: Date.now(),
      selected: false,
    };

    return [importedPhoto];
  } catch (error) {
    console.error('Error importing photos:', error);
    throw error;
  }
};

/**
 * Import multiple photos by calling importPhotos repeatedly
 * This is a workaround until we implement better multi-select
 * @param count - Number of photos to import
 * @returns Promise<Photo[]> - Array of imported photos
 */
export const importMultiplePhotos = async (count: number = 1): Promise<Photo[]> => {
  const photos: Photo[] = [];
  
  for (let i = 0; i < count; i++) {
    try {
      const result = await importPhotos();
      photos.push(...result);
    } catch (error) {
      // User cancelled or error occurred
      if (photos.length > 0) {
        // Return what we have so far
        break;
      }
      throw error;
    }
  }
  
  return photos;
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
 * Convert a native photo URI to a web-compatible format
 * This is useful for displaying photos in the web view
 * @param uri - Native photo URI
 * @returns string - Web-compatible URI
 */
export const convertToWebUri = (uri: string): string => {
  // Capacitor already provides webPath, so this is mostly a passthrough
  // But we keep the function for future compatibility
  return uri;
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
