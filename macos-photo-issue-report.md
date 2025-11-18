# macOS Photo Library Access - Issue Report

**Date**: November 17, 2025  
**Platform**: macOS Sequoia 15.0+ (Electron app)  
**Status**: 🔴 NOT WORKING  
**Issue Type**: Permission system fails to show system dialog or access Photos library

---

## The Problem

The app needs to access the user's Apple Photos library (located at `~/Pictures/Photos Library.photoslibrary`) to allow users to import photos for slideshows. This works perfectly on iOS using Capacitor's built-in photo APIs, but **does not work on macOS Electron**.

### What Should Happen
1. App launches on macOS
2. When user tries to access Photos (or on first launch), system should show permission dialog
3. Dialog says: "Slideshow Buddy would like to access your photos"
4. User clicks "OK" to grant permission
5. App can now access photos via PhotoKit APIs

### What Actually Happens
1. App launches successfully ✅
2. No permission dialog ever appears ❌
3. Logs show FFI bridge is initialized ✅
4. But no Photos library access occurs ❌

---

## Architecture Overview

The macOS implementation uses a **multi-layer architecture** to bridge JavaScript (Electron) to Swift (PhotoKit):

```
React UI (TypeScript)
    ↓
PhotoService.ts (src/services/)
    ↓
Electron Renderer Process (window.electron.photos)
    ↓
IPC (Inter-Process Communication)
    ↓
Electron Main Process (electron/src/index.ts)
    ↓
PhotosLibraryFFI.ts (TypeScript FFI wrapper)
    ↓
koffi (Node.js FFI library)
    ↓
PhotosLibraryBridge.swift (Swift C bridge)
    ↓
PhotosPermissionManager.swift (Swift PhotoKit)
    ↓
PHPhotoLibrary (Apple's PhotoKit Framework)
    ↓
macOS Photo Library
```

### Why This Complexity?
- **Electron doesn't have native PhotoKit access** - it's a Node.js/Chromium app
- **Swift is required** - PhotoKit is an Apple framework only accessible from Swift/Objective-C
- **FFI bridge is necessary** - koffi allows Node.js to call Swift dynamic libraries
- **C functions required** - FFI can only call C-compatible functions, not Swift async/await directly

---

## Current Code Structure

### 1. Swift Native Layer

**Files**:
- `electron/src/native/PhotosLibraryBridge.swift` - Main bridge class
- `electron/src/native/PhotosPermissionManager.swift` - Handles PHPhotoLibrary permission
- `electron/src/native/PhotoAssetConverter.swift` - Converts PHAsset to JSON
- `electron/src/native/types.ts` - TypeScript type definitions

**Key Swift Functions** (exposed to C via `@_cdecl`):
```swift
@_cdecl("photos_request_permission")
public func photos_request_permission() -> UnsafePointer<CChar> {
    let bridge = PhotosLibraryBridge()
    let semaphore = DispatchSemaphore(value: 0)
    var permissionResult: Bool = false
    
    Task {
        permissionResult = await bridge.requestPermission()
        semaphore.signal()
    }
    
    semaphore.wait()  // ⚠️ BLOCKS THE CALLING THREAD
    return UnsafePointer(strdup(permissionResult ? "true" : "false")!)
}
```

**Critical Issue**: The semaphore blocks the calling thread. When called from Electron's main process during app initialization, this freezes the entire UI.

### 2. TypeScript FFI Bridge

**File**: `electron/src/native/PhotosLibraryFFI.ts`

**Purpose**: Wraps koffi FFI calls to Swift library

**Key Methods**:
```typescript
class PhotosLibraryFFI {
  public async requestPermission(): Promise<boolean> {
    // Calls Swift photos_request_permission() via koffi
    const jsonResult = this.callStringFunction(() => 
      this.ffiInterface!.photos_request_permission()
    );
    return jsonResult === 'true';
  }
  
  public checkPermission(): boolean {
    // Calls Swift photos_check_permission() via koffi
    const jsonResult = this.callStringFunction(() => 
      this.ffiInterface!.photos_check_permission()
    );
    return jsonResult === 'true';
  }
}

export const photosLibraryFFI = new PhotosLibraryFFI();
```

**How It Loads Swift Library**:
1. Looks for `libPhotosLibraryBridge.dylib` in multiple paths
2. Uses koffi to load the dynamic library
3. Defines C function signatures that map to Swift `@_cdecl` functions
4. Wraps calls in TypeScript-friendly methods

### 3. Electron Main Process IPC Handlers

**File**: `electron/src/index.ts`

