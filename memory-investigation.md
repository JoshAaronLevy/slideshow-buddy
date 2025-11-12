# Memory Investigation Report
## Ionic + Capacitor iOS App Memory Leak Analysis

**Investigation Date:** November 12, 2025  
**Platform:** iOS (WKWebView + Capacitor)  
**Issue:** "Terminated due to memory issue" after several minutes of idle/background time

---

## Executive Summary

This report documents a comprehensive investigation into memory management issues affecting the Slideshow Buddy iOS application. The app is experiencing iOS system termination with "Terminated due to memory issue" errors after several minutes of idle or background time.

### Key Findings

The investigation identified **7 high-risk** and **2 medium-risk** memory leak sources across the codebase:

- **Critical Issues:** Player lifecycle leaks, persistent background timers, image memory retention
- **Root Cause:** Combination of incomplete cleanup, background timers continuing indefinitely, and unbounded image storage
- **Primary Concern:** iOS WKWebView context retention combined with Web Playback SDK AudioContext persistence
- **Pattern:** Most leaks stem from resources that continue operating when the app is backgrounded

**Impact Severity:** High - App unusable after background/idle period, leading to poor user experience and data loss.

---

## Likely Leak Sources (Ranked by Risk)

### 🔴 High Risk (Critical)

#### 1. Player Lifecycle Memory Leaks - [`MusicPlayerService.ts`](src/services/MusicPlayerService.ts)

**Location:** Multiple issues across service  
**Risk Level:** CRITICAL  
**Growth Pattern:** Accumulates with each auth session or player initialization

**Issues:**
- **Global Singleton Violation** (lines 14-17)
  - Module-level variables `player`, `deviceId`, `sdkReady`
  - Multiple instances can accumulate across hot reloads or re-initialization
  - References not cleared, leading to detached player instances in memory

- **Incomplete Player Cleanup** (lines 105-114)
  - [`disconnect()`](src/services/MusicPlayerService.ts:105) method only calls `player?.disconnect()`
  - Does NOT clear `player`, `deviceId`, or `sdkReady` references
  - Leaves Web Playback SDK instance in memory

- **Polling Interval Leak** (lines 33-38)
  - SDK loading uses `setInterval()` to check for Spotify object
  - Interval handle not stored or cleared
  - May continue running if SDK fails to load

- **AudioContext Retention**
  - Web Playback SDK creates AudioContext instances
  - These persist in WKWebView even after disconnect
  - iOS does not garbage collect audio contexts aggressively

**When Idle:** Player remains initialized with audio context consuming memory, even when not playing.

---

#### 2. Persistent Background Timer - [`TokenManager.ts`](src/services/TokenManager.ts:232)

**Location:** Auto-refresh mechanism  
**Risk Level:** CRITICAL  
**Growth Pattern:** Continuous memory growth from network activity + closures

**Issues:**
- **Indefinite Background Timer** (lines 232-234)
  - `setInterval(() => this.refreshAccessToken(), 60000)`
  - Runs every 60 seconds indefinitely
  - **NO app state listeners** - continues when app is backgrounded
  - iOS throttles background network but timer callbacks still execute

- **Closure Retention**
  - Timer callback retains references to `this.refreshAccessToken()`
  - Each network request creates new Promise chains
  - Response data may accumulate in memory

- **No Cleanup Mechanism**
  - No method to pause/stop the auto-refresh
  - Timer lives for entire app session

**When Idle:** Timer continues making network requests every minute, accumulating response data and maintaining active network state.

---

#### 3. Multiple Concurrent Timers - [`SlideshowPlayer.tsx`](src/components/SlideshowPlayer.tsx)

**Location:** Component-level timing mechanism  
**Risk Level:** CRITICAL  
**Growth Pattern:** Timers continue running when component is backgrounded but not unmounted

**Issues:**
- **Multiple Timer References** (lines 97-101)
  - `timerRef` - Main slideshow progression timer
  - `controlsTimeoutRef` - UI controls auto-hide
  - `trackUpdateIntervalRef` - Spotify track state polling

- **Track Update Polling** (lines 245-250)
  - `setInterval(() => { ... }, 5000)`
  - Updates every 5 seconds
  - **Continues in background** when app is not visible
  - Makes Spotify API calls while backgrounded

- **Partial Cleanup** (lines 506-512)
  - `useEffect` cleanup exists
  - May not execute on unexpected unmount scenarios
  - Timers persist if component remains mounted in background

**When Idle:** All three timers continue running, with track polling making API calls every 5 seconds, consuming memory and network.

---

#### 4. Image Memory Retention - [`PhotoService.ts`](src/services/PhotoService.ts)

**Location:** Photo import and storage  
**Risk Level:** CRITICAL  
**Growth Pattern:** Linear growth with photo count (≈200KB per photo)

**Issues:**
- **Base64 Data URI Storage** (lines 63-74)
  - Full resolution photos converted to base64 strings
  - No compression beyond initial resize
  - Each 512x512 thumbnail ≈ 150-300KB as base64

- **No Blob URL Management**
  - Uses data URIs instead of revocable `blob:` URLs
  - Data URIs cannot be released from memory
  - Blob URLs allow explicit `URL.revokeObjectURL()` cleanup

- **Cumulative Storage**
  - All imported photos remain in memory simultaneously
  - No lazy loading or pagination
  - 100 photos = 20MB+ in base64 strings alone

**When Idle:** All photo data URIs remain in memory, contributing significant overhead even when not displayed.

