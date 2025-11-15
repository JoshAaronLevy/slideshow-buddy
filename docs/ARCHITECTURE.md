# Slideshow Buddy Architecture Documentation

This document provides a comprehensive overview of the Slideshow Buddy application architecture, covering both iOS and macOS implementations.

## Table of Contents

- [High-Level Architecture](#high-level-architecture)
- [Platform Detection Strategy](#platform-detection-strategy)
- [Service Layer Architecture](#service-layer-architecture)
- [Cross-Platform Component Patterns](#cross-platform-component-patterns)
- [Electron IPC Communication](#electron-ipc-communication)
- [Swift Native Module Integration](#swift-native-module-integration)
- [Storage Architecture](#storage-architecture)
- [Authentication Flow](#authentication-flow)
- [State Management](#state-management)
- [Build & Deployment Pipeline](#build--deployment-pipeline)

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                       │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │   iOS App       │    │   macOS App     │                │
│  │ (Capacitor iOS) │    │ (Electron)      │                │
│  └─────────────────┘    └─────────────────┘                │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Web Application Layer                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Ionic React App                         │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐     │  │
│  │  │ Components  │ │    Pages    │ │   Stores    │     │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ Photo       │ │ Music       │ │ Storage     │           │
│  │ Service     │ │ Service     │ │ Service     │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ Spotify     │ │ Lifecycle   │ │ Haptic      │           │
│  │ Auth        │ │ Service     │ │ Service     │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                   Platform Layer                            │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │   iOS Native    │    │  macOS Native   │                │
│  │ • Capacitor     │    │ • Electron      │                │
│  │ • Swift Plugins │    │ • Swift FFI     │                │
│  │ • Photos Kit    │    │ • Photos Kit    │                │
│  │ • Haptics       │    │ • PowerSaver    │                │
│  └─────────────────┘    │ • Keychain      │                │
│                         └─────────────────┘                │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                   External Services                         │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │ Spotify Web API │    │   Backend API   │                │
│  │ • Authentication│    │ • OAuth Token   │                │
│  │ • Playback SDK  │    │   Exchange      │                │
│  │ • Playlists API │    │ • Token Refresh │                │
│  └─────────────────┘    └─────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

### Architecture Principles

1. **Platform Agnostic Core**: Business logic in service layer works across platforms
2. **Dependency Injection**: Platform-specific implementations injected based on runtime detection
3. **Clear Separation**: Presentation, business logic, and platform layers are distinct
4. **Type Safety**: Full TypeScript coverage with strict type checking
5. **Performance**: Lazy loading, memory management, and platform optimizations

## Platform Detection Strategy

Located in [`src/utils/platform.ts`](../src/utils/platform.ts)

```typescript
// Core platform detection utilities
export const getPlatform = () => Capacitor.getPlatform();
export const isIOS = () => getPlatform() === 'ios';
export const isMacOS = () => getPlatform() === 'electron';
export const isMobile = () => isIOS() || isAndroid();
export const isDesktop = () => isMacOS();
```

### Platform Detection Usage Pattern

```typescript
// Service layer example
export const someFeature = async () => {
  if (isMacOS()) {
    // macOS-specific implementation
    return await electronImplementation();
  } else if (isIOS()) {
    // iOS-specific implementation
    return await capacitorImplementation();
  }
  throw new Error('Platform not supported');
};
```

### Runtime Platform Behavior

- **iOS**: Uses Capacitor native bridge for device APIs
- **macOS**: Uses Electron IPC and native Swift modules via FFI
- **Web**: Fallback implementations for development/testing

## Service Layer Architecture

### Core Services Overview

#### [`PhotoService.ts`](../src/services/PhotoService.ts)
- **Purpose**: Photo library access and import
- **iOS**: Uses `@capacitor-community/media` plugin
- **macOS**: Uses Swift Photos framework via FFI bridge
- **Key Features**: Album browsing, photo import, memory management

#### [`SpotifyAuthService.ts`](../src/services/SpotifyAuthService.ts)  
- **Purpose**: OAuth 2.0 authentication with Spotify
- **Cross-Platform**: Uses PKCE flow with backend token exchange
- **iOS**: Custom URL scheme handling via Capacitor
- **macOS**: Protocol handler registration via Electron

#### [`MusicPlayerService.ts`](../src/services/MusicPlayerService.ts)
- **Purpose**: Spotify Web Playback SDK integration
- **Cross-Platform**: JavaScript SDK works in both environments
- **Features**: Device registration, playback control, state management

#### [`StorageService.ts`](../src/services/StorageService.ts)
- **Purpose**: Persistent data storage abstraction
- **iOS**: Uses Capacitor Preferences (encrypted)
- **macOS**: Uses electron-store with optional encryption
- **Data Types**: Slideshows, playlists, app settings, auth tokens

#### [`LifecycleService.ts`](../src/services/LifecycleService.ts)
- **Purpose**: Unified app/window lifecycle events
- **iOS**: Maps Capacitor App state changes
- **macOS**: Maps Electron window focus/blur events
- **Events**: `active`, `inactive`, `background`, `foreground`

### Service Layer Patterns

#### Platform Abstraction Pattern
```typescript
class CrossPlatformService {
  async performAction(): Promise<Result> {
    const platform = getPlatform();
    
    switch (platform) {
      case 'electron':
        return await this.macOSImplementation();
      case 'ios':
        return await this.iOSImplementation();
      default:
        throw new Error(`Platform ${platform} not supported`);
    }
  }
  
  private async macOSImplementation(): Promise<Result> { /* ... */ }
  private async iOSImplementation(): Promise<Result> { /* ... */ }
}
```

#### Adapter Pattern for Storage
```typescript
// Storage adapter routes calls based on platform
const storage = {
  async get(key: string) {
    return isMacOS() 
      ? await electronStorageService.get({ key })
      : await Preferences.get({ key });
  }
};
```

## Cross-Platform Component Patterns

### Conditional Rendering Pattern

```typescript
const MyComponent = () => {
  return (
    <div>
      {/* Always visible */}
      <CommonFeature />
      
      {/* Platform-specific features */}
      {isMacOS() && <MacOSMenuBar />}
      {isMobile() && <MobileTabBar />}
      
      {/* Platform-specific styling */}
      <div className={isMacOS() ? 'desktop-layout' : 'mobile-layout'}>
        <Content />
      </div>
    </div>
  );
};
```

### Platform-Specific Event Handlers

```typescript
const handleInteraction = useCallback(async () => {
  // Haptic feedback on mobile, system sound on desktop
  if (isMobile()) {
    await HapticService.impactLight();
  } else {
    // macOS alternative feedback
    await MacOSFeedbackService.playSystemSound();
  }
  
  // Common business logic
  await performAction();
}, []);
```

### Responsive Layout Patterns

```css
/* Mobile-first approach with desktop adaptations */
.slideshow-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
}

/* macOS desktop optimizations */
.electron .slideshow-grid {
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1.5rem;
}

/* Platform-specific control layouts */
.electron .slideshow-controls {
  /* Mouse hover optimized controls */
  opacity: 0;
  transition: opacity 0.3s ease;
}

.electron .slideshow-controls:hover {
  opacity: 1;
}
```

## Electron IPC Communication

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                 Renderer Process                        │
│  ┌─────────────────┐    ┌─────────────────┐           │
│  │   React App     │    │   Preload       │           │
│  │                 │◄──►│   Script        │           │
│  └─────────────────┘    └─────────────────┘           │
└─────────────────────────────────┬───────────────────────┘
                                  │ IPC Bridge
┌─────────────────────────────────▼───────────────────────┐
│                 Main Process                            │
│  ┌─────────────────┐    ┌─────────────────┐           │
│  │   Electron      │    │   Swift FFI     │           │
│  │   IPC Handlers  │◄──►│   Bridge        │           │
│  └─────────────────┘    └─────────────────┘           │
└─────────────────────────────────────────────────────────┘
```

### IPC Channel Design

#### Photos API Channels
Located in [`electron/src/preload.ts`](../electron/src/preload.ts)

```typescript
// Preload script exposes safe IPC interface
contextBridge.exposeInMainWorld('electron', {
  photos: {
    requestPermission: () => ipcRenderer.invoke('photos:requestPermission'),
    checkPermission: () => ipcRenderer.invoke('photos:checkPermission'),
    getAlbums: () => ipcRenderer.invoke('photos:getAlbums'),
    getPhotos: (albumId?: string, quantity?: number) => 
      ipcRenderer.invoke('photos:getPhotos', { albumId, quantity })
  }
});
```

#### Main Process Handlers
Located in [`electron/src/index.ts`](../electron/src/index.ts)

```typescript
// Main process IPC handlers
ipcMain.handle('photos:requestPermission', async () => {
  try {
    return await photosLibraryFFI.requestPermission();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('photos:getPhotos', async (_, { albumId, quantity }) => {
  try {
    return await photosLibraryFFI.getPhotos(albumId, quantity);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

### IPC Security Model

1. **Context Isolation**: Renderer process cannot access Node.js APIs directly
2. **Preload Script**: Only approved APIs exposed via `contextBridge`
3. **Input Validation**: All IPC parameters validated in main process
4. **Error Handling**: Structured error responses prevent crashes

## Swift Native Module Integration

### FFI Bridge Architecture

```
┌─────────────────────────────────────────────────────┐
│              TypeScript Layer                       │
│  ┌─────────────────┐                               │
│  │ PhotosLibraryFFI│ ◄─── Type-safe wrappers       │
│  │     Class       │                               │
│  └─────────────────┘                               │
└─────────────────┬───────────────────────────────────┘
                  │ koffi FFI
┌─────────────────▼───────────────────────────────────┐
│              Swift Native Layer                     │
│  ┌─────────────────┐   ┌─────────────────┐         │
│  │ PhotosLibrary   │   │ Asset Converter │         │
│  │ Bridge.swift    │   │ .swift          │         │
│  └─────────────────┘   └─────────────────┘         │
└─────────────────────────────────────────────────────┘
```

### Swift Module Structure

#### [`PhotosLibraryBridge.swift`](../electron/src/native/PhotosLibraryBridge.swift)
- **Purpose**: Main bridge between TypeScript and Photos framework
- **Functions**: Permission handling, album enumeration, photo fetching
- **Memory Management**: Proper cleanup of PHAsset references

#### [`PhotoAssetConverter.swift`](../electron/src/native/PhotoAssetConverter.swift)  
- **Purpose**: Convert PHAsset to web-compatible formats
- **Functions**: Thumbnail generation, base64 encoding, metadata extraction
- **Performance**: Async image processing with memory optimization

#### [`PhotosPermissionManager.swift`](../electron/src/native/PhotosPermissionManager.swift)
- **Purpose**: Handle Photos library permissions
- **Functions**: Permission status checking, request handling
- **Security**: Proper entitlement validation

### FFI Type Safety

#### [`PhotosLibraryFFI.ts`](../electron/src/native/PhotosLibraryFFI.ts)
```typescript
// Type-safe FFI function signatures
interface SwiftPhotosLibraryFFI {
  requestPermission: koffi.KoffiFunction<string>;
  checkPermission: koffi.KoffiFunction<string>;
  getAlbums: koffi.KoffiFunction<string>;
  getPhotos: koffi.KoffiFunction<string, [string, number]>;
}

// Response type validation
const parsePhotoResponse = (jsonString: string): PhotosResponse => {
  try {
    const parsed = JSON.parse(jsonString);
    return parsed as PhotosResponse;
  } catch (error) {
    throw new PhotosLibraryError('Invalid response format');
  }
};
```

### Build Integration

#### [`build-swift.sh`](../electron/scripts/build-swift.sh)
```bash
#!/bin/bash
# Compiles Swift modules into dynamic library
swiftc -emit-library -o build/native/libPhotosLibraryBridge.dylib \
  src/native/*.swift \
  -framework Photos \
  -framework Foundation \
  -framework Cocoa
```

## Storage Architecture

### Cross-Platform Storage Abstraction

```
┌─────────────────────────────────────────────────┐
│            Application Layer                    │
│  ┌─────────────────┐   ┌─────────────────┐     │
│  │  Slideshow      │   │   Playlist      │     │
│  │  Library Store  │   │   Library Store │     │
│  └─────────────────┘   └─────────────────┘     │
└─────────────────┬───────────┬───────────────────┘
                  │           │
┌─────────────────▼───────────▼───────────────────┐
│              Storage Service                    │
│         Platform Detection Layer                │
└─────────────────┬───────────┬───────────────────┘
                  │           │
        ┌─────────▼─────────┐ │ ┌─────────▼─────────┐
        │  iOS Storage      │ │ │ macOS Storage     │
        │ (Capacitor        │ │ │ (electron-store   │
        │  Preferences)     │ │ │  + Keychain)      │
        └───────────────────┘ │ └───────────────────┘
                              │
                              │
                    ┌─────────▼─────────┐
                    │   Web Storage     │
                    │  (localStorage)   │
                    └───────────────────┘
```

### Storage Implementation Details

#### iOS Storage - Capacitor Preferences
```typescript
// Secure storage on iOS
const iosStorage = {
  async set(key: string, value: string) {
    return await Preferences.set({ key, value });
  },
  
  async get(key: string) {
    const result = await Preferences.get({ key });
    return result.value || null;
  }
};
```

#### macOS Storage - Electron Store + Keychain
```typescript
// electron-store for app data
const electronStore = new Store({
  name: 'slideshow-buddy',
  encryptionKey: 'app-specific-key'
});

// macOS Keychain for sensitive data
const secureStorage = {
  async setToken(service: string, account: string, token: string) {
    return await keytar.setPassword(service, account, token);
  },
  
  async getToken(service: string, account: string) {
    return await keytar.getPassword(service, account);
  }
};
```

### Data Models

#### Slideshow Data Model
```typescript
interface SavedSlideshow {
  id: string;
  name: string;
  photos: Photo[];
  musicConfig?: MusicConfig;
  settings: SlideshowSettings;
  metadata: {
    createdAt: string;
    lastPlayed?: string;
    playCount: number;
  };
}
```

#### Storage Keys Structure
```typescript
const STORAGE_KEYS = {
  SLIDESHOWS: 'slideshows',
  PLAYLISTS: 'customPlaylists',
  AUTH_TOKENS: 'authTokens',
  USER_PREFERENCES: 'userPreferences',
  PHOTO_LIBRARY: 'photoLibraryCache'
} as const;
```

## Authentication Flow

### OAuth 2.0 PKCE Flow Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    App      │    │   Browser   │    │   Spotify   │    │   Backend   │
│             │    │             │    │     OAuth   │    │    Server   │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │                  │
   1.  │ Generate PKCE    │                  │                  │
       │ Challenge        │                  │                  │
       │                  │                  │                  │
   2.  │ Open Browser ────┤                  │                  │
       │ with Auth URL    │                  │                  │
       │                  │                  │                  │
   3.  │                  │ User Auth ──────►│                  │
       │                  │                  │                  │
   4.  │◄─ Protocol ──────┤◄─ Redirect ──────┤                  │
       │   Callback       │   with Code      │                  │
       │                  │                  │                  │
   5.  │ Token Exchange ──┼──────────────────┼─────────────────►│
       │ (Code + Verifier)│                  │                  │
       │                  │                  │                  │
   6.  │◄─ Access Token ──┼──────────────────┼──────────────────┤
       │   + Refresh      │                  │                  │
       │                  │                  │                  │
```

### Implementation Flow

#### 1. PKCE Parameter Generation
```typescript
// Generate cryptographically secure parameters
const codeVerifier = generateCodeVerifier(); // 128-character random string
const codeChallenge = await generateCodeChallenge(codeVerifier); // SHA256 hash
const state = generateState(); // CSRF protection
```

#### 2. OAuth URL Construction
```typescript
const authUrl = new URL('https://accounts.spotify.com/authorize');
authUrl.searchParams.append('client_id', SPOTIFY_CLIENT_ID);
authUrl.searchParams.append('response_type', 'code');
authUrl.searchParams.append('redirect_uri', 'com.slideshowbuddy://callback');
authUrl.searchParams.append('code_challenge_method', 'S256');
authUrl.searchParams.append('code_challenge', codeChallenge);
authUrl.searchParams.append('state', state);
authUrl.searchParams.append('scope', 'user-modify-playback-state user-read-playback-state streaming');
```

#### 3. Platform-Specific Callback Handling

**iOS Implementation:**
```typescript
// iOS uses App URL listener
const listener = App.addListener('appUrlOpen', (event) => {
  if (event.url.startsWith('com.slideshowbuddy://callback')) {
    handleOAuthCallback(event.url);
  }
});
```

**macOS Implementation:**
```typescript
// macOS uses Electron protocol handler
app.setAsDefaultProtocolClient('com.slideshowbuddy');
app.on('open-url', (event, url) => {
  event.preventDefault();
  if (url.startsWith('com.slideshowbuddy://callback')) {
    mainWindow.webContents.send('oauth:callback', url);
  }
});
```

#### 4. Token Exchange via Backend
```typescript
const response = await axios.post('/auth/spotify/token', {
  code: authCode,
  code_verifier: storedCodeVerifier
});

const { access_token, refresh_token, expires_in } = response.data;
```

### Security Considerations

1. **PKCE Flow**: Prevents authorization code interception attacks
2. **State Parameter**: CSRF protection against cross-site request forgery
3. **Secure Storage**: Tokens stored in platform keychain/secure storage
4. **Backend Proxy**: Client secret never exposed to client applications
5. **Token Rotation**: Automatic refresh token handling

## State Management

### Zustand Store Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Application Stores                           │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│ │   Auth Store    │ │   Music Store   │ │   Photo Store   │   │
│ │ • User profile  │ │ • Playlists     │ │ • Photos cache  │   │
│ │ • Token status  │ │ • Player state  │ │ • Albums        │   │
│ │ • Login state   │ │ • Current track │ │ • Import state  │   │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘   │
│                                                                 │
│ ┌─────────────────┐ ┌─────────────────┐                       │
│ │ Slideshow Store │ │ Playlist Store  │                       │
│ │ • Library       │ │ • Custom lists  │                       │
│ │ • Current show  │ │ • User created  │                       │
│ │ • Player state  │ │ • Favorites     │                       │
│ └─────────────────┘ └─────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

### Store Implementation Pattern

```typescript
interface StoreState {
  // State properties
  data: DataType[];
  loading: boolean;
  error: string | null;
  
  // Actions
  actions: {
    loadData: () => Promise<void>;
    updateItem: (id: string, updates: Partial<DataType>) => void;
    clearError: () => void;
  };
}

const useStore = create<StoreState>((set, get) => ({
  data: [],
  loading: false,
  error: null,
  
  actions: {
    loadData: async () => {
      set({ loading: true, error: null });
      try {
        const data = await ServiceLayer.loadData();
        set({ data, loading: false });
      } catch (error) {
        set({ error: error.message, loading: false });
      }
    },
    
    updateItem: (id, updates) => {
      set((state) => ({
        data: state.data.map(item => 
          item.id === id ? { ...item, ...updates } : item
        )
      }));
    },
    
    clearError: () => set({ error: null })
  }
}));
```

### Cross-Platform State Synchronization

```typescript
// Platform-aware state persistence
const usePersistentStore = create<State>()(
  persist(
    (set, get) => ({
      // Store definition
    }),
    {
      name: 'store-name',
      storage: {
        getItem: async (name) => {
          if (isMacOS()) {
            return await electronStorageService.get({ key: name });
          } else {
            const result = await Preferences.get({ key: name });
            return result.value;
          }
        },
        setItem: async (name, value) => {
          if (isMacOS()) {
            await electronStorageService.set({ key: name, value });
          } else {
            await Preferences.set({ key: name, value });
          }
        }
      }
    }
  )
);
```

## Build & Deployment Pipeline

### Multi-Platform Build Flow

```
┌─────────────────┐
│   Source Code   │
│    (src/)       │
└────────┬────────┘
         │
    ┌────▼────┐
    │  Build  │
    │ (Vite)  │
    └────┬────┘
         │
    ┌────▼────┐
    │  Sync   │
    │(Capacitor)│
    └────┬────┘
         │
    ┌────▼────────────┬────────────────┐
    │                 │                │
┌───▼────┐    ┌──────▼────┐    ┌──────▼────┐
│iOS     │    │ macOS     │    │  Web      │
│(Xcode) │    │(Electron) │    │ (Static)  │
└────────┘    └───────────┘    └───────────┘
```

### Build Commands Matrix

| Platform | Development | Build | Package | Distribute |
|----------|-------------|--------|---------|------------|
| **Web** | `npm run dev` | `npm run build` | `npm run preview` | Static hosting |
| **iOS** | `npm run ios:dev` | Build in Xcode | Archive in Xcode | App Store Connect |
| **macOS** | `npm run electron:dev` | `npm run electron:build:mac` | DMG creation | Direct download |

### Configuration Management

#### Environment-Specific Builds
```typescript
// vite.config.ts
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __PLATFORM_TARGET__: JSON.stringify(process.env.PLATFORM_TARGET || 'web')
  },
  build: {
    target: process.env.PLATFORM_TARGET === 'electron' ? 'esnext' : 'es2015'
  }
});
```

#### Platform-Specific Optimizations
```json
// iOS build optimizations
{
  "capacitor": {
    "ios": {
      "minVersion": "13.0",
      "webContentsDebuggingEnabled": false
    }
  }
}

// macOS build optimizations  
{
  "electron": {
    "build": {
      "mac": {
        "target": [
          { "target": "dmg", "arch": ["x64", "arm64"] }
        ],
        "hardenedRuntime": true,
        "notarize": true
      }
    }
  }
}
```

---

**Last Updated**: November 2024  
**Architecture Version**: v2.0 (Cross-Platform)  
**Technology Stack**: Ionic React + Capacitor + Electron + Swift FFI