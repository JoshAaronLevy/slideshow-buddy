# macOS Implementation Plan for Slideshow Buddy

## Implementation Configuration

Based on your requirements, here's the configuration for the macOS port:

✅ **Target macOS Version**: macOS Sequoia 15.0 or newer  
✅ **Distribution Method**: Direct download/DMG (with option to pursue Mac App Store later)  
✅ **Photo Library Access**: Native macOS Photos Library (matches iOS experience)  
✅ **Music Playback**: Spotify Web Playback SDK (existing implementation)  
✅ **Window Behavior**: Hybrid approach - modal slideshow player + optional fullscreen window mode  
✅ **Backend Server**: Assumed production-ready; will note if backend changes are needed

**Note**: If backend changes are required during implementation, they will be clearly documented for you to implement in the backend repository.

---

## Overview

This plan outlines the steps to adapt the current iOS-focused Ionic/Capacitor app for macOS. The app currently uses Capacitor 7 with iOS-specific plugins for photos, haptics, camera access, and native app lifecycle management. macOS support requires adding the Electron platform, adapting platform-specific services, and handling desktop-specific UX patterns.

**Architecture**: Ionic React + Capacitor + Electron (for macOS desktop)

**Current Status**: MVP complete for iOS (v0.4.1)

**Estimated Total Effort**: 4-6 weeks

**Key Technical Decisions**:
- Using native Photos Library API (more complex than file picker, but matches iOS)
- Supporting both modal and fullscreen window modes (adds flexibility)
- Targeting macOS Sequoia 15+ only (allows use of modern APIs)

---

## Stage 1: Environment Setup & Electron Integration

**Goal**: Add Electron platform to support macOS builds without breaking iOS functionality.

### Tasks

1. **Install Electron Platform**
   ```bash
   npm install @capacitor-community/electron
   npx cap add @capacitor-community/electron
   ```

2. **Configure Electron for macOS**
   - Update `capacitor.config.ts` to include Electron configuration
   - Set app ID, name, and web directory
   - Configure build settings for macOS target (`.dmg`, `.app`)

3. **Test Basic Build**
   - Run `npx cap sync electron`
   - Build and launch Electron app: `npx cap open electron`
   - Verify web content loads correctly

4. **Update Package Scripts**
   - Add `electron:dev`, `electron:sync`, `electron:open`, `electron:build:mac` scripts to `package.json`
   - Create consistent developer workflow (similar to `ios:dev`)

5. **Platform Detection Utility**
   - Create helper function in `src/utils/platform.ts`:
     ```typescript
     export const getPlatform = () => Capacitor.getPlatform();
     export const isIOS = () => getPlatform() === 'ios';
     export const isAndroid = () => getPlatform() === 'android';
     export const isMacOS = () => getPlatform() === 'electron';
     export const isWeb = () => getPlatform() === 'web';
     export const isMobile = () => isIOS() || isAndroid();
     export const isDesktop = () => isMacOS();
     ```

### Success Criteria
- ✅ Electron app launches on macOS
- ✅ Web content renders correctly
- ✅ No console errors related to Capacitor platform detection
- ✅ iOS build still works without regression

### Estimated Time: 2-3 days

---

## Stage 2: Photo Service Adaptation

**Goal**: Implement macOS photo access using native file picker or Photos Library API.

### Current Implementation Analysis
- `PhotoService.ts` uses `@capacitor/camera` and `@capacitor-community/media`
- iOS implementation fetches photos with base64 thumbnails
- Photos converted to blob URLs for memory efficiency
- Supports album browsing and infinite scroll pagination

### macOS Approach: Native Photos Library (Selected)

**Implementation Strategy**:
- Use macOS native Photos library via `PHPhotoLibrary` framework
- Requires `com.apple.security.photos-library` entitlement
- Matches iOS experience (album browsing, permissions flow)
- Bridge to native macOS code via Electron IPC or Capacitor plugin

**Technical Requirements**:
- Create native Swift/Objective-C bridge for Photos framework access
- Request photo library permissions (similar to iOS flow)
- Support album enumeration and photo fetching
- Convert native image data to blob URLs for web layer

**Alternative/Fallback**: If Photos Library integration proves too complex, file picker can be implemented as a fallback with user consent.

### Tasks