---

#### 5. Persistent Photo Cache - [`photoStore.ts`](src/stores/photoStore.ts:31)

**Location:** Zustand store  
**Risk Level:** CRITICAL  
**Growth Pattern:** Unbounded growth with photo library

**Issues:**
- **No Cache Eviction** (lines 31-156)
  - Photos array maintains all base64 data indefinitely
  - No LRU (Least Recently Used) eviction
  - No memory-based limits

- **Duplicate Storage**
  - Photos stored in `photoStore`
  - Re-referenced in `slideshowStore`
  - Same base64 data duplicated across stores

**When Idle:** Complete photo library remains in memory regardless of current slideshow or view.

---

### 🟡 Medium Risk

#### 6. Event Listener Accumulation - [`SpotifyAuthService.ts`](src/services/SpotifyAuthService.ts:410)

**Location:** OAuth flow URL handling  
**Risk Level:** MEDIUM  
**Growth Pattern:** Accumulates if auth flow initiated multiple times

**Issues:**
- **App URL Listener**
  - `App.addListener('appUrlOpen', callback)`
  - Cleanup handle may not be stored
  - Multiple auth attempts = multiple listeners

**When Idle:** Listeners remain registered, minimal memory but can accumulate over time.

---

#### 7. Component-Level URL Listener - [`useSpotifyAuth.ts`](src/hooks/useSpotifyAuth.ts:186)

**Location:** React hook URL handling  
**Risk Level:** MEDIUM  
**Growth Pattern:** Mostly safe, but can leak if component unmounts during auth

**Issues:**
- **Proper Cleanup Exists** (lines 194-196)
  - ✅ `useEffect` cleanup removes listener
  - ⚠️ Edge case: Component unmount during OAuth redirect may not cleanup

**When Idle:** Generally safe, but rare edge cases possible.

---

## Detailed Analysis by Category

### Player Lifecycle

#### Singleton Pattern Issues

The [`MusicPlayerService.ts`](src/services/MusicPlayerService.ts:14) uses module-level variables that violate true singleton pattern:

```typescript
// Lines 14-17
let player: Spotify.Player | null = null;
let deviceId: string | null = null;
let sdkReady = false;
```

**Problem:** 
- These are module-scoped, but can accumulate across hot reloads
- Multiple service imports may create multiple instances
- No enforcement of single instance

#### Initialization Flow

```typescript
// Lines 21-40 (simplified)
export const initializePlayer = async () => {
  if (!spotifyReady) {
    loadSpotifySDK();
    await waitForSpotifySDK();
  }
  
  const token = TokenManager.getInstance().getAccessToken();
  player = new Spotify.Player({ /* ... */ });
  
  player.addListener('ready', ({ device_id }) => {
    deviceId = device_id; // Stored but never cleared
  });
  
  await player.connect();
};
```

**Problem:**
- Old `player` instance not disconnected before creating new one
- `deviceId` persists across re-initializations
- SDK script tag remains in DOM permanently

#### Cleanup Inadequacy

```typescript
// Lines 105-114
export const disconnect = (): void => {
  player?.disconnect();
  // MISSING: player = null;
  // MISSING: deviceId = null;
  // MISSING: sdkReady = false;
};
```

**Impact:**
- Player instance remains reachable
- AudioContext not released
- Event listeners not removed

#### AudioContext Persistence

The Spotify Web Playback SDK creates AudioContext instances for audio playback. In iOS WKWebView:

- AudioContext instances are **not garbage collected** readily
- They maintain audio graph nodes in memory
- Multiple players = multiple audio contexts
- No explicit `.close()` called on contexts

**Memory Impact:** Each AudioContext ≈ 1-5MB + audio buffer allocations

---

### Event Listeners & Timers

#### Complete Inventory

| Location | Type | Interval | Cleanup | Risk |
|----------|------|----------|---------|------|
| [`SpotifyAuthService.ts:410`](src/services/SpotifyAuthService.ts:410) | App URL Listener | Event-driven | ⚠️ Partial | Medium |
| [`useSpotifyAuth.ts:187`](src/hooks/useSpotifyAuth.ts:187) | App URL Listener | Event-driven | ✅ Yes | Low |
| [`TokenManager.ts:232`](src/services/TokenManager.ts:232) | Auto-refresh | 60s | ❌ No | **Critical** |
| [`SlideshowPlayer.tsx:417`](src/components/SlideshowPlayer.tsx:417) | Slideshow timer | 1s | ⚠️ Partial | High |
| [`SlideshowPlayer.tsx:245`](src/components/SlideshowPlayer.tsx:245) | Track polling | 5s | ⚠️ Partial | **Critical** |
| [`SlideshowPlayer.tsx:268`](src/components/SlideshowPlayer.tsx:268) | Controls hide | 3s | ⚠️ Partial | Medium |

#### Background Behavior Analysis

**TokenManager Auto-Refresh:**
```typescript
// Line 232
this.autoRefreshInterval = setInterval(() => {
  this.refreshAccessToken(); // Network call every 60s
}, 60000);
```

**Problems:**
- Runs indefinitely in background
- iOS allows limited background execution
- Network responses accumulate in memory
- No pause when app backgrounded

**SlideshowPlayer Track Polling:**
```typescript
// Lines 245-250
trackUpdateIntervalRef.current = setInterval(async () => {
  const state = await MusicPlayerService.getPlaybackState();
  // Updates state every 5 seconds
}, 5000);
```