**IPC Handlers**:
```typescript
// Check permission (synchronous)
ipcMain.handle('photos:checkPermission', async () => {
  if (process.platform !== 'darwin') {
    return { success: false, error: 'Photos library only available on macOS' };
  }
  
  if (!photosLibraryFFI.isReady()) {
    return { success: false, error: 'Photos library FFI not initialized' };
  }
  
  const hasPermission = photosLibraryFFI.checkPermission();
  return { success: true, hasPermission };
});

// Request permission (async, but blocks due to semaphore)
ipcMain.handle('photos:requestPermission', async () => {
  if (process.platform !== 'darwin') {
    return { success: false, error: 'Photos library only available on macOS' };
  }
  
  if (!photosLibraryFFI.isReady()) {
    return { success: false, error: 'Photos library FFI not initialized' };
  }
  
  const hasPermission = await photosLibraryFFI.requestPermission();
  return { success: true, hasPermission };
});
```

### 4. Electron Preload (Renderer Bridge)

**File**: `electron/src/preload.ts`

**Exposes to Renderer**:
```typescript
contextBridge.exposeInMainWorld('electron', {
  photos: {
    requestPermission: (): Promise<PhotosPermissionResult> =>
      ipcRenderer.invoke('photos:requestPermission'),
    checkPermission: (): Promise<PhotosPermissionResult> =>
      ipcRenderer.invoke('photos:checkPermission'),
    getAlbums: (): Promise<PhotosAlbumsResult> =>
      ipcRenderer.invoke('photos:getAlbums'),
    getPhotos: (albumId?: string, quantity?: number): Promise<PhotosResult> =>
      ipcRenderer.invoke('photos:getPhotos', albumId, quantity)
  }
});
```

### 5. React Application Layer

**File**: `src/services/PhotoService.ts`

**Key Function**:
```typescript
const requestPhotosPermissionElectron = async (): Promise<boolean> => {
  // Check if API available
  if (!(window as any).electron?.photos) {
    return false;
  }
  
  // Check current permission
  const checkResult = await window.electron.photos.checkPermission();
  if (checkResult.hasPermission) {
    return true;
  }
  
  // Request permission
  const requestResult = await window.electron.photos.requestPermission();
  return requestResult.hasPermission || false;
};
```

---

## Configuration Files

### 1. Entitlements (CRITICAL)

**File**: `electron/resources/entitlements.mac.plist`

```xml
<key>com.apple.security.app-sandbox</key>
<true/>

<key>com.apple.security.assets.photos.read-only</key>
<true/>
```

**What This Does**: Grants the app permission to **request** Photos access. Without this entitlement, the OS will never show the permission dialog.

**Build Process**: electron-builder copies this file into the app bundle during build.

### 2. Info.plist Keys

**File**: `electron/electron-builder.config.json`

```json
"extendInfo": {
  "NSPhotoLibraryUsageDescription": "Access your photo library to create beautiful slideshows"
}
```

**What This Does**: Provides the text shown to users in the permission dialog. **Required** - without this, the dialog won't appear.

**Build Process**: electron-builder injects this into the app's `Info.plist` during build.

### 3. Swift Build Script

**File**: `electron/scripts/build-swift.sh`

**What It Does**:
1. Compiles Swift files into object files
2. Links them into `libPhotosLibraryBridge.dylib`
3. Copies dylib to `electron/assets/`

**Run Command**: `cd electron && npm run build:swift`

---

## What We've Tried

### Attempt 1: Automatic Permission Check on Startup ❌

**Implementation**:
```typescript
myCapacitorApp.init = async function(...args) {
  // ... window setup ...
  
  setTimeout(() => {
    checkAndRequestPhotosPermission();
  }, 1000);
};
```

**Result**: App froze immediately on launch with spinning cursor. Force quit required.

**Root Cause**: The Swift FFI bridge uses `DispatchSemaphore.wait()` which blocks the calling thread. When called from Electron's main process during initialization, it blocks the event loop, freezing the entire UI.

**Why It Failed**:
- Electron's main process runs on a single thread
- All UI events, IPC, and timers share this thread
- Blocking the thread = frozen app
- No events can be processed = can't even show error dialog

### Attempt 2: Wrap in setImmediate() and Timeout Protection ❌

**Implementation**:
```typescript
setTimeout(() => {
  setImmediate(() => {
    checkAndRequestPhotosPermission().catch(error => {
      console.error('[Photos Permission] Failed:', error);
    });
  });
}, 1500);

// Added timeout protection
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Timeout')), 5000);
});
const result = await Promise.race([checkPromise, timeoutPromise]);
```