1. **Create Native Photos Library Bridge**
   - Create Swift/Objective-C module to interface with `PHPhotoLibrary`
   - Implement IPC handlers in Electron main process
   - Request photo library permissions via native dialog
   - Support fetching photos with thumbnails (similar to iOS `@capacitor-community/media`)

2. **Update PhotoService Platform Logic**
   ```typescript
   export const importPhotos = async (quantity: number = 50): Promise<Photo[]> => {
     const platform = Capacitor.getPlatform();
     
     if (platform === 'ios' || platform === 'android') {
       // Existing mobile implementation
     } else if (platform === 'electron') {
       return await importPhotosElectron(quantity);
     } else {
       throw new Error('Photo import not supported on this platform');
     }
   };
   ```

3. **Electron IPC Handlers for Photos API**
   - Create IPC channel: `photos:getAlbums`, `photos:getPhotos`, `photos:requestPermission`
   - Bridge calls from renderer process to native Photos framework
   - Handle async responses with proper error handling
   - Return standardized `Photo[]` and `PhotoAlbum[]` objects

4. **Album Support**
   - Fetch all photo albums via `PHAssetCollection.fetchAssetCollections`
   - Support "All Photos", "Favorites", user-created albums, and smart albums
   - Implement pagination for large albums (similar to iOS infinite scroll)
   - Cache album metadata for performance

5. **Photo Permissions Handling**
   - Remove iOS-specific permission checks on Electron
   - Add file system permission handling if needed
   - Update UI to show appropriate permission messages

### Success Criteria
- ✅ Users can import photos via file picker
- ✅ Photos display correctly in grid view
- ✅ Blob URLs created for memory efficiency
- ✅ No iOS regression

### Estimated Time: 6-8 days

**Increased from initial estimate due to**:
- Native Swift/Objective-C bridge development
- Photos framework permission handling
- Album enumeration and photo fetching logic

---

## Stage 3: Haptic Service Adaptation

**Goal**: Provide appropriate feedback for macOS (no haptics, use visual/audio cues).

### Current Implementation
- `HapticService.ts` uses `@capacitor/haptics` with iOS-specific feedback
- Used extensively throughout the app (buttons, selections, controls)

### macOS Approach
- Haptics don't exist on macOS
- Replace with subtle visual feedback or system sounds
- Gracefully degrade (already does via try/catch)

### Tasks

1. **Create macOS Feedback Service**
   - Add `MacOSFeedbackService.ts` with equivalent functions
   - Use system sounds: `NSSound` via Electron
   - Options: system beep, custom sounds, or silent (just visual feedback)

2. **Platform-Aware Wrapper**
   ```typescript
   export const impactLight = async (): Promise<void> => {
     const platform = Capacitor.getPlatform();
     if (platform === 'electron') {
       // macOS: play subtle system sound or do nothing
       return;
     }
     // iOS/Android: trigger haptics
     try {
       await Haptics.impact({ style: ImpactStyle.Light });
     } catch (error) {
       console.debug('Haptic feedback not available:', error);
     }
   };
   ```

3. **Optional: Visual Feedback**
   - Add CSS animations for button presses on macOS
   - Slight scale/opacity changes on interaction
   - Enhance perceived responsiveness

### Success Criteria
- ✅ No errors on macOS when haptic functions are called
- ✅ Optional: Subtle system sounds play on macOS
- ✅ iOS haptics continue to work

### Estimated Time: 1-2 days

---

## Stage 4: Music Player Service Adaptation

**Goal**: Ensure Spotify Web Playback SDK works on macOS Electron.

### Current Implementation
- `MusicPlayerService.ts` uses Spotify Web Playback SDK (JavaScript library)
- Loads SDK script dynamically via `<script>` tag
- Works in browser contexts (should work in Electron)

### macOS Considerations
- Electron uses Chromium engine (SDK should work)
- May need Content Security Policy (CSP) adjustments
- Need to handle Electron-specific browser session

### Tasks

1. **Test SDK Loading in Electron**
   - Verify `loadSpotifySDK()` works in Electron environment
   - Check for CSP violations in Electron console
   - Confirm SDK script loads from `https://sdk.scdn.co/spotify-player.js`

