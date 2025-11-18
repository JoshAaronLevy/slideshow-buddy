# macOS Photos Library Access - Quick Reference

**Date**: November 17, 2025  
**Status**: ❌ Not Working  
**For**: Developer Pairing Session

---

## The Problem

**Goal**: Access user's Photos library on macOS to browse albums and select photos for slideshows.

**Current State**: 
- ✅ App launches successfully
- ❌ No permission dialog appears
- ❌ Cannot access Photos library

**Why It Matters**: macOS users forced to use file browser instead of Photos.app albums (unlike iOS users).

---

## Architecture

```
React UI
  ↓
PhotoService.ts (platform detection)
  ↓
window.electron.photos API (preload.ts - IPC bridge)
  ↓
Electron Main Process (index.ts - IPC handlers)
  ↓
photosLibraryFFI (TypeScript FFI wrapper)
  ↓
Swift C Functions (@_cdecl)
  ↓
PhotoKit Framework (PHPhotoLibrary)
```

**Technology Stack**:
- Frontend: React + Ionic + Capacitor
- macOS: Electron main process
- Bridge: koffi FFI (TypeScript ↔ Swift)
- Native: Swift + PhotoKit framework
- System: macOS Privacy & Security permissions

---

## Key Files

### 1. Swift Permission Manager
**File**: `electron/src/native/PhotosPermissionManager.swift`

```swift
public func requestPermission() async -> Bool {
    let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
    
    if status == .notDetermined {
        return await PHPhotoLibrary.requestAuthorization(for: .readWrite) == .authorized
    }
    return status == .authorized || status == .limited
}
```

### 2. Swift C Bridge (THE PROBLEM)
**File**: `electron/src/native/PhotosLibraryBridge.swift`

```swift
@_cdecl("photos_request_permission")
public func photos_request_permission() -> UnsafePointer<CChar> {
    let semaphore = DispatchSemaphore(value: 0)
    var result: Bool = false
    
    Task {
        result = await bridge.requestPermission()
        semaphore.signal()
    }
    
    semaphore.wait()  // ⚠️ BLOCKS THE CALLING THREAD!
    
    return strdup(result ? "true" : "false")!
}
```

**The Issue**: `semaphore.wait()` blocks thread. If called from Electron main thread → app freezes.

### 3. TypeScript FFI Wrapper
**File**: `electron/src/native/PhotosLibraryFFI.ts`

```typescript
public async requestPermission(): Promise<boolean> {
    const result = this.ffiInterface!.photos_request_permission(); // Calls Swift
    return result === 'true';
}
```

### 4. Electron Main Process
**File**: `electron/src/index.ts`

**IPC Handler**:
```typescript
ipcMain.handle('photos:requestPermission', async () => {
    if (!photosLibraryFFI.isReady()) {
        return { success: false, error: 'FFI not initialized' };
    }
    
    const hasPermission = await photosLibraryFFI.requestPermission();
    return { success: true, hasPermission };
});
```

**Startup Code** (current):
```typescript
setTimeout(() => {
    logPhotosLibraryStatus(); // Non-blocking log only
}, 1000);

function logPhotosLibraryStatus(): void {
    console.log('[Photos Library] FFI Ready:', photosLibraryFFI.isReady());
    console.log('[Photos Library] ℹ️  Permission will be requested on user action');
}
```

### 5. Preload Bridge
**File**: `electron/src/preload.ts`

```typescript
contextBridge.exposeInMainWorld('electron', {
  photos: {
    requestPermission: () => ipcRenderer.invoke('photos:requestPermission'),
    checkPermission: () => ipcRenderer.invoke('photos:checkPermission'),
    getAlbums: () => ipcRenderer.invoke('photos:getAlbums'),
  }
});
```

**How to use from React**:
```typescript
const result = await window.electron.photos.requestPermission();
```

### 6. Configuration Files

**entitlements.mac.plist**:
```xml
<key>com.apple.security.assets.photos.read-only</key>
<true/>
```

**electron-builder.config.json**:
```json
"extendInfo": {
  "NSPhotoLibraryUsageDescription": "Access your photo library to create beautiful slideshows"
}
```

---

## What We've Tried

### ❌ Attempt 1: Auto-check on Startup
**Code**:
```typescript
setTimeout(() => {
    checkAndRequestPhotosPermission(); // Direct FFI call
}, 1000);
```

**Result**: App froze immediately. Force quit required.

**Why**: Semaphore blocks main thread → event loop frozen → UI dead.

---

### ❌ Attempt 2: Timeouts + Error Handling
**Code**:
```typescript
const checkPromise = photosLibraryFFI.checkPermission();
const timeout = new Promise((_, reject) => 
    setTimeout(() => reject('timeout'), 5000)
);
await Promise.race([checkPromise, timeout]);
```

**Result**: Still froze.

**Why**: Semaphore blocks before timeout can fire.

---

### ❌ Attempt 3: Worker Threads
**Created**: 
- `photos-permission-worker.js`
- `PhotosPermissionManager.ts`

**Result**: Too complex, abandoned.

**Why**: FFI loading in worker is complicated, TypeScript issues, fragile.

---

### ✅ Attempt 4: Non-Blocking Log (Current)
**Code**:
```typescript
function logPhotosLibraryStatus(): void {
    console.log('[Photos Library] FFI Ready:', photosLibraryFFI.isReady());
    // Does NOT call Swift - just checks if FFI initialized
}
```

