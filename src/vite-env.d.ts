/// <reference types="vite/client" />

// Electron Photos API types
interface ElectronPhoto {
  identifier: string;
  filename: string;
  creationDate: string;
  modificationDate?: string;
  width: number;
  height: number;
  thumbnailData?: string; // Base64 encoded thumbnail
  isFavorite: boolean;
  mediaType: 'image' | 'video';
  mediaSubtypes: string[];
}

interface ElectronPhotoAlbum {
  identifier: string;
  name: string;
  type: string;
  count: number;
}

interface PhotosPermissionResult {
  success: boolean;
  hasPermission?: boolean;
  error?: string;
}

interface PhotosAlbumsResult {
  success: boolean;
  albums?: ElectronPhotoAlbum[];
  error?: string;
}

interface PhotosResult {
  success: boolean;
  photos?: ElectronPhoto[];
  error?: string;
}

interface PhotosAPI {
  requestPermission(): Promise<PhotosPermissionResult>;
  checkPermission(): Promise<PhotosPermissionResult>;
  getAlbums(): Promise<PhotosAlbumsResult>;
  getPhotos(albumId?: string, quantity?: number): Promise<PhotosResult>;
}

// Extend global Window interface
declare global {
  interface Window {
    electron?: {
      photos: PhotosAPI;
    };
  }
}