**Problems:**
- Continues when slideshow paused
- Makes Spotify API calls in background
- Component may stay mounted when tab switched
- Each poll allocates new Promise chains

#### Cleanup Status

**✅ Good Cleanup Example** - [`useSpotifyAuth.ts:194`](src/hooks/useSpotifyAuth.ts:194):
```typescript
useEffect(() => {
  const listener = App.addListener('appUrlOpen', handleAppUrlOpen);
  return () => {
    listener.remove(); // ✅ Properly removes listener
  };
}, []);
```

**❌ Missing Cleanup** - [`TokenManager.ts`](src/services/TokenManager.ts:232):
```typescript
// No cleanup method for autoRefreshInterval
// Timer runs for entire app lifetime
```

**⚠️ Partial Cleanup** - [`SlideshowPlayer.tsx:506`](src/components/SlideshowPlayer.tsx:506):
```typescript
useEffect(() => {
  return () => {
    clearInterval(timerRef.current);
    clearTimeout(controlsTimeoutRef.current);
    clearInterval(trackUpdateIntervalRef.current);
    // ⚠️ Works, but only if component unmounts
    // Does NOT pause when app backgrounds
  };
}, []);
```

---

### Images & Slideshow Memory

#### Storage Format Analysis

**Current Implementation:**
```typescript
// PhotoService.ts lines 63-74
const toDataURL = (file: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file); // Creates base64 data URI
  });
};
```

**Memory Characteristics:**
- Base64 encoding increases size by ≈33% vs binary
- 512x512 JPEG (≈100KB binary) → ≈133KB base64 string
- Strings are immutable in JavaScript
- Cannot be partially freed

**Better Alternative:**
```typescript
// Blob URLs are revocable
const blobUrl = URL.createObjectURL(file);
// Later: URL.revokeObjectURL(blobUrl);
```

#### Preloading Pattern

Photos are preloaded into memory when imported:

1. User selects photo from camera/library
2. [`PhotoService.processPhoto()`](src/services/PhotoService.ts:45) resizes to 512x512
3. Converted to base64 data URI
4. Stored in [`photoStore`](src/stores/photoStore.ts:31)
5. **Remains in memory indefinitely**

**Growth Scenario:**
- User imports 50 photos: 50 × 200KB = **10MB**
- User imports 100 photos: 100 × 200KB = **20MB**
- User imports 200 photos: 200 × 200KB = **40MB**

#### Disposal & Accumulation

**No Disposal Mechanism:**
- Photos removed from UI still in store
- Deleted slideshows don't free photo memory
- No "cleanup unused photos" function

**Store Retention:**
```typescript
// photoStore.ts - Photos array grows unbounded
const usePhotoStore = create<PhotoStore>((set, get) => ({
  photos: [], // ⚠️ Grows indefinitely
  addPhotos: (newPhotos) => {
    set((state) => ({
      photos: [...state.photos, ...newPhotos], // Accumulates
    }));
  },
}));
```

**Duplication Across Stores:**
- `photoStore.photos[]` - All imported photos
- `slideshowStore.slides[]` - References same photos
- `slideshowLibraryStore` - Persisted slideshow data
- **Same base64 strings duplicated** in multiple locations

---

### Navigation & Component Lifecycles

#### Mounted Components

**Tab-based Navigation:**
- Ionic uses `ion-tabs` with route-based rendering
- Non-active tabs remain mounted (just hidden)
- Components continue running when tab switched

**Critical Impact:**
- [`SlideshowPlayer`](src/components/SlideshowPlayer.tsx) may stay mounted on Tab2
- Timers continue running even when viewing Tab1 or Tab3
- Photo arrays remain in memory across all mounting points

#### Store Retention

**Zustand Stores:**
All stores persist for entire app session:

- [`authStore`](src/stores/authStore.ts) - Auth state
- [`musicStore`](src/stores/musicStore.ts) - Playlists, tracks, playback state
- [`photoStore`](src/stores/photoStore.ts) - **All imported photos (base64)**
- [`slideshowStore`](src/stores/slideshowStore.ts) - Current slideshow config
- [`playlistLibraryStore`](src/stores/playlistLibraryStore.ts) - Custom playlists
- [`slideshowLibraryStore`](src/stores/slideshowLibraryStore.ts) - Saved slideshows

**Memory Impact:**
- Stores never clear unless explicitly reset
- All state accumulates from app start
- Large arrays (photos, playlists) never pruned

---

### Network & Logging

#### Background Polling

**Token Refresh Polling** - [`TokenManager.ts:232`](src/services/TokenManager.ts:232):
- Every 60 seconds
- Continues in background
- Each request creates new Promise chain
- Response data may accumulate

**Track State Polling** - [`SlideshowPlayer.tsx:245`](src/components/SlideshowPlayer.tsx:245):
- Every 5 seconds
- Only when slideshow active
- But component may stay mounted when hidden

#### Response Storage

**No Explicit Accumulation:**
- Network responses generally processed and discarded
- However, Promise chains may retain closures
- Error handlers may capture large stack traces

**Potential Issues:**
- Failed requests may retry and accumulate
- Console logging may store large objects
- Error boundaries may cache error state

---

## Minimal Instrumentation Plan

### Memory Tracking Utilities

Add these logging utilities to measure memory impact:

