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

// Window Management API Response Types
interface WindowResult {
  success: boolean;
  message?: string;
  error?: string;
}

interface SystemThemeResult {
  success: boolean;
  theme?: string;
  error?: string;
}

// Window API Interface
interface WindowAPI {
  setTitle(title: string): Promise<WindowResult>;
}

// System API Interface
interface SystemAPI {
  getTheme(): Promise<SystemThemeResult>;
  onThemeChange(callback: (theme: string) => void): () => void;
}

// Menu API Response Types
interface MenuStateUpdateResult {
  success: boolean;
  message?: string;
  error?: string;
}

// Menu API Interface
interface MenuAPI {
  // Menu event listeners
  onNewSlideshow(callback: () => void): () => void;
  onPreferences(callback: () => void): () => void;
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
  
  // Menu state management
  updateState(state: { hasSlideshow?: boolean; isPlaying?: boolean; canExport?: boolean }): Promise<MenuStateUpdateResult>;
}

// Storage API Interface
interface StorageAPI {
  get: (key: string) => Promise<any>;
  set: (key: string, value: any) => Promise<void>;
  remove: (key: string) => Promise<void>;
  clear: () => Promise<void>;
}

// Keychain API Interface
interface KeychainAPI {
  getPassword: (account: string) => Promise<string | null>;
  setPassword: (account: string, password: string) => Promise<boolean>;
  deletePassword: (account: string) => Promise<boolean>;
}

// Common helper function to create menu event listeners
const createMenuEventListener = (eventName: string) => {
  return (callback: () => void): (() => void) => {
    const removeListener = () => {
      ipcRenderer.removeListener(eventName, callback);
    };
    
    ipcRenderer.on(eventName, () => {
      console.log(`Menu event received: ${eventName}`);
      callback();
    });
    
    return removeListener;
  };
};

// Expose Photos API, Slideshow API, Spotify OAuth API, Window API, System API, and Menu API to renderer process
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
  } as SpotifyOAuthAPI,
  
  window: {
    setTitle: (title: string): Promise<WindowResult> =>
      ipcRenderer.invoke('window:set-title', title)
  } as WindowAPI,
  
  system: {
    getTheme: (): Promise<SystemThemeResult> =>
      ipcRenderer.invoke('system:get-theme'),
    
    onThemeChange: (callback: (theme: string) => void): (() => void) => {
      const removeListener = () => {
        ipcRenderer.removeListener('theme-changed', callback);
      };
      
      ipcRenderer.on('theme-changed', (event, theme: string) => {
        console.log('Theme changed in preload:', theme);
        callback(theme);
      });
      
      return removeListener;
    }
  } as SystemAPI,
  
  storage: {
    get: (key: string) => ipcRenderer.invoke('storage:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('storage:set', key, value),
    remove: (key: string) => ipcRenderer.invoke('storage:remove', key),
    clear: () => ipcRenderer.invoke('storage:clear')
  } as StorageAPI,
  
  keychain: {
    getPassword: (account: string) => ipcRenderer.invoke('keychain:getPassword', account),
    setPassword: (account: string, password: string) => ipcRenderer.invoke('keychain:setPassword', account, password),
    deletePassword: (account: string) => ipcRenderer.invoke('keychain:deletePassword', account)
  } as KeychainAPI,
  
  menu: {
    // Menu event listeners
    onNewSlideshow: createMenuEventListener('menu:new-slideshow'),
    onPreferences: createMenuEventListener('menu:preferences'),
    onImportPhotos: createMenuEventListener('menu:import-photos'),
    onImportMusic: createMenuEventListener('menu:import-music'),
    onExportSlideshow: createMenuEventListener('menu:export-slideshow'),
    onSlideshowSettings: createMenuEventListener('menu:slideshow-settings'),
    onShowSlideshows: createMenuEventListener('menu:show-slideshows'),
    onShowMusic: createMenuEventListener('menu:show-music'),
    onShowSettings: createMenuEventListener('menu:show-settings'),
    onPlaySlideshow: createMenuEventListener('menu:play-slideshow'),
    onPauseSlideshow: createMenuEventListener('menu:pause-slideshow'),
    onStopSlideshow: createMenuEventListener('menu:stop-slideshow'),
    onNextPhoto: createMenuEventListener('menu:next-photo'),
    onPreviousPhoto: createMenuEventListener('menu:previous-photo'),
    onShowHelp: createMenuEventListener('menu:show-help'),
    onShowShortcuts: createMenuEventListener('menu:show-shortcuts'),
    onClearRecent: createMenuEventListener('menu:clear-recent'),
    
    // Menu state management
    updateState: (state: { hasSlideshow?: boolean; isPlaying?: boolean; canExport?: boolean }): Promise<MenuStateUpdateResult> =>
      ipcRenderer.invoke('menu:update-state', state)
  } as MenuAPI
});

// Type declarations for global window object
declare global {
  interface Window {
    electron: {
      photos: PhotosAPI;
      slideshow: SlideshowAPI;
      spotify: SpotifyOAuthAPI;
      window: WindowAPI;
      system: SystemAPI;
      storage: StorageAPI;
      keychain: KeychainAPI;
      menu: MenuAPI;
    };
  }
}