2. **CSP Configuration (if needed)**
   - Update Electron's `webPreferences.contentSecurityPolicy` in `electron.config.json`
   - Allow scripts from `sdk.scdn.co` and `api.spotify.com`
   - Example:
     ```json
     "webPreferences": {
       "contentSecurityPolicy": "default-src 'self'; script-src 'self' https://sdk.scdn.co; connect-src 'self' https://api.spotify.com https://accounts.spotify.com;"
     }
     ```

3. **Audio Playback Verification**
   - Test Spotify Premium account playback on macOS
   - Verify device shows up in Spotify Connect devices list
   - Check volume controls and playback state updates

4. **Background Playback (Optional Enhancement)**
   - Configure Electron to allow background audio when window is minimized
   - Add macOS media keys integration (play/pause/skip via keyboard)
   - Show now playing info in macOS menu bar or dock

### Success Criteria
- ✅ Spotify SDK loads in Electron
- ✅ Music plays correctly during slideshows
- ✅ Device appears in Spotify Connect
- ✅ Playback controls work (play/pause/next/previous)

### Estimated Time: 2-3 days

---

## Stage 5: Spotify Authentication Adaptation

**Goal**: Handle OAuth deep links on macOS via custom protocol handler.

### Current Implementation
- Uses `com.slideshowbuddy://callback` custom URL scheme
- iOS handles via `Info.plist` CFBundleURLSchemes
- Capacitor Browser plugin opens OAuth in system browser
- App URL listener captures callback

### macOS Approach
- Register custom protocol handler in Electron
- Handle deep links via Electron protocol API
- Spotify redirects to `com.slideshowbuddy://callback`

### Tasks

1. **Register Custom Protocol in Electron**
   - Update `electron.config.json` or main process setup
   - Register `com.slideshowbuddy` protocol handler
   - Example (in Electron main process):
     ```typescript
     app.setAsDefaultProtocolClient('com.slideshowbuddy');
     
     app.on('open-url', (event, url) => {
       event.preventDefault();
       // Parse OAuth callback URL
       // Send to renderer process via IPC
     });
     ```

2. **IPC Communication for OAuth**
   - Main process receives `com.slideshowbuddy://callback?code=...&state=...`
   - Forward to renderer process via `ipcRenderer`
   - Renderer calls `useSpotifyAuth` callback handling

3. **Browser Plugin Verification**
   - Confirm `@capacitor/browser` works in Electron
   - Opens external browser for OAuth (not in-app webview)
   - User approves in Safari/Chrome, then redirects back to app

4. **Test OAuth Flow End-to-End**
   - Login → Browser opens → User approves → App receives callback
   - Token exchange with backend server
   - Tokens stored in Electron's secure storage (keytar or keychain)

5. **Secure Token Storage**
   - Use `electron-store` with encryption or macOS Keychain
   - Replace `@capacitor/preferences` calls with Electron-compatible storage
   - Ensure tokens persist across app restarts

### Success Criteria
- ✅ OAuth flow works on macOS
- ✅ Custom protocol handler captures callback
- ✅ Tokens stored securely in macOS keychain
- ✅ User can authenticate with Spotify

### Estimated Time: 3-4 days

---

## Stage 6: Slideshow Player Adaptation

**Goal**: Adapt fullscreen slideshow player for macOS desktop UX.

### Current Implementation
- `SlideshowPlayer.tsx` uses `IonModal` for fullscreen display
- Mobile-focused controls (tap to show/hide, swipe gestures)
- Keeps screen awake via `@capacitor-community/keep-awake`

### macOS Considerations
- Fullscreen on desktop vs mobile: different UX expectations
- Keyboard controls (spacebar, arrows) are essential
- Mouse hover controls more natural than tap-to-show
- Keep-awake equivalent: prevent sleep during slideshow

### Tasks

1. **Hybrid Window Mode Implementation**
   - **Default (Modal)**: Keep existing `IonModal` fullscreen approach (consistent with iOS)
   - **Optional (Native Fullscreen)**: Add Electron fullscreen window mode via IPC
   - User preference toggle: "Use native fullscreen mode" in settings
   - Keyboard shortcuts work in both modes: Space (play/pause), Arrow keys (prev/next), Esc (exit)

2. **Control UI Adaptation**
   - Show controls on mouse hover (not tap)
   - Add mouse hover timeout (hide after 3 seconds of no movement)
   - Larger click targets for desktop (buttons can be bigger)
   - Consider always-visible minimal controls at bottom of screen