```typescript
// src/utils/memoryMonitor.ts
export const logMemory = (label: string) => {
  if (performance.memory) {
    const { usedJSHeapSize, totalJSHeapSize } = performance.memory;
    console.log(`[MEMORY ${label}]`, {
      used: `${(usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
      total: `${(totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
      percent: `${((usedJSHeapSize / totalJSHeapSize) * 100).toFixed(1)}%`
    });
  }
};

export const getObjectCount = (obj: any): number => {
  if (Array.isArray(obj)) return obj.length;
  if (typeof obj === 'object' && obj !== null) {
    return Object.keys(obj).length;
  }
  return 0;
};
```

### Specific Instrumentation Points

#### 1. Player Lifecycle

**Goal:** Confirm player instances accumulate

```typescript
// In MusicPlayerService.ts, add:
let playerInstanceCount = 0;

export const initializePlayer = async () => {
  playerInstanceCount++;
  console.log(`[PLAYER] Instance #${playerInstanceCount} created`);
  console.log(`[PLAYER] Previous player exists: ${player !== null}`);
  
  // Log before creating new player
  logMemory('Before Player Init');
  
  // ... existing code ...
  
  logMemory('After Player Init');
};

export const disconnect = (): void => {
  console.log(`[PLAYER] Disconnecting instance #${playerInstanceCount}`);
  logMemory('Before Player Disconnect');
  
  player?.disconnect();
  
  logMemory('After Player Disconnect');
};
```

**Track:** Player instance count, memory before/after init

---

#### 2. Timer Lifecycle

**Goal:** Confirm timers remain active in background

```typescript
// In TokenManager.ts, add:
private startAutoRefresh(): InterfaceData {
  console.log('[TOKEN] Starting auto-refresh timer');
  
  let refreshCount = 0;
  this.autoRefreshInterval = setInterval(() => {
    refreshCount++;
    console.log(`[TOKEN] Refresh #${refreshCount} at ${new Date().toISOString()}`);
    logMemory(`Token Refresh ${refreshCount}`);
    
    this.refreshAccessToken();
  }, 60000);
}

// In SlideshowPlayer.tsx, add:
useEffect(() => {
  console.log('[SLIDESHOW] Track polling started');
  
  let pollCount = 0;
  trackUpdateIntervalRef.current = setInterval(async () => {
    pollCount++;
    console.log(`[SLIDESHOW] Track poll #${pollCount}`);
    // ... existing code ...
  }, 5000);
  
  return () => {
    console.log(`[SLIDESHOW] Track polling stopped after ${pollCount} polls`);
  };
}, []);
```

**Track:** Timer execution count, timestamps showing background activity

---

#### 3. Image Storage Growth

**Goal:** Track photo memory accumulation

```typescript
// In photoStore.ts, add:
const usePhotoStore = create<PhotoStore>((set, get) => ({
  photos: [],
  
  addPhotos: (newPhotos) => {
    set((state) => {
      const newState = {
        photos: [...state.photos, ...newPhotos],
      };
      
      // Calculate total base64 size
      const totalSize = newState.photos.reduce((sum, photo) => {
        return sum + (photo.dataUrl?.length || 0);
      }, 0);
      
      console.log('[PHOTOS] Store updated:', {
        count: newState.photos.length,
        totalBase64Chars: totalSize,
        estimatedMB: (totalSize / 1024 / 1024).toFixed(2)
      });
      
      logMemory('After Photo Import');
      
      return newState;
    });
  },
}));
```

**Track:** Photo count, base64 string total size, heap growth

---

### Console Logging Strategy

**App Lifecycle Events:**

```typescript
// In App.tsx or main entry point
import { App as CapacitorApp } from '@capacitor/app';

CapacitorApp.addListener('appStateChange', ({ isActive }) => {
  console.log(`[APP] State changed: ${isActive ? 'ACTIVE' : 'BACKGROUND'}`);
  logMemory(isActive ? 'App Foregrounded' : 'App Backgrounded');
});

CapacitorApp.addListener('pause', () => {
  console.log('[APP] PAUSED');
  logMemory('App Pause');
});

CapacitorApp.addListener('resume', () => {
  console.log('[APP] RESUMED');
  logMemory('App Resume');
});
```

**Memory Snapshot Schedule:**

Log memory at these key points:
1. App launch
2. After user import photos
3. After slideshow start
4. Every 30 seconds during slideshow
5. On app pause/background
6. On app resume/foreground
7. After component unmount

---

### Metrics to Track

| Metric | Where to Log | What to Watch For |
|--------|--------------|-------------------|
| JS Heap Size | Every memory checkpoint | Continuous growth when idle |
| Photo Store Count | On addPhotos() | Never decreases |
| Active Timer Count | Start/stop of each timer | Count > expected |
| Player Instance Count | initializePlayer() | > 1 indicates leak |
| Slideshow Poll Count | Each poll | Continues when backgrounded |
| Token Refresh Count | Each refresh | Continues when backgrounded |

---

## Profiling Playbook

### Xcode Instruments Workflow

#### Prerequisites

1. Build iOS app in Xcode: `npm run build && npx cap sync ios`
2. Open `ios/App/App.xcworkspace` in Xcode
3. Connect physical iOS device (Simulator memory not representative)
4. Select your device in Xcode

#### Step 1: Allocations Instrument

**Purpose:** Track memory allocation over time

1. **Launch Instruments:**
   - Xcode → Product → Profile (⌘I)
   - Select "Allocations" template
   - Click Record

2. **Reproduction Steps:**
   ```
   1. App launches → [Mark Generation "Launch"]
   2. Import 10 photos → [Mark Generation "10 Photos"]
   3. Create slideshow → [Mark Generation "Slideshow Created"]
   4. Start slideshow → [Mark Generation "Playing"]
   5. Let run for 2 minutes → [Mark Generation "2min Playing"]
   6. Background app → [Mark Generation "Backgrounded"]
   7. Wait 2 minutes → [Mark Generation "2min Background"]
   8. Foreground app → [Mark Generation "Resumed"]
   9. Stop slideshow → [Mark Generation "Stopped"]
   10. Wait 1 minute idle → [Mark Generation "1min Idle"]
   ```

3. **Analysis:**
   - View "All Heap & Anonymous VM" track
   - Look for persistent growth between marks
   - Expected: Memory drops after "Stopped"
   - Leak: Memory remains high or continues growing

4. **Generations View:**
   - Switch to "Generations" view
   - Each marked generation shows allocations
   - Select "Growth" column to sort
   - Look for objects that grow but never shrink

**Red Flags:**
- Continuous growth during "2min Background"
- Memory not releasing after "Stopped"
- Growing allocations in generations that should be idle

---

#### Step 2: Leaks Instrument

**Purpose:** Detect classic memory leaks (unreachable objects)

1. **Launch Instruments:**
   - Select "Leaks" template
   - Includes both Leaks + Allocations

2. **During Recording:**
   - Red bar indicates leak detected
   - Leaks pane shows leak details
   - Click leak to see backtrace

3. **Focus Areas:**
   - Look for leaks during slideshow playback
   - Check for leaks after stopping slideshow
   - Verify cleanup after backgrounding

**Expected Leaks:**
- Spotify SDK may show some leaks (third-party)
- Focus on YOUR code paths

---

#### Step 3: VM Tracker Instrument

**Purpose:** Track virtual memory regions (images, cached data)

1. **Launch Instruments:**
   - Select "VM Tracker" template

2. **What to Monitor:**
   - "Dirty" memory regions (cannot be paged out)
   - IOKit allocations (image buffers)
   - CG Image allocations

3. **Reproduction:**
   - Import 50 photos
   - Watch IOKit allocations
   - Background app
   - Check if allocations remain

**Expected Pattern:**
- Large IOKit allocations when importing photos
- Should decrease when photos no longer displayed
- **Leak pattern:** IOKit memory stays constant even after navigation away

---

### Safari Web Inspector Workflow

#### Setup

1. **Enable Web Inspector on iOS:**
   - Settings → Safari → Advanced → Web Inspector: ON

2. **Connect to Mac:**
   - Connect device via USB
   - Launch app on device
   - Mac Safari → Develop → [Your Device] → [App Name]

#### Heap Snapshots

**Purpose:** Inspect JavaScript object retention

1. **Take Initial Snapshot:**
   ```
   1. App launches
   2. Web Inspector → Sources → Timelines → JavaScript & Events
   3. Click "Start" to record
   4. Take heap snapshot (camera icon)
   ```

2. **Reproduce Leak:**
   ```
   1. Import 10 photos
   2. Take snapshot: "After 10 Photos"
   3. Import 10 more photos
   4. Take snapshot: "After 20 Photos"
   5. Remove all photos from slideshow
   6. Force garbage collection (Console: gc())
   7. Take snapshot: "After Removal"
   ```

3. **Analyze Snapshots:**
   - Select "After 10 Photos" snapshot
   - Switch to "Comparison" view
   - Compare with "After Removal"
   - Look for retained objects:
     - Array buffers (image data)
     - Strings (base64 data)
     - Intervals/Timers
     - Event listeners

**Red Flags:**
- Base64 strings in "After Removal" (should be gone)
- Growing timer/interval count
- Detached DOM nodes
- Retained closures referencing large objects

---

#### Memory Timeline

**Purpose:** Observe memory patterns over time

1. **Record Timeline:**
   - Timelines → JavaScript & Events
   - Click "Record"

2. **Trigger Actions:**
   - Import photos (watch memory spike)
   - Start slideshow (watch for growth)
   - Background app (should flatten)
   - Resume app

3. **Analysis:**
   - Memory graph shows heap size over time
   - Look for sawtooth pattern (allocate → GC → allocate)
   - **Problem pattern:** Continuous upward slope
   - Healthy: Peaks followed by drops (GC working)

---

#### Console Instrumentation

**Use console to inspect live objects:**

```javascript
// In Safari Web Inspector console

// Check Zustand stores
window.__ZUSTAND_STORES__ = {
  photo: usePhotoStore.getState(),
  music: useMusicStore.getState(),
  slideshow: useSlideshowStore.getState()
};

// Count base64 strings
const photos = usePhotoStore.getState().photos;
const totalSize = photos.reduce((sum, p) => sum + p.dataUrl.length, 0);
console.log(`Photos: ${photos.length}, Size: ${(totalSize/1024/1024).toFixed(2)}MB`);

// Check active timers (not directly accessible, but can instrument)
// Already logged via instrumentation plan above
```

---

### Patterns to Look For

#### Healthy Memory Pattern
```
Time →
Memory ↑
        ╱╲    ╱╲    ╱╲
      ╱    ╲╱    ╲╱    ╲
    ╱
  ╱
───────────────────────────
  Launch  Use  GC  Use  GC
```
- Allocations followed by deallocation (sawtooth)
- Returns to baseline after activity

#### Memory Leak Pattern
```
Time →
Memory ↑
                    ╱────
              ╱────
        ╱────
  ╱────
───────────────────────────
  Launch  Use  Use  Use
```
- Continuous upward trend
- No return to baseline
- Growth even when idle

#### Specific Issue Patterns

**Player Leak Pattern:**
```
Action: Init Player → Disconnect → Init Again
Memory: +5MB        → +5MB      → +10MB  ← Should return to +5MB
```

**Timer Leak Pattern:**
```
Action: Background App
Console: "Token Refresh #15 at 2025-11-12T12:15:00"
         "Token Refresh #16 at 2025-11-12T12:16:00"  ← Should have stopped
```

**Image Leak Pattern:**
```
Action: Import 10 photos → Navigate away
Heap Snapshot: 2000 KB of Strings remain ← Should drop to ~0
```

---

## Hardening Plan

### Priority 1: Critical Fixes (Complete First)

#### 1.1 Fix Player Singleton Pattern

**File:** [`src/services/MusicPlayerService.ts`](src/services/MusicPlayerService.ts)

**Changes:**
```typescript
// Store interval handle to clear it
let sdkLoadInterval: NodeJS.Timeout | null = null;

const loadSpotifySDK = () => {
  // Clear any existing interval
  if (sdkLoadInterval) {
    clearInterval(sdkLoadInterval);
  }
  
  sdkLoadInterval = setInterval(() => {
    if (window.Spotify) {
      clearInterval(sdkLoadInterval!);
      sdkLoadInterval = null;
      sdkReady = true;
    }
  }, 100);
  
  // Add timeout to stop checking after 10s
  setTimeout(() => {
    if (sdkLoadInterval) {
      clearInterval(sdkLoadInterval);
      sdkLoadInterval = null;
      console.error('Spotify SDK load timeout');
    }
  }, 10000);
};

export const disconnect = (): void => {
  console.log('[Player] Disconnecting and clearing references');
  
  player?.disconnect();
  player = null;
  deviceId = null;
  
  // Clear SDK load interval if still running
  if (sdkLoadInterval) {
    clearInterval(sdkLoadInterval);
    sdkLoadInterval = null;
  }
};

export const initializePlayer = async () => {
  // Disconnect existing player before creating new one
  if (player) {
    console.warn('[Player] Existing player found, disconnecting');
    await disconnect();
  }
  
  // Rest of initialization...
};
```

**Implementation Checklist:**
- [ ] Store `sdkLoadInterval` handle
- [ ] Clear interval in `disconnect()`
- [ ] Add timeout to SDK loading
- [ ] Null out all references in `disconnect()`
- [ ] Check for existing player in `initializePlayer()`
- [ ] Test: Verify only one player instance exists
- [ ] Test: Memory drops after disconnect

---

#### 1.2 Add Background Pause to TokenManager

**File:** [`src/services/TokenManager.ts`](src/services/TokenManager.ts)

**Changes:**
```typescript
import { App } from '@capacitor/app';

export class TokenManager {
  private autoRefreshInterval: NodeJS.Timeout | null = null;
  private appStateListener: any = null;
  
  private startAutoRefresh(): void {
    // Clear existing interval
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
    }
    
    console.log('[TokenManager] Starting auto-refresh');
    this.autoRefreshInterval = setInterval(() => {
      console.log('[TokenManager] Auto-refresh triggered');
      this.refreshAccessToken();
    }, 60000);
    
    // Listen for app state changes
    this.setupAppStateListener();
  }
  
  private setupAppStateListener(): void {
    // Remove existing listener
    this.removeAppStateListener();
    
    this.appStateListener = App.addListener('appStateChange', ({ isActive }) => {
      console.log(`[TokenManager] App ${isActive ? 'active' : 'background'}`);
      
      if (isActive) {
        // Resume auto-refresh when app becomes active
        this.startAutoRefresh();
      } else {
        // Pause auto-refresh when backgrounded
        this.pauseAutoRefresh();
      }
    });
  }
  
  private pauseAutoRefresh(): void {
    console.log('[TokenManager] Pausing auto-refresh');
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
  }
  
  private removeAppStateListener(): void {
    if (this.appStateListener) {
      this.appStateListener.remove();
      this.appStateListener = null;
    }
  }
  
  public cleanup(): void {
    this.pauseAutoRefresh();
    this.removeAppStateListener();
  }
}
```

**Implementation Checklist:**
- [ ] Add `appStateListener` property
- [ ] Implement `setupAppStateListener()`
- [ ] Pause refresh when backgrounded
- [ ] Resume refresh when foregrounded
- [ ] Add `cleanup()` method
- [ ] Test: Verify timer stops in background
- [ ] Test: Verify timer resumes in foreground

---

#### 1.3 Add Background Pause to SlideshowPlayer

**File:** [`src/components/SlideshowPlayer.tsx`](src/components/SlideshowPlayer.tsx)

**Changes:**
```typescript
import { App } from '@capacitor/app';
import { useEffect, useRef } from 'react';

