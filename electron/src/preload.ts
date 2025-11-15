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

// Expose Photos API to renderer process
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
  } as PhotosAPI
});

// Type declarations for global window object
declare global {
  interface Window {
    electron: {
      photos: PhotosAPI;
    };
  }
}