3. **Keep-Awake Implementation**
   - Electron: Use `powerSaveBlocker` API
   - Prevent display sleep and system sleep during slideshow
   - Release blocker when slideshow stops

4. **Window Management**
   - Detect screen resolution and optimize layout
   - Support multiple monitors (choose which screen for fullscreen)
   - Handle window resize gracefully

5. **Gesture Replacement**
   - Remove mobile swipe gestures (not applicable on desktop)
   - Add click on left/right edges to navigate
   - Consider trackpad two-finger swipe support

### Success Criteria
- ✅ Slideshow enters fullscreen mode correctly
- ✅ Keyboard controls work (space, arrows, esc)
- ✅ Controls appear on mouse hover
- ✅ Screen stays awake during playback
- ✅ Smooth transitions on macOS

### Estimated Time: 5-6 days

**Increased due to supporting both modal and native fullscreen modes**

---

## Stage 7: App Lifecycle & Background Handling

**Goal**: Adapt iOS app lifecycle events to macOS Electron lifecycle.

### Current Implementation
- Uses `@capacitor/app` for iOS lifecycle events (`appStateChange`)
- Pauses timers when app backgrounds
- Used in `SlideshowPlayer.tsx` and `TokenManager.ts`

### macOS Electron Lifecycle
- Different events: `window.blur`, `window.focus`, `window.minimize`, `window.restore`
- No concept of "backgrounding" like mobile (apps stay running)
- Users may minimize window but expect playback to continue (or stop)

### Tasks

1. **Abstract Lifecycle Events**
   - Create `LifecycleService.ts` with platform-agnostic events
   - Map iOS `appStateChange` to Electron window events
   - Emit consistent events: `active`, `inactive`, `background`, `foreground`

2. **Electron Window Listeners**
   ```typescript
   // In Electron renderer
   window.addEventListener('focus', () => {
     LifecycleService.emit('active');
   });
   
   window.addEventListener('blur', () => {
     LifecycleService.emit('inactive');
   });
   ```

3. **Update SlideshowPlayer**
   - Use `LifecycleService` instead of direct `@capacitor/app` calls
   - Decide behavior: pause when window loses focus? Continue playing?
   - Add preference: "Pause when window is minimized" (off by default)

4. **Update TokenManager**
   - Replace iOS app resume listener with Electron window focus
   - Continue auto-refresh logic on macOS
   - Ensure tokens refresh when app regains focus

### Success Criteria
- ✅ App responds to window focus/blur events
- ✅ TokenManager refreshes tokens appropriately
- ✅ Slideshow behavior configurable (pause/continue when minimized)

### Estimated Time: 2-3 days

---

## Stage 8: UI/UX Refinements for macOS

**Goal**: Polish the UI for desktop screen sizes and macOS design patterns.

### Current State
- Ionic components optimized for mobile (320-428px width)
- Tab bar at bottom (mobile pattern)
- Touch-first interactions

### macOS Enhancements

1. **Responsive Layout**
   - Adjust grid columns for wider screens (3 → 4-6 columns)
   - Increase thumbnail sizes on desktop
   - Use more horizontal space efficiently

2. **Navigation Pattern**
   - Consider sidebar navigation instead of bottom tab bar
   - macOS apps typically use sidebar for primary navigation
   - Optional: Keep tab bar but move to top or side

3. **Window Chrome**
   - Add native macOS title bar with traffic lights (close/minimize/maximize)
   - Show app name and current view in title bar
   - Integrate with macOS system theme (light/dark mode)

4. **Menu Bar Integration**
   - Add macOS menu bar (File, Edit, View, Window, Help)
   - Keyboard shortcuts for common actions (Cmd+N for new slideshow)
   - "About Slideshow Buddy" dialog

5. **Preferences Window**
   - Create macOS-style preferences window (Cmd+,)
   - Settings: Default transition time, slideshow behavior, Spotify settings
   - Use native macOS control styles

6. **Context Menus**
   - Right-click context menus for slideshows and photos
   - Actions: Rename, Delete, Duplicate, Show in Finder

7. **Drag & Drop**
   - Drag photos from Finder into photo picker
   - Drag slideshow file to share/export

### Success Criteria
- ✅ App looks native on macOS (not just scaled-up mobile UI)
- ✅ Uses macOS design patterns (sidebar, menu bar, preferences)
- ✅ Responsive to different window sizes
- ✅ Supports macOS dark mode