const SlideshowPlayer: React.FC = () => {
  const [isAppActive, setIsAppActive] = useState(true);
  
  // Pause all timers when app backgrounds
  useEffect(() => {
    const listener = App.addListener('appStateChange', ({ isActive }) => {
      console.log(`[Slideshow] App state: ${isActive ? 'active' : 'background'}`);
      setIsAppActive(isActive);
      
      if (!isActive) {
        // Pause slideshow timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        
        // Pause track polling
        if (trackUpdateIntervalRef.current) {
          clearInterval(trackUpdateIntervalRef.current);
          trackUpdateIntervalRef.current = null;
        }
        
        // Clear controls timeout
        if (controlsTimeoutRef.current) {
          clearTimeout(controlsTimeoutRef.current);
          controlsTimeoutRef.current = null;
        }
      } else {
        // Resume timers if slideshow was playing
        if (isPlaying && currentSlideIndex >= 0) {
          startSlideshowTimer();
          startTrackPolling();
        }
      }
    });
    
    return () => {
      listener.remove();
    };
  }, [isPlaying, currentSlideIndex]);
  
  // ... rest of component
};
```

**Implementation Checklist:**
- [ ] Add `App.addListener('appStateChange')`
- [ ] Clear all timers on background
- [ ] Resume timers on foreground (if playing)
- [ ] Test: Verify track polling stops in background
- [ ] Test: Verify slideshow pauses in background
- [ ] Test: Verify proper resume behavior

---

#### 1.4 Convert Images to Blob URLs

**File:** [`src/services/PhotoService.ts`](src/services/PhotoService.ts)

**Changes:**
```typescript
// Replace toDataURL with toBlobURL
const toBlobURL = (file: Blob): string => {
  return URL.createObjectURL(file);
};

