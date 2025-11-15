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

// Menu API types
interface MenuAPI {
  onPreferences(callback: () => void): () => void;
  onNewSlideshow(callback: () => void): () => void;
  onImportPhotos(callback: () => void): () => void;
  onImportMusic(callback: () => void): () => void;
  onExportSlideshow(callback: () => void): () => void;
  onSlideshowSettings(callback: () => void): () => void;
  onShowSlideshows(callback: () => void): () => void;
  onShowMusic(callback: () => void): () => void;
  onShowSettings(callback: () => void): () => void;
  onPlaySlideshow(callback: () => void): () => void;
  onPauseSlideshow(callback: () => void): () => void;
  onStopSlideshow(callback: () => void): () => void;
  onNextPhoto(callback: () => void): () => void;
  onPreviousPhoto(callback: () => void): () => void;
  onShowHelp(callback: () => void): () => void;
  onShowShortcuts(callback: () => void): () => void;
  onClearRecent(callback: () => void): () => void;
}

// Slideshow API types
interface SlideshowKeepAwakeResult {
  success: boolean;
  blockerId?: number;
  message?: string;
  error?: string;
}

interface SlideshowAPI {
  keepAwakeStart(): Promise<SlideshowKeepAwakeResult>;
  keepAwakeStop(): Promise<SlideshowKeepAwakeResult>;
}

// Extend global Window interface
declare global {
  interface Window {
    electron?: {
      photos: PhotosAPI;
      menu: MenuAPI;
      slideshow: SlideshowAPI;
    };
  }
}