### Estimated Time: 5-7 days

---

## Stage 9: Storage & Preferences Adaptation

**Goal**: Use Electron-specific storage mechanisms compatible with macOS.

### Current Implementation
- Uses `@capacitor/preferences` for key-value storage
- Stores: tokens, slideshows, playlists, photos, settings
- iOS: backed by `UserDefaults`

### macOS Approach
- Electron: Use `electron-store` for preferences
- Store data in `~/Library/Application Support/Slideshow Buddy/`
- Ensure data persists across app updates

### Tasks

1. **Install Electron Store**
   ```bash
   npm install electron-store
   ```

2. **Create Storage Adapter**
   - Wrap `electron-store` to match `@capacitor/preferences` API
   - Create `ElectronStorageService.ts` with `get()`, `set()`, `remove()`
   - Use in `StorageService.ts` when platform is Electron

3. **Data Migration (if needed)**
   - If beta users already have data, migrate from old location
   - Provide import/export functionality for user data

4. **Secure Token Storage**
   - Use `keytar` library for macOS Keychain integration
   - Store Spotify tokens in system keychain (more secure than app data)
   - Update `TokenManager.ts` to use keychain on macOS

### Success Criteria
- ✅ Data persists across app restarts on macOS
- ✅ Tokens stored securely in macOS Keychain
- ✅ No data loss when updating app

### Estimated Time: 2-3 days

---

## Stage 10: Build, Code Signing & Distribution

**Goal**: Create distributable macOS app with proper signing and notarization.

### Requirements for Distribution
- Apple Developer account ($99/year)
- Developer ID certificate for code signing
- Notarization with Apple (required for macOS 10.15+)

### Tasks

1. **Configure Code Signing**
   - Create or import Developer ID Application certificate
   - Configure `electron-builder` or `electron-forge` for signing
   - Set entitlements (Hardened Runtime, Network, etc.)

2. **Entitlements Configuration**
   - Create `entitlements.mac.plist` for macOS sandbox and permissions
   - Add required entitlements:
     - `com.apple.security.network.client` (for Spotify API)
     - `com.apple.security.files.user-selected.read-only` (for photo picker)
     - `com.apple.security.photos-library` (if using Photos Library API)

3. **Build Configuration**
   - Update `electron-builder.json` or equivalent config
   - Set macOS target: `dmg`, `pkg`, or both
   - Configure app icon (`.icns` format)
   - Set app category (Photography, Entertainment, or Music)

4. **Notarization**
   - Submit build to Apple for notarization
   - Use `xcrun altool` or `notarytool`
   - Staple notarization ticket to app bundle
   - Test on clean macOS install (Gatekeeper verification)

5. **Auto-Update (Optional)**
   - Integrate `electron-updater` for automatic updates
   - Set up update server or use GitHub releases
   - Add update check on app launch

6. **DMG Creation**
   - Create attractive DMG installer with background image
   - Include "Drag to Applications" arrow
   - Test installation flow

### Success Criteria
- ✅ App signed with Developer ID certificate
- ✅ App notarized by Apple (no Gatekeeper warnings)
- ✅ DMG installs correctly on clean macOS system
- ✅ App launches without security warnings

### Estimated Time: 3-5 days (longer if notarization issues arise)

---

## Stage 11: Testing & QA

**Goal**: Comprehensive testing on macOS to ensure quality release.

### Test Scenarios

1. **Installation & First Launch**
   - Install from DMG on clean macOS
   - Verify no Gatekeeper warnings
   - Grant photo access (if applicable)
   - Complete Spotify OAuth flow

2. **Core Functionality**
   - Import photos from disk
   - Create slideshow with photos and music
   - Play slideshow in fullscreen
   - Test keyboard controls (space, arrows, esc)
   - Verify music plays correctly (Spotify Premium account)

3. **UI/UX**
   - Test on different screen sizes (13", 16", external 4K)
   - Verify dark mode support
   - Check menu bar functionality
   - Test context menus

4. **Performance**
   - Load 100+ photos
   - Play long slideshow (30+ minutes)
   - Monitor memory usage
   - Check for memory leaks (blob URL cleanup)