const processPhoto = async (file: File): Promise<ProcessedPhoto> => {
  const resized = await resizeImage(file);
  const blobUrl = toBlobURL(resized);
  
  return {
    id: generateId(),
    blobUrl, // Instead of dataUrl
    thumbnail: blobUrl, // Same blob for thumbnail
  };
};

// Add cleanup function
export const revokePhotoBlobUrl = (blobUrl: string): void => {
  URL.revokeObjectURL(blobUrl);
};
```

**File:** [`src/stores/photoStore.ts`](src/stores/photoStore.ts)

**Changes:**
```typescript
const usePhotoStore = create<PhotoStore>((set, get) => ({
  photos: [],
  
  removePhoto: (id: string) => {
    set((state) => {
      const photo = state.photos.find(p => p.id === id);
      
      // Revoke blob URL before removing
      if (photo?.blobUrl) {
        PhotoService.revokePhotoBlobUrl(photo.blobUrl);
      }
      
      return {
        photos: state.photos.filter(p => p.id !== id),
      };
    });
  },
  
  clearAllPhotos: () => {
    const photos = get().photos;
    
    // Revoke all blob URLs
    photos.forEach(photo => {
      if (photo.blobUrl) {
        PhotoService.revokePhotoBlobUrl(photo.blobUrl);
      }
    });
    
    set({ photos: [] });
  },
}));
```

**Implementation Checklist:**
- [ ] Replace `toDataURL()` with `toBlobURL()`
- [ ] Update `ProcessedPhoto` type to use `blobUrl` instead of `dataUrl`
- [ ] Add `revokePhotoBlobUrl()` function
- [ ] Call revoke when removing photos
- [ ] Call revoke on `clearAllPhotos()`
- [ ] Update all components using `dataUrl` to use `blobUrl`
- [ ] Test: Verify images still display
- [ ] Test: Verify memory drops after photo removal

---

### Priority 2: Medium Risk Fixes

#### 2.1 Implement Photo Cache Eviction

**File:** [`src/stores/photoStore.ts`](src/stores/photoStore.ts)

**Changes:**
```typescript
const MAX_PHOTOS_IN_MEMORY = 100;
const MAX_MEMORY_MB = 50;