**Result**: Still froze. `setImmediate()` doesn't create a new thread, just defers execution on the same thread.

**Why It Failed**:
- `setImmediate()` schedules work on the event loop
- But the semaphore still blocks when executed
- Event loop can't process anything else while blocked
- Timeout never fires because timer callback can't run

### Attempt 3: Disable Automatic Check, Add Non-Blocking Status Log ✅ (Partial)

**Implementation**:
```typescript
function logPhotosLibraryStatus(): void {
  console.log('[Photos Library] FFI Ready:', photosLibraryFFI.isReady());
  // No blocking calls, just checks if FFI initialized
}

setTimeout(() => {
  logPhotosLibraryStatus();
}, 1000);
```

**Result**: App launches successfully! No freeze! But... no permission dialog either.

**Why This Works (But Doesn't Solve The Problem)**:
- Only checks if FFI is initialized (non-blocking)
- Doesn't call any Swift functions
- App launches fine
- But permission is never actually requested

### Attempt 4: Worker Threads (Attempted, Not Completed) ⚠️

**Concept**:
```javascript
const { Worker } = require('worker_threads');
const worker = new Worker('./photos-permission-worker.js');

worker.postMessage('check-permission');
worker.on('message', (result) => {
  // Result from worker
});
```

**Why This Could Work**:
- Worker runs on separate thread
- Semaphore blocks worker, not main thread
- Main thread stays responsive

**Why Not Implemented**:
- Complex to set up with Electron + FFI + TypeScript
- FFI library needs to be loaded in worker context
- Difficult to pass koffi library instance between threads
- High risk of introducing new bugs
- Requires significant refactoring

---

## The Core Issue

### The Fundamental Problem

**The permission system requires a synchronous response, but the implementation is asynchronous with blocking.**

```
User clicks button
  → Renderer calls window.electron.photos.requestPermission()
    → IPC to main process
      → Main process calls photosLibraryFFI.requestPermission()
        → FFI calls Swift photos_request_permission()
          → Swift creates async Task
            → Task calls PHPhotoLibrary.requestAuthorization()
              → macOS shows permission dialog (async)
              → User clicks button
              → Callback fires
              → Task completes
            → Swift signals semaphore
          → Swift wait() blocks until signal
        → FFI returns result to main process
      → Main process returns via IPC
    → Renderer receives result
  → UI updates
```

**The problem**: The `semaphore.wait()` in Swift blocks the thread that called it. If that's Electron's main thread, the entire app freezes.

### Why The System Dialog Doesn't Appear

Even when the code doesn't freeze, the permission dialog may not appear due to:

1. **Missing Info.plist Key**
   - If `NSPhotoLibraryUsageDescription` is not in the built app's Info.plist
   - macOS silently denies the request
   - No dialog shown, no error thrown

2. **Missing Entitlement**
   - If `com.apple.security.assets.photos.read-only` is not in entitlements
   - macOS denies the request before even checking permission status
   - App can't even ask for permission

3. **Permission Already Decided**
   - If user previously granted/denied permission
   - macOS remembers the decision
   - Dialog won't show again (returns cached result)

4. **Calling From Wrong Thread**
   - PhotoKit UI (permission dialog) must be presented from main thread
   - If called from background thread, may fail silently

5. **Unsigned App Bundle**
   - macOS is stricter with unsigned apps
   - Entitlements may not be honored
   - Permissions may be denied by default

---

## Current State

### What Works ✅
- App launches without freezing
- Swift library compiles and loads successfully
- FFI bridge initializes correctly
- IPC handlers are registered
- Logs show "Photos Library FFI initialized successfully"
- Code structure is correct and follows best practices

### What Doesn't Work ❌
- Permission dialog never appears
- Can't access Photos library
- `checkPermission()` might return false (or freeze if called)
- `requestPermission()` doesn't show system dialog (or freezes if called)

### Console Output When App Launches

```
Photos Library FFI initialized successfully
... (other startup logs) ...
```

**Missing**: No logs about permission status, no indication that permission check was attempted.

**Expected** (if working):
```
================================================================================
[Photos Library] Status Check (Non-Blocking)
[Photos Library] Platform: darwin
[Photos Library] ✓ Running on macOS
[Photos Library] FFI Ready: true
================================================================================
```

**But we're not even seeing this** - which means `logPhotosLibraryStatus()` might not be running, or is failing silently.

---

## Verification Checklist

### Build Configuration
- [ ] Swift library built: `cd electron && npm run build:swift`
- [ ] Swift dylib exists: `electron/assets/libPhotosLibraryBridge.dylib`
- [ ] TypeScript compiled: `cd electron && npm run build:ts`
- [ ] App bundle created: `electron/dist/mac/Slideshow Buddy.app`

### Runtime Configuration
- [ ] Info.plist key present in built app:
  ```bash
  plutil -p "electron/dist/mac/Slideshow Buddy.app/Contents/Info.plist" | grep Photo
  ```
  Should show: `NSPhotoLibraryUsageDescription`

- [ ] Entitlements applied to built app:
  ```bash
  codesign -d --entitlements :- "electron/dist/mac/Slideshow Buddy.app"
  ```
  Should show: `com.apple.security.assets.photos.read-only`

- [ ] Swift library included in app:
  ```bash
  ls "electron/dist/mac/Slideshow Buddy.app/Contents/Resources/"
  ```
  Should see: `libPhotosLibraryBridge.dylib`

### Permission State
- [ ] Check current permission status:
  ```bash
  tccutil reset Photos com.slideshowbuddy.app
  ```
  This resets permission to "not determined" for fresh testing

- [ ] Check system logs for permission denials:
  ```bash
  log stream --predicate 'subsystem == "com.apple.TCC"' --level debug
  ```
  Run this in a separate terminal, then try to access photos

---

## Potential Solutions

### Option 1: User-Triggered Permission Request (Simplest)

**Approach**: Only request permission when user clicks a specific button (e.g., "Import from Photos Library").

**Pros**:
- User expects to wait when they click a button
- Blocking is acceptable in this context
- Can show loading spinner during wait
- Matches standard macOS app behavior

**Cons**:
- Not proactive (user doesn't know until they try)
- First-time UX is less smooth

**Implementation**:
```typescript
// In PhotoPickerModal or similar
const handleImportFromPhotos = async () => {
  setLoading(true);
  try {
    const hasPermission = await window.electron.photos.requestPermission();
    if (hasPermission) {
      // Fetch photos
    } else {
      // Show error: "Permission denied. Enable in System Settings"
    }
  } finally {
    setLoading(false);
  }
};
```

### Option 2: Worker Thread (More Complex)

**Approach**: Move FFI calls to a Node.js Worker Thread so blocking doesn't freeze main thread.

**Pros**:
- Main thread stays responsive
- Can request permission at any time
- Better UX (can be proactive)

**Cons**:
- Complex to implement
- Need to pass FFI library to worker
- Harder to debug
- More moving parts

**Implementation**: (See Attempt 4 notes above)

### Option 3: Native Node Addon (Most Complex)

**Approach**: Replace koffi FFI with a native Node.js addon that properly handles async Swift calls.

**Pros**:
- Can implement truly async bridge
- No blocking semaphores needed
- Full control over threading

**Cons**:
- Very complex (requires C++ knowledge)
- Long development time
- More difficult to maintain
- Harder to build/distribute

### Option 4: AppleScript Workaround (Hacky)

**Approach**: Use `osascript` to trigger permission dialog via AppleScript.

**Pros**:
- No FFI needed
- Can be fully async

**Cons**:
- Very limited PhotoKit access
- Fragile
- Not recommended for production
- Might not work with sandboxing

---

## Debugging Steps for Next Session

### 1. Verify Build Is Correct

```bash
cd electron
npm run build:swift
npm run build:ts
npm run build:mac:unsigned
```

### 2. Check Built App's Info.plist

```bash
plutil -p "electron/dist/mac/Slideshow Buddy.app/Contents/Info.plist" | grep -A 2 Photo
```

**Expected**:
```
"NSPhotoLibraryUsageDescription" => "Access your photo library to create beautiful slideshows"
```

### 3. Check Entitlements

```bash
codesign -d --entitlements :- "electron/dist/mac/Slideshow Buddy.app/Contents/Resources/app.asar"
```

**Expected** to see in XML:
```xml
<key>com.apple.security.assets.photos.read-only</key>
<true/>
```

### 4. Test Permission Manually

Add a button to the UI that explicitly calls:
```typescript
const testButton = () => {
  console.log('Test button clicked');
  window.electron.photos.requestPermission()
    .then(result => console.log('Permission result:', result))
    .catch(error => console.error('Permission error:', error));
};
```

### 5. Watch System Logs

In a separate terminal:
```bash
log stream --predicate 'subsystem == "com.apple.TCC"' --level debug
```

Click the test button and watch for log entries about photo access.

### 6. Check Swift Logs

Look for Swift `NSLog` output in Electron console:
```
[Swift Bridge] photos_request_permission() called
[Swift Bridge] NSPhotoLibraryUsageDescription: ...
[PermissionManager] requestPermission() called
```

If these don't appear, the Swift code isn't being called.

---

## Questions to Answer

1. **Is the Swift library actually loaded?**
   - Check: Does console show "Photos Library FFI initialized successfully"?
   - If NO: FFI isn't loading the dylib (path issue, build issue)
   - If YES: Proceed to next question

2. **Is the Info.plist key in the built app?**
   - Check: Run plutil command above
   - If NO: electron-builder isn't injecting it (config issue)
   - If YES: Proceed to next question

3. **Are entitlements applied?**
   - Check: Run codesign command above
   - If NO: electron-builder isn't applying entitlements (config issue)
   - If YES: Proceed to next question

4. **When you call requestPermission, does Swift code run?**
   - Check: Look for Swift log messages
   - If NO: FFI isn't calling Swift correctly (function signature issue)
   - If YES: Proceed to next question

5. **Does the permission request reach PhotoKit?**
   - Check: System TCC logs (log stream command)
   - If NO: Swift code is failing before PHPhotoLibrary call
   - If YES: macOS is denying the request for some reason

6. **Is the app sandboxed?**
   - Check: Entitlements show `com.apple.security.app-sandbox` = true
   - Sandboxed apps have different permission requirements
   - Might need additional entitlements

---

## Recommended Next Steps

### Immediate Priority
1. **Add test button to UI** that calls `requestPermission()` on click
2. **Verify Info.plist key** is present in built app
3. **Verify entitlements** are applied to built app
4. **Watch system logs** while clicking test button
5. **Check for Swift logs** in Electron console

### Short-term (If Above Works)
1. Implement user-triggered permission request (Option 1)
2. Add helpful error messages if permission denied
3. Provide link to System Settings for manual permission grant
4. Test on both M1 and M2 Macs

### Long-term (If Above Fails)
1. Consider Worker Thread implementation (Option 2)
2. Or simplify to file browser only (no Photos library access)
3. Document workaround for users

---

## Additional Notes

### Why iOS Works But macOS Doesn't

**iOS**: Capacitor has native iOS plugin that handles PhotoKit directly in Swift. No FFI needed. Permission dialog is built-in to Capacitor.

**macOS**: Electron doesn't have native PhotoKit support. We had to build entire permission system from scratch using FFI bridge, which introduces complexity and the blocking semaphore issue.

### Code Signing Considerations

For distribution, the app must be:
- **Signed** with Apple Developer ID certificate
- **Notarized** by Apple

Without signing:
- Entitlements may not be honored
- macOS may restrict permissions
- Users will see "unidentified developer" warnings

For testing on your own Mac, unsigned builds should work, but macOS is becoming stricter with each version.

### Alternative: Skip Photos Library, Use File Browser

If Photos library access remains too problematic, we can:
1. Remove all Photos library code
2. Use only file browser (`dialog.showOpenDialog()`)
3. Users select photos from filesystem
4. Simpler, but less convenient for users

This works fine but doesn't give access to Photos.app organization (albums, favorites, etc.).

---

## Files Modified During This Work

### Created:
- `electron/src/native/PhotosLibraryBridge.swift`
- `electron/src/native/PhotosPermissionManager.swift`
- `electron/src/native/PhotoAssetConverter.swift`
- `electron/src/native/PhotosLibraryFFI.ts`
- `electron/src/native/types.ts`
- `electron/scripts/build-swift.sh`
- `macos-photo-permission.md` (detailed report)
- `macos-photo-issue-report.md` (this file)

### Modified:
- `electron/src/index.ts` - Added IPC handlers, permission logging
- `electron/src/preload.ts` - Exposed photos API to renderer
- `electron/resources/entitlements.mac.plist` - Added photos entitlement
- `electron/electron-builder.config.json` - Added Info.plist key
- `src/services/PhotoService.ts` - Added Electron photos functions
- `src/vite-env.d.ts` - Added window.electron types

---

## Summary for Pairing Session

**The Goal**: Get macOS permission dialog to appear when app requests Photos access.

**The Blocker**: FFI bridge uses blocking semaphores that freeze the app if called during initialization.

**Current State**: App launches fine, but permission is never requested and dialog never appears.

**Most Likely Issue**: One of these:
1. Info.plist key not in built app
2. Entitlements not applied correctly
3. Swift code not being called at all
4. Permission already decided (user previously denied)

**Best Next Step**: Add test button to UI, click it, watch console and system logs to see where the flow breaks.

**Realistic Outcome**: User-triggered permission request (click button to request access) is most achievable solution given the blocking issue.