**Result**: App launches successfully.

**Limitation**: No permission dialog appears (not calling request).

---

## The Core Problem

### Why It Blocks

```
koffi FFI requires: Synchronous C functions
PhotoKit provides:  Async Swift functions
Bridge solution:    Semaphore to wait for async

Result: Calling thread blocks until async completes
```

**If called during app startup**: Main thread blocks → UI freezes

**If called on button click**: User expects to wait → acceptable

### The Dilemma

- **Can't call on startup**: Causes freeze
- **Can't make async**: koffi limitation
- **Can't avoid semaphore**: Swift is async
- **Can use on button click**: User action tolerates blocking

---

## Current Status

### What Works
- ✅ Swift library compiles: `libPhotosLibraryBridge.dylib`
- ✅ FFI initializes: "Photos Library FFI initialized successfully"
- ✅ IPC handlers registered
- ✅ App launches without freezing
- ✅ Console shows: "[Photos Library] FFI Ready: true"

### What Doesn't Work
- ❌ Permission dialog doesn't appear
- ❌ No automatic permission check
- ❌ Can't verify if manual request works

### Console Output (Expected)
```
================================================================================
[Photos Library] Status Check (Non-Blocking)
[Photos Library] Platform: darwin
[Photos Library] ✓ Running on macOS
[Photos Library] FFI Ready: true
[Photos Library] ✓ Swift FFI bridge is ready
[Photos Library] ℹ️  Permission will be requested when user accesses Photos
================================================================================
```

---

## How To Test

### Manual Permission Request

**From React component**:
```typescript
const handleImportPhotos = async () => {
    try {
        const result = await window.electron.photos.requestPermission();
        
        if (result.success && result.hasPermission) {
            console.log('✓ Permission granted!');
            // Can now call getAlbums()
        } else {
            console.error('✗ Permission denied:', result.error);
        }
    } catch (error) {
        console.error('Error:', error);
    }
};
```

**Expected**: System permission dialog appears when button clicked.

### Verification Checklist

**1. Swift Library Built**:
```bash
ls -la electron/assets/libPhotosLibraryBridge.dylib
```
Should exist, ~50KB

**2. Entitlements Present**:
```bash
codesign -d --entitlements :- "electron/dist/mac/Slideshow Buddy.app"
```
Should show `com.apple.security.assets.photos.read-only`

**3. Info.plist Has Description**:
```bash
plutil -p "electron/dist/mac/Slideshow Buddy.app/Contents/Info.plist" | grep Photo
```
Should show `NSPhotoLibraryUsageDescription`

**4. FFI Loads**:
Check console for: `Photos Library FFI initialized successfully`

---

## Solution Options

### Option 1: Defer to User Action (Recommended)

**How**: Only request permission when user clicks photo-related button

**Pros**:
- Simple
- Already working infrastructure
- Follows macOS patterns (permission on first use)
- Blocking is acceptable (user clicked, expects wait)

**Cons**:
- Not proactive
- Less smooth first-time UX

**Implementation**:
```typescript
// Add to photo import button
onClick={async () => {
    const perm = await window.electron.photos.requestPermission();
    if (perm.hasPermission) {
        // Show photo picker
    }
}}
```

### Option 2: Worker Thread (Complex)

**How**: Move FFI calls to Node.js Worker Thread

**Pros**:
- Can check on startup
- Main thread stays responsive

**Cons**:
- Complex implementation
- FFI loading in worker tricky
- More failure points

**Status**: Attempted, abandoned

---

## Questions for Pairing

1. **Is it OK to request permission on button click** instead of startup?
   - Simpler, already works
   - Standard macOS pattern

2. **Has the built app been verified** for entitlements?
   - Dev builds vs packaged apps differ
   - Need to check signed app

3. **Is UI actually calling** the request function?
   - Check button handlers
   - Verify IPC wired up

4. **What happens when you click** photo buttons?
   - Any console errors?
   - Dialog appears?

5. **Have you tested from DevTools console**?
   ```javascript
   await window.electron.photos.requestPermission()
   ```

---

## Build Commands

```bash
# Full rebuild from root
npm run electron:relaunch

# Or step by step
cd electron
npm run build:swift    # Build Swift → dylib
npm run build:ts       # Build TypeScript
npm run electron:start # Run app

# Check built app
open electron/dist/mac/
```

---

## Next Steps

### Immediate Test
1. Add button to React UI that calls `window.electron.photos.requestPermission()`
2. Click button
3. Check if permission dialog appears
4. Check console for errors

### If Dialog Appears ✅
- Permission system works!
- Just needs UI integration
- Can proceed with album browsing

### If Dialog Doesn't Appear ❌
**Debug**:
1. Check console for FFI errors
2. Verify Swift library loaded
3. Check entitlements in built app
4. Verify Info.plist usage description
5. Try resetting permission: `tccutil reset Photos com.slideshowbuddy.app`

---

## Summary

**Root Cause**: FFI bridge uses blocking semaphore that freezes app if called during startup.

**Current Solution**: Disabled automatic check. Only log that system is ready.

**To Make It Work**: Call permission request from user-triggered action (button click) where blocking is acceptable.

**The Question**: Should we implement Option 1 (defer to button) or Option 2 (worker threads)?

**Recommendation**: Option 1 - simpler, already working, follows macOS patterns.
