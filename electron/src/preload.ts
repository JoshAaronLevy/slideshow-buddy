import { contextBridge, ipcRenderer } from 'electron';
import type { Photo, PhotoAlbum } from './native/types';

require('./rt/electron-rt');
//////////////////////////////
// User Defined Preload scripts below
console.log('User Preload!');

// Photos API Response Types
interface PhotosPermissionResult {
  success: boolean;
  hasPermission?: boolean;
  error?: string;
}

interface PhotosAlbumsResult {
  success: boolean;
  albums?: PhotoAlbum[];
  error?: string;
}

interface PhotosResult {
  success: boolean;
  photos?: Photo[];
  error?: string;
}

// Photos API Interface
interface PhotosAPI {
  requestPermission(): Promise<PhotosPermissionResult>;
  checkPermission(): Promise<PhotosPermissionResult>;
  getAlbums(): Promise<PhotosAlbumsResult>;
  getPhotos(albumId?: string, quantity?: number): Promise<PhotosResult>;
}

// Slideshow Keep-Awake API Response Types
interface SlideshowKeepAwakeResult {
  success: boolean;
  blockerId?: number;
  message?: string;
  error?: string;
}

// Slideshow API Interface
interface SlideshowAPI {
  keepAwakeStart(): Promise<SlideshowKeepAwakeResult>;
  keepAwakeStop(): Promise<SlideshowKeepAwakeResult>;
}

// Spotify OAuth API Interface
interface SpotifyOAuthAPI {
  onOAuthCallback(callback: (url: string) => void): () => void;
}

// Expose Photos API, Slideshow API, and Spotify OAuth API to renderer process
contextBridge.exposeInMainWorld('electron', {
  photos: {
    requestPermission: (): Promise<PhotosPermissionResult> =>
      ipcRenderer.invoke('photos:requestPermission'),
    
    checkPermission: (): Promise<PhotosPermissionResult> =>
      ipcRenderer.invoke('photos:checkPermission'),
    
    getAlbums: (): Promise<PhotosAlbumsResult> =>
      ipcRenderer.invoke('photos:getAlbums'),
    
    getPhotos: (albumId?: string, quantity?: number): Promise<PhotosResult> =>
      ipcRenderer.invoke('photos:getPhotos', { albumId, quantity })
  } as PhotosAPI,
  
  slideshow: {
    keepAwakeStart: (): Promise<SlideshowKeepAwakeResult> =>
      ipcRenderer.invoke('slideshow:keep-awake-start'),
      
    keepAwakeStop: (): Promise<SlideshowKeepAwakeResult> =>
      ipcRenderer.invoke('slideshow:keep-awake-stop')
  } as SlideshowAPI,
  
  spotify: {
    onOAuthCallback: (callback: (url: string) => void): (() => void) => {
      const removeListener = () => {
        ipcRenderer.removeListener('spotify:oauth-callback', callback);
      };
      
      ipcRenderer.on('spotify:oauth-callback', (event, url: string) => {
        console.log('OAuth callback received in preload:', url);
        callback(url);
      });
      
      return removeListener;
    }
  } as SpotifyOAuthAPI
});

// Type declarations for global window object
declare global {
  interface Window {
    electron: {
      photos: PhotosAPI;
      slideshow: SlideshowAPI;
      spotify: SpotifyOAuthAPI;
    };
  }
}