5. **Edge Cases**
   - No internet connection (graceful degradation)
   - Spotify token expiry and refresh
   - App minimized during slideshow
   - System sleep/wake during playback
   - Multiple Spotify devices active

6. **Cross-Platform**
   - Ensure iOS build still works
   - No regressions introduced by macOS changes

### Success Criteria
- ✅ All core features work on macOS
- ✅ No crashes or critical bugs
- ✅ Performance acceptable (smooth transitions)
- ✅ No regressions on iOS

### Estimated Time: 4-6 days

---

## Stage 12: Documentation & Deployment

**Goal**: Update documentation and prepare for release.

### Tasks

1. **Update README**
   - Add macOS installation instructions
   - Update requirements (macOS Sequoia 15.0+, Spotify Premium)
   - Add macOS-specific development commands
   - Document keyboard shortcuts

2. **Create macOS Build Guide**
   - Document build process for developers
   - Code signing requirements
   - Notarization steps
   - CI/CD setup (if using GitHub Actions)

3. **User Documentation**
   - Create user guide for macOS app
   - Screenshots of key features
   - FAQ section (common issues, troubleshooting)
   - Spotify setup instructions

4. **Release Notes**
   - Prepare changelog for macOS release
   - Highlight macOS-specific features
   - Known limitations (if any)

5. **Distribution**
   - Upload DMG to website or GitHub Releases
   - Create download page with system requirements
   - Consider Mac App Store submission (separate process)

### Success Criteria
- ✅ README includes macOS instructions
- ✅ Release notes ready
- ✅ DMG available for download
- ✅ User documentation published

### Estimated Time: 2-3 days

---

## Summary of Stages

| Stage | Description | Estimated Time | Dependencies |
|-------|-------------|---------------|--------------||
| 1 | Environment Setup & Electron | 2-3 days | None |
| 2 | Photo Service Adaptation (Photos Library) | 6-8 days | Stage 1 |
| 3 | Haptic Service Adaptation | 1-2 days | Stage 1 |
| 4 | Music Player Service | 2-3 days | Stage 1 |
| 5 | Spotify Authentication | 3-4 days | Stage 1, 4 |
| 6 | Slideshow Player (Hybrid Mode) | 5-6 days | Stage 1, 2 |
| 7 | App Lifecycle & Background | 2-3 days | Stage 1 |
| 8 | UI/UX Refinements | 5-7 days | Stage 1 |
| 9 | Storage & Preferences | 2-3 days | Stage 1 |
| 10 | Build & Distribution | 3-5 days | All previous |
| 11 | Testing & QA | 4-6 days | All previous |
| 12 | Documentation & Deployment | 2-3 days | Stage 11 |

**Total Estimated Time**: 37-53 days (7.5-10.5 weeks)

**Realistic Timeline**: 4-6 weeks with focused work and some parallel execution of independent stages.

**Key Complexity Drivers**:
- Native Photos Library integration (+2-3 days vs file picker)
- Hybrid window mode support (+1-2 days)
- macOS Sequoia 15+ targeting (modern APIs simplify some areas)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Spotify SDK incompatible with Electron | Low | High | Test early in Stage 4; fallback to alternative music players |
| Photos Library API complexity | Medium-High | Medium | Native bridge required; thorough testing on Sequoia 15+; fallback to file picker if needed |
| Code signing/notarization issues | Medium | High | Test early in Stage 10; engage Apple Developer Support |
| Performance on older Macs | Low | Medium | Optimize image loading; test on older hardware |
| OAuth deep linking fails | Low | High | Test thoroughly in Stage 5; alternative: copy-paste OAuth code |

---

## Next Steps

The implementation plan has been updated based on your requirements. Key decisions:
- ✅ Native Photos Library (more complex, matches iOS)
- ✅ Hybrid window modes (modal + optional native fullscreen)
- ✅ macOS Sequoia 15+ target (modern APIs)
- ✅ Direct DMG distribution initially

**To begin implementation, reply with:**

**"Proceed with Stage 1"**

I'll start with environment setup and Electron integration. Each stage will be completed sequentially with your approval before moving to the next.

**Backend Changes**: If any backend modifications are needed during implementation (e.g., CORS, endpoints, rate limiting), I'll document them clearly for you to implement in your backend repository.

**Want to discuss?** If you'd like to review any specific stage, adjust the approach, or have questions about technical decisions, let me know!
