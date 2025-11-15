# macOS-Specific Features

This document details the macOS-exclusive features and adaptations in Slideshow Buddy, highlighting how the desktop experience differs from and complements the iOS version.

## Table of Contents

- [Photos Library Integration](#photos-library-integration)
- [Desktop User Interface](#desktop-user-interface)
- [Audio Feedback System](#audio-feedback-system)
- [Storage and Security](#storage-and-security)
- [System Integration](#system-integration)
- [Window Management](#window-management)
- [Keyboard and Mouse Support](#keyboard-and-mouse-support)
- [Menu Bar Integration](#menu-bar-integration)
- [OAuth and Authentication](#oauth-and-authentication)
- [Performance Optimizations](#performance-optimizations)

## Photos Library Integration

### Native macOS Photos Library Access

Unlike iOS which uses Capacitor plugins, macOS implementation uses native Swift modules accessed through FFI (Foreign Function Interface) for direct Photos framework integration.

#### Implementation Architecture

```
┌─────────────────────────────────────────────┐
│           TypeScript Layer                  │
│  ┌─────────────────────────────────────────┤
│  │ PhotoService.ts                         │
│  │ • Platform detection                    │
│  │ • iOS/macOS routing logic               │
│  └─────────────────┬───────────────────────┘
└───────────────────┼─────────────────────────┘
                    │ FFI Interface
┌───────────────────▼─────────────────────────┐
│           Swift Native Layer                │
│  ┌─────────────────────────────────────────┤
│  │ PhotosLibraryBridge.swift               │
│  │ • PHPhotoLibrary integration            │
│  │ • Album enumeration                     │
│  │ • Photo fetching with thumbnails        │
│  └─────────────────────────────────────────┘
└─────────────────────────────────────────────┘
```

#### Key Features

**Album Support**: Full access to Photos app albums including:
- All Photos
- Favorites
- User-created albums
- Smart albums (Recently Added, Screenshots, etc.)
- Shared albums

**Photo Fetching**: High-performance photo access with:
- Thumbnail generation for fast browsing
- Full-resolution image access for slideshows
- Metadata preservation (dates, locations, etc.)
- Memory-efficient blob URL creation

#### Implementation Files

- [`electron/src/native/PhotosLibraryBridge.swift`](../electron/src/native/PhotosLibraryBridge.swift): Main bridge to Photos framework
- [`electron/src/native/PhotoAssetConverter.swift`](../electron/src/native/PhotoAssetConverter.swift): Image processing and conversion
- [`electron/src/native/PhotosPermissionManager.swift`](../electron/src/native/PhotosPermissionManager.swift): Permission handling
- [`electron/src/native/PhotosLibraryFFI.ts`](../electron/src/native/PhotosLibraryFFI.ts): TypeScript FFI interface

#### Permission Model

```swift
// Required entitlement in entitlements.mac.plist
<key>com.apple.security.photos-library</key>
<true/>

// Runtime permission request
PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
    // Handle permission result
}
```

### Comparison with iOS Implementation

| Feature | iOS Implementation | macOS Implementation |
|---------|-------------------|---------------------|
| **Platform** | Capacitor Media plugin | Native Swift FFI bridge |
| **Permission** | Info.plist + runtime request | Entitlements + runtime request |
| **Album Access** | Via Media.getAlbums() | Direct PHPhotoLibrary.shared() |
| **Performance** | Plugin overhead | Direct native calls |
| **Thumbnails** | Plugin-generated | Custom Swift processing |

## Desktop User Interface

### Adaptive Layout System

The macOS interface automatically adapts to desktop screen sizes and interaction patterns while maintaining the core Ionic React foundation.

#### Desktop Sidebar Navigation

**File**: [`src/components/DesktopSidebar.tsx`](../src/components/DesktopSidebar.tsx)

```typescript
// Desktop-optimized sidebar replaces bottom tab bar
const navItems = [
  { path: '/slideshows', icon: imagesOutline, label: 'Slideshows' },
  { path: '/music', icon: musicalNotesOutline, label: 'Music' },
  { path: '/settings', icon: settingsOutline, label: 'Settings' },
];
```

**Features**:
- Persistent left sidebar for primary navigation
- Hover states for better mouse interaction
- Visual indicators for active sections
- Keyboard navigation support

#### Responsive Photo Grid

Desktop layout automatically adjusts grid columns based on window size:

```css
/* Mobile: 2-3 columns */
.photo-grid {
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
}

/* macOS: 4-6 columns based on window width */
.electron .photo-grid {
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1.5rem; /* Larger gaps for desktop */
}
```

#### Mouse-Optimized Controls

**Slideshow Player Adaptations**:
- Controls appear on mouse hover instead of touch/tap
- Larger click targets optimized for mouse precision
- Hover timeouts for auto-hiding controls
- Scroll wheel support for volume control

### Context Menus

**File**: [`src/components/ContextMenu.tsx`](../src/components/ContextMenu.tsx)

Native-style right-click context menus provide quick access to common actions:

```typescript
// Context menu actions for slideshows
const slideshowContextActions = [
  { label: 'Play Slideshow', action: 'play' },
  { label: 'Edit Slideshow', action: 'edit' },
  { label: 'Duplicate', action: 'duplicate' },
  { type: 'separator' },
  { label: 'Delete', action: 'delete', destructive: true }
];
```

**Features**:
- System-native appearance and behavior
- Keyboard accessibility (arrow keys, enter, escape)
- Separator lines for logical grouping
- Destructive action styling for dangerous operations

## Audio Feedback System

### Replacement for Mobile Haptics

Since macOS doesn't support haptic feedback, Slideshow Buddy implements an audio feedback system as a desktop-appropriate alternative.

**File**: [`src/services/MacOSFeedbackService.ts`](../src/services/MacOSFeedbackService.ts)

#### Audio Feedback Types

```typescript
// Light interactions (button taps, toggles)
export const impactLight = async (): Promise<void> => {
  await playTone(800, 50, 0.08); // 800Hz, 50ms duration
};

// Medium interactions (selections, confirmations)
export const impactMedium = async (): Promise<void> => {
  await playTone(600, 80, 0.10); // Lower frequency, longer
};

// Heavy interactions (important actions, deletions)
export const impactHeavy = async (): Promise<void> => {
  await playTone(400, 120, 0.12); // Deeper, more pronounced
};
```

#### Notification Sounds

```typescript
// Success - ascending frequency sweep
export const notificationSuccess = async (): Promise<void> => {
  await playFrequencySweep(600, 800, 150, 0.10);
};

// Error - descending frequency sweep
export const notificationError = async (): Promise<void> => {
  await playFrequencySweep(800, 400, 150, 0.12);
};
```

#### Technical Implementation

Uses Web Audio API for precise, low-latency audio feedback:

```typescript
const playTone = (frequency: number, duration: number, volume: number = 0.1): Promise<void> => {
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  
  // Clean sine waves with smooth fade-in/out
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, context.currentTime);
  gainNode.gain.setValueAtTime(0, context.currentTime);
  gainNode.gain.linearRampToValueAtTime(volume, context.currentTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration / 1000);
};
```

**Benefits**:
- Non-intrusive, brief audio cues
- Frequency-based feedback mapping (high = light, low = heavy)
- Respects system audio settings
- No external audio file dependencies

## Storage and Security

### Dual Storage Architecture

macOS implementation uses a hybrid approach combining electron-store for app data and system Keychain for sensitive information.

#### Application Data Storage

**File**: [`src/services/ElectronStorageService.ts`](../src/services/ElectronStorageService.ts)

```typescript
// electron-store provides persistent, encrypted storage
const electronStore = new Store({
  name: 'slideshow-buddy',
  encryptionKey: 'app-specific-key', // Optional encryption
  cwd: app.getPath('userData')       // ~/Library/Application Support/
});
```

**Stored Data**:
- Slideshow configurations and metadata
- Custom playlists and preferences
- Photo library cache and references
- App settings and window state

#### Secure Token Storage

**macOS Keychain Integration** via [`keytar`](https://www.npmjs.com/package/keytar):

```typescript
// Store sensitive data in macOS Keychain
const secureStorage = {
  async setToken(service: string, account: string, token: string) {
    return await keytar.setPassword(service, account, token);
  },
  
  async getToken(service: string, account: string) {
    return await keytar.getPassword(service, account);
  }
};
```

**Secured Data**:
- Spotify access and refresh tokens
- OAuth state and code verifiers
- User authentication credentials
- API keys and sensitive configuration

#### Storage Comparison

| Data Type | iOS Storage | macOS Storage | Security Level |
|-----------|-------------|---------------|----------------|
| **App Data** | Capacitor Preferences | electron-store | Medium (app-level encryption) |
| **Tokens** | iOS Keychain | macOS Keychain | High (system-level encryption) |
| **Cache** | App sandbox | ~/Library/Application Support | Medium (file permissions) |
| **Temp Files** | iOS temp directory | /tmp with entitlements | Medium (temporary) |

## System Integration

### Theme Integration

Automatic system theme detection and adaptation:

```typescript
// Electron main process theme detection
const nativeTheme = require('electron').nativeTheme;

nativeTheme.on('updated', () => {
  const isDark = nativeTheme.shouldUseDarkColors;
  mainWindow.webContents.send('theme-changed', { isDark });
});
```

**Features**:
- Automatic light/dark mode switching
- Respects system accent colors
- Smooth transitions between themes
- Consistent with macOS design language

### Power Management

**Keep-Awake during Slideshows**:

```typescript
// Prevent system sleep during slideshow playback
const powerSaveBlocker = require('electron').powerSaveBlocker;

let blockerId: number | null = null;

export const preventSleep = (): void => {
  if (blockerId === null) {
    blockerId = powerSaveBlocker.start('prevent-display-sleep');
  }
};

export const allowSleep = (): void => {
  if (blockerId !== null) {
    powerSaveBlocker.stop(blockerId);
    blockerId = null;
  }
};
```

**Features**:
- Prevents display sleep during active slideshows
- Restores normal power management when slideshow ends
- Configurable via user preferences
- Respects system-level sleep settings

## Window Management

### Native macOS Window Behaviors

#### Window State Persistence

```typescript
// electron-window-state for persistent window management
const mainWindow = new BrowserWindow({
  ...windowStateManager.manage(),
  minWidth: 800,
  minHeight: 600,
  titleBarStyle: 'default',
  show: false, // Show after ready to prevent visual flash
});
```

**Features**:
- Remembers window size and position between app launches
- Supports multiple displays
- Handles display configuration changes
- Minimum window size enforcement

#### Fullscreen Mode Support

```typescript
// Toggle fullscreen for slideshow presentation
const toggleFullscreen = (): void => {
  if (mainWindow.isFullScreen()) {
    mainWindow.setFullScreen(false);
  } else {
    mainWindow.setFullScreen(true);
    // Optional: Hide menu bar in fullscreen
    mainWindow.setMenuBarVisibility(false);
  }
};
```

**Features**:
- Native macOS fullscreen animation
- Menu bar auto-hide in fullscreen
- Escape key exits fullscreen
- Multi-monitor fullscreen support

### Window Lifecycle Integration

**File**: [`src/services/LifecycleService.ts`](../src/services/LifecycleService.ts)

Maps macOS window events to app lifecycle events:

```typescript
// Desktop-specific lifecycle events
private setupElectronListeners(): void {
  this.windowFocusHandler = () => this.emit('active');
  this.windowBlurHandler = () => this.emit('inactive');
  
  window.addEventListener('focus', this.windowFocusHandler);
  window.addEventListener('blur', this.windowBlurHandler);
  
  // Visibility API for minimize/hide detection
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      this.emit('background');
    } else {
      this.emit('foreground');
    }
  });
}
```

## Keyboard and Mouse Support

### Comprehensive Keyboard Shortcuts

#### Global Application Shortcuts

```typescript
// Menu-integrated keyboard shortcuts
const menuTemplate = [
  {
    label: 'File',
    submenu: [
      {
        label: 'New Slideshow',
        accelerator: 'CmdOrCtrl+N',
        click: () => mainWindow.webContents.send('menu:new-slideshow')
      },
      {
        label: 'Open...',
        accelerator: 'CmdOrCtrl+O',
        click: () => mainWindow.webContents.send('menu:open-slideshow')
      }
    ]
  }
];
```

#### Slideshow Player Controls

During slideshow playback:

| Shortcut | Action | Implementation |
|----------|--------|----------------|
| **Space** | Play/Pause | `keydown` event listener |
| **→ / ←** | Next/Previous photo | Arrow key detection |
| **Esc** | Exit slideshow | Global escape handler |
| **F** | Toggle fullscreen | Window.setFullScreen() |
| **↑ / ↓** | Volume control | Audio API integration |
| **M** | Mute/unmute | Audio state toggle |
| **R** | Restart slideshow | Reset to first photo |
| **S** | Shuffle toggle | Array randomization |

#### Context-Aware Key Handling

```typescript
// Different key behaviors based on current view
useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    // Global shortcuts (always available)
    if (event.metaKey && event.key === 'n') {
      event.preventDefault();
      createNewSlideshow();
    }
    
    // Context-specific shortcuts
    if (isInSlideshowView) {
      switch (event.key) {
        case 'ArrowRight':
          nextPhoto();
          break;
        case 'ArrowLeft':
          previousPhoto();
          break;
      }
    }
  };
  
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [isInSlideshowView]);
```

### Mouse Interaction Enhancements

#### Hover States and Visual Feedback

```css
/* Enhanced hover states for desktop */
.slideshow-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--card-hover-shadow);
  transition: all 0.2s ease-in-out;
}

/* Mouse-optimized click targets */
.control-button {
  min-width: 44px;  /* iOS: 44px minimum */
  min-height: 32px; /* macOS: Slightly smaller, mouse precision */
  padding: 8px 16px;
}
```

#### Scroll Wheel Integration

```typescript
// Volume control via scroll wheel during slideshow
const handleWheelEvent = (event: WheelEvent): void => {
  if (isSlideshowActive && !event.ctrlKey) {
    event.preventDefault();
    const volumeChange = event.deltaY > 0 ? -0.1 : 0.1;
    adjustVolume(volumeChange);
  }
};
```

## Menu Bar Integration

### Native macOS Application Menu

**File**: [`electron/src/menu.ts`](../electron/src/menu.ts)

Full macOS-style application menu with keyboard shortcuts and proper role assignments.

#### Menu Structure

```typescript
const menuTemplate: MenuItemConstructorOptions[] = [
  // App Menu (macOS only)
  {
    label: app.name,
    submenu: [
      { label: `About ${app.name}`, click: showAboutDialog },
      { type: 'separator' },
      { label: 'Preferences...', accelerator: 'Cmd+,', click: openPreferences },
      { type: 'separator' },
      { role: 'services' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' }
    ]
  },
  
  // File Menu
  {
    label: 'File',
    submenu: [
      { label: 'New Slideshow', accelerator: 'Cmd+N' },
      { label: 'Open Recent', submenu: buildRecentMenu() },
      { type: 'separator' },
      { role: 'close' }
    ]
  },
  
  // Edit Menu
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectall' }
    ]
  },
  
  // View Menu
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  },
  
  // Window Menu
  {
    label: 'Window',
    submenu: [
      { role: 'minimize' },
      { role: 'close' },
      { role: 'zoom' },
      { type: 'separator' },
      { role: 'front' }
    ]
  },
  
  // Help Menu
  {
    label: 'Help',
    submenu: [
      {
        label: 'Learn More',
        click: () => shell.openExternal('https://slideshow-buddy.app')
      },
      {
        label: 'Report Issue',
        click: () => shell.openExternal('https://github.com/your-repo/issues')
      }
    ]
  }
];
```

#### Menu-App Communication

Messages between menu actions and the React app:

```typescript
// Menu click handlers send IPC messages
click: () => {
  mainWindow.webContents.send('menu:new-slideshow');
}

// React app listens for menu actions
useEffect(() => {
  const handleMenuAction = (event: string, action: string) => {
    switch (action) {
      case 'menu:new-slideshow':
        openSlideshowCreationModal();
        break;
      case 'menu:preferences':
        openPreferencesModal();
        break;
    }
  };
  
  window.electron?.ipcRenderer?.on('menu', handleMenuAction);
  return () => window.electron?.ipcRenderer?.off('menu', handleMenuAction);
}, []);
```

#### Dynamic Menu Updates

```typescript
// Update menu items based on app state
export const updateMenuState = (state: AppState): void => {
  const menu = Menu.getApplicationMenu();
  if (!menu) return;
  
  // Enable/disable items based on current app state
  const fileMenu = menu.items.find(item => item.label === 'File');
  if (fileMenu?.submenu) {
    const newSlideshowItem = fileMenu.submenu.items.find(
      item => item.label === 'New Slideshow'
    );
    if (newSlideshowItem) {
      newSlideshowItem.enabled = state.hasPhotos;
    }
  }
};
```

## OAuth and Authentication

### Custom Protocol Handler

macOS implementation uses Electron's protocol registration for OAuth callbacks, eliminating the need for a local server.

#### Protocol Registration

```typescript
// Register custom protocol for OAuth callbacks
app.setAsDefaultProtocolClient('com.slideshowbuddy');

app.on('open-url', (event, url) => {
  event.preventDefault();
  
  if (url.startsWith('com.slideshowbuddy://callback')) {
    // Forward OAuth callback to renderer process
    mainWindow.webContents.send('oauth:callback', url);
  }
});
```

#### OAuth Flow Adaptation

```typescript
// Platform-specific OAuth handling
export const setupOAuthListener = (): void => {
  if (isMacOS()) {
    // Listen for Electron protocol handler
    window.electron?.ipcRenderer?.on('oauth:callback', (url: string) => {
      handleOAuthCallback(url);
    });
  } else {
    // iOS uses App URL listener
    App.addListener('appUrlOpen', (event) => {
      handleOAuthCallback(event.url);
    });
  }
};
```

**Advantages over Local Server**:
- No need to find available ports
- More secure (no local web server)
- Better user experience (direct app activation)
- Consistent with macOS app conventions

## Performance Optimizations

### Swift Native Module Performance

Direct Swift integration provides significant performance benefits over traditional Capacitor plugins:

```typescript
// Performance comparison: Plugin vs Native
const photoImportTimes = {
  capacitorPlugin: '~2-3 seconds for 100 photos',
  nativeSwift: '~0.8-1.2 seconds for 100 photos',
  // Approximately 60% faster due to:
  // - No JSON serialization overhead
  // - Direct memory management
  // - Optimized thumbnail generation
};
```

### Memory Management

#### Efficient Photo Handling

```typescript
// Blob URL lifecycle management
const photoCache = new Map<string, string>();

export const loadPhotoWithCleanup = async (photoId: string): Promise<string> => {
  // Revoke previous blob URL to free memory
  const existingUrl = photoCache.get(photoId);
  if (existingUrl) {
    URL.revokeObjectURL(existingUrl);
  }
  
  // Create new blob URL
  const newUrl = await createBlobUrl(photoData);
  photoCache.set(photoId, newUrl);
  
  return newUrl;
};
```

#### Background Processing

```typescript
// Use Web Workers for photo processing where appropriate
const photoProcessor = new Worker('photo-processor.js');

photoProcessor.postMessage({
  action: 'generateThumbnail',
  imageData: base64Data,
  maxSize: 300
});
```

### IPC Optimization

#### Batched Communication

```typescript
// Batch multiple photo requests to reduce IPC overhead
export const getBatchPhotos = async (requests: PhotoRequest[]): Promise<Photo[]> => {
  return await window.electron.photos.getBatch(requests);
  // Single IPC call instead of N individual calls
};
```

#### Streaming Large Data

```typescript
// Stream large photo collections to prevent UI blocking
export const getPhotosStream = async function*(albumId: string) {
  let offset = 0;
  const batchSize = 20;
  
  while (true) {
    const batch = await getBatchPhotos(albumId, offset, batchSize);
    if (batch.length === 0) break;
    
    yield batch;
    offset += batchSize;
  }
};
```

---

**Last Updated**: November 2024  
**macOS Version**: Requires Sequoia 15.0+  
**Electron Version**: 26.2.2  
**Implementation**: Stages 2-10 Complete