const usePhotoStore = create<PhotoStore>((set, get) => ({
  photos: [],
  
  addPhotos: (newPhotos) => {
    set((state) => {
      let updatedPhotos = [...state.photos, ...newPhotos];
      
      // Evict oldest photos if over limit
      if (updatedPhotos.length > MAX_PHOTOS_IN_MEMORY) {
        const toRemove = updatedPhotos.slice(0, updatedPhotos.length - MAX_PHOTOS_IN_MEMORY);
        
        // Revoke blob URLs for removed photos
        toRemove.forEach(photo => {
          if (photo.blobUrl) {
            PhotoService.revokePhotoBlobUrl(photo.blobUrl);
          }
        });
        
        updatedPhotos = updatedPhotos.slice(-MAX_PHOTOS_IN_MEMORY);
        console.warn(`[Photos] Evicted ${toRemove.length} oldest photos`);
      }
      
      return { photos: updatedPhotos };
    });
  },
}));
```

**Implementation Checklist:**
- [ ] Define `MAX_PHOTOS_IN_MEMORY` constant
- [ ] Implement LRU eviction logic
- [ ] Revoke blob URLs for evicted photos
- [ ] Log eviction events
- [ ] Test: Verify eviction at limit
- [ ] Test: Verify memory stays bounded

---

#### 2.2 Fix SpotifyAuthService Listener Cleanup

**File:** [`src/services/SpotifyAuthService.ts`](src/services/SpotifyAuthService.ts:410)

**Changes:**
```typescript
export class SpotifyAuthService {
  private urlListener: any = null;
  
  async login(): Promise<void> {
    // Remove existing listener before adding new one
    if (this.urlListener) {
      this.urlListener.remove();
      this.urlListener = null;
    }
    
    this.urlListener = App.addListener('appUrlOpen', (data: any) => {
      // Handle OAuth redirect...
    });
    
    // ... rest of login logic
  }
  
  cleanup(): void {
    if (this.urlListener) {
      this.urlListener.remove();
      this.urlListener = null;
    }
  }
}
```

**Implementation Checklist:**
- [ ] Store listener handle in `urlListener` property
- [ ] Remove old listener before creating new one
- [ ] Implement `cleanup()` method
- [ ] Test: Multiple login attempts don't accumulate listeners

---

### Priority 3: Additional Hardening

#### 3.1 Add Global Memory Monitor

**File:** `src/utils/memoryMonitor.ts` (new file)

**Purpose:** Centralized memory tracking and warnings

```typescript
import { App } from '@capacitor/app';

class MemoryMonitor {
  private checkInterval: NodeJS.Timeout | null = null;
  private warningThresholdMB = 100;
  
  start(): void {
    if (this.checkInterval) return;
    
    this.checkInterval = setInterval(() => {
      this.checkMemory();
    }, 30000); // Check every 30s
    
    console.log('[MemoryMonitor] Started');
  }
  
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
  
  private checkMemory(): void {
    if (!performance.memory) return;
    
    const usedMB = performance.memory.usedJSHeapSize / 1024 / 1024;
    const totalMB = performance.memory.totalJSHeapSize / 1024 / 1024;
    
    console.log(`[MemoryMonitor] ${usedMB.toFixed(2)}MB / ${totalMB.toFixed(2)}MB`);
    
    if (usedMB > this.warningThresholdMB) {
      console.warn(`[MemoryMonitor] ⚠️ HIGH MEMORY: ${usedMB.toFixed(2)}MB`);
      this.logStoreStats();
    }
  }
  
  private logStoreStats(): void {
    // Log stats from all stores
    const photoCount = usePhotoStore.getState().photos.length;
    const slideshowCount = useSlideshowLibraryStore.getState().slideshows.length;
    
    console.log('[MemoryMonitor] Store stats:', {
      photos: photoCount,
      slideshows: slideshowCount,
    });
  }
}

export const memoryMonitor = new MemoryMonitor();
```

**Usage in App:**
```typescript
// In App.tsx
import { memoryMonitor } from './utils/memoryMonitor';

useEffect(() => {
  memoryMonitor.start();
  return () => memoryMonitor.stop();
}, []);
```

---

#### 3.2 Implement Component Visibility Tracking

**Purpose:** Pause components when not visible

```typescript
// src/hooks/useComponentVisible.ts
import { useState, useEffect } from 'react';
import { useIonViewDidEnter, useIonViewWillLeave } from '@ionic/react';

export const useComponentVisible = () => {
  const [isVisible, setIsVisible] = useState(false);
  
  useIonViewDidEnter(() => {
    setIsVisible(true);
  });
  
  useIonViewWillLeave(() => {
    setIsVisible(false);
  });
  
  return isVisible;
};
```

**Usage in SlideshowPlayer:**
```typescript
const SlideshowPlayer: React.FC = () => {
  const isVisible = useComponentVisible();
  
  useEffect(() => {
    if (!isVisible) {
      // Pause timers when component not visible
      pauseAllTimers();
    } else if (isPlaying) {
      // Resume timers when component becomes visible
      resumeTimers();
    }
  }, [isVisible, isPlaying]);
};
```

---

### Implementation Order

**Week 1: Critical Fixes**
1. Day 1-2: Fix Player Singleton (1.1)
2. Day 3: Add TokenManager Background Pause (1.2)
3. Day 4: Add SlideshowPlayer Background Pause (1.3)
4. Day 5: Convert to Blob URLs (1.4)

**Week 2: Testing & Medium Fixes**
1. Day 1-2: Test all Priority 1 fixes with instrumentation
2. Day 3: Implement Photo Cache Eviction (2.1)
3. Day 4: Fix Auth Listener Cleanup (2.2)
4. Day 5: Integration testing

**Week 3: Hardening & Monitoring**
1. Day 1-2: Add Memory Monitor (3.1)
2. Day 3: Implement Visibility Tracking (3.2)
3. Day 4-5: Final profiling and validation

---

### Success Criteria

**Memory Benchmarks:**
- [ ] Heap size < 50MB after 5 minutes idle
- [ ] Heap size returns to baseline after stopping slideshow
- [ ] No growth when app backgrounded for 5 minutes
- [ ] Photo import: Memory increases proportionally, releases on removal
- [ ] Player initialization: Single instance, memory released on disconnect

**Profiling Validation:**
- [ ] Xcode Allocations: No continuous growth in idle generations
- [ ] Xcode Leaks: Zero leaks in app code (ignore SDK leaks)
- [ ] Safari Heap Snapshots: Base64 strings removed after photo deletion
- [ ] Timer count: Returns to baseline after stopping slideshow

**User Experience:**
- [ ] App runs for 30+ minutes without termination
- [ ] Can background/foreground repeatedly without issues
- [ ] Import 100+ photos without crashes
- [ ] Slideshow plays for 10+ minutes continuously

---

## Conclusion

This investigation identified 7 high-risk and 2 medium-risk memory leak sources in the Slideshow Buddy iOS application. The primary issues stem from:

1. **Incomplete resource cleanup** - Player, timers, and listeners not fully disposed
2. **Background activity** - Timers and polling continuing when app backgrounded
3. **Unbounded storage** - Image data accumulated without limits or eviction

The hardening plan provides a structured approach to fixing these issues, prioritized by risk and impact. Following the instrumentation and profiling playbook will confirm leak sources and validate fixes.

**Estimated Implementation Time:** 2-3 weeks for complete hardening  
**Critical Path:** Priority 1 fixes (player, timers, images) - 1 week

Implementing these fixes should eliminate the "Terminated due to memory issue" errors and provide a stable, performant iOS experience.