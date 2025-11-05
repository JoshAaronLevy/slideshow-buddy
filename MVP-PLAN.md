# Slideshow Buddy - MVP Development Plan

## Executive Summary

Slideshow Buddy is an iOS application that fills a unique market gap by allowing users to create photo slideshows with Spotify integration. Unlike existing apps that only support Apple Music or single-song playback, Slideshow Buddy enables users to pair their photo memories with full Spotify playlists, creating a rich multimedia experience.

## Current State Analysis

### Existing Infrastructure
- **Framework**: Ionic React with Capacitor 7.4.4
- **React Version**: 19.0.0
- **Build Tools**: Vite 5.2.0 + TypeScript 5.1.6
- **Testing**: Vitest (unit) + Cypress (e2e)
- **Current UI**: Basic 3-tab layout with placeholder content
- **iOS Support**: Configured with Capacitor iOS 7.4.4
- **Bundle ID**: `io.ionic.starter` (needs updating)
- **Current Dependencies**: Core Ionic/Capacitor plugins (App, Haptics, Keyboard, StatusBar)

### Notable Observations
- **PrimeReact**: Mentioned in requirements but not yet installed
- **Clean Slate**: All three tabs contain only placeholder content
- **No Native Plugins**: Photo library and media player functionality not yet implemented
- **No State Management**: Will need to add for managing photos, playlists, and slideshow state

---

## MVP Core Requirements

### Must-Have Features
1. ✅ Photo library access and import
2. ✅ Photo selection interface with multi-select
3. ✅ Slideshow player with shuffle mode
4. ✅ Spotify authentication and integration
5. ✅ Playlist/track selection from Spotify
6. ✅ Background music playback during slideshows
7. ✅ Basic slideshow controls (play, pause, speed adjustment)

### Implementation Notes
- **No Test Code**: Test code will NOT be written during implementation phases. User will handle all testing.
- **Command Execution**: Only dependency installation commands will be run (npm install, capacitor plugin additions). Build, sync, test, or other scripts will NOT be executed on this laptop.
- **Workflow**: Code implementation → push to upstream → pull on testing laptop → build/sync/test there.

### MVP Constraints
- **Platform**: iOS only (existing configuration)
- **Music Service**: Spotify only (exclude Apple Music, etc.)
- **Photo Source**: Device photo library only (no cloud services yet)
- **Orientation**: Support both portrait and landscape

---

## Proposed UI/UX Design

### Tab Structure (Reimagined)
Instead of generic Tab 1/2/3, propose a user-centric navigation:

**Tab 1: 📸 My Photos** (Library/Collection Management)
- Grid view of imported photos
- Multi-select capability with checkboxes
- Search/filter by date or album
- "Import from Library" FAB (Floating Action Button)
- Selection counter badge
- "Create Slideshow" button when photos selected

**Tab 2: 🎵 Music** (Spotify Integration)
- Spotify login/connection status card
- User's playlists in scrollable list
- Recently played tracks
- Search functionality for playlists/tracks
- Preview/sample playback (optional for MVP)
- Selected music indicator

**Tab 3: ▶️ Slideshows** (Playback & History)
- Saved slideshow configurations (future enhancement)
- Quick play option: "Play Now" with selected photos + music
- Playback settings (transition time, shuffle toggle)
- Full-screen slideshow player (modal/separate view)
- Playback controls overlay

### Visual Design Principles
- **Modern & Minimal**: Clean cards, ample whitespace, subtle shadows
- **Color Scheme**: 
  - Primary: Spotify Green (#1DB954) for music elements
  - Secondary: Deep Purple/Blue for photo elements
  - Neutral: Dark mode support (already configured)
- **Typography**: Use Ionic's default font with clear hierarchy
- **Interactions**: 
  - Smooth transitions between photos (fade/slide)
  - Haptic feedback on selections
  - Pull-to-refresh on photo library
  - Swipe gestures in slideshow player

---

## Technical Architecture

### State Management
**Recommendation**: Use **Zustand** (lightweight, TypeScript-friendly)
- Stores: `photoStore`, `musicStore`, `slideshowStore`, `authStore`
- Benefits: No boilerplate, simple API, React 19 compatible

### Spotify Integration Approach
**Spotify Web API + Web Playback SDK**
- OAuth 2.0 authentication via Authorization Code Flow with PKCE
- Requires Spotify Premium for playback control
- Store tokens securely using Capacitor Preferences plugin
- Handle token refresh logic

### Photo Library Access
**Capacitor Camera Plugin** (already common pattern in Ionic)
- `@capacitor/camera` with `source: 'photos'`
- Request `NSPhotoLibraryUsageDescription` permission
- Support batch selection via native picker

### Native Capabilities Required
1. **Photo Library**: `@capacitor/camera` + `@capacitor-community/media`
2. **Secure Storage**: `@capacitor/preferences` for Spotify tokens
3. **Background Audio**: `@capacitor-community/native-audio` or Web Audio API
4. **Keep Screen Awake**: `@capacitor-community/keep-awake` during playback

### Data Models
```typescript
interface Photo {
  id: string;
  uri: string;
  filename: string;
  timestamp: number;
  selected: boolean;
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: string[];
  album: string;
  uri: string;
  duration_ms: number;
}

interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  image_url: string;
  track_count: number;
  uri: string;
}

interface SlideshowConfig {
  photos: Photo[];
  shuffle: boolean;
  transitionTime: number; // in seconds
  musicSource: SpotifyPlaylist | SpotifyTrack;
}
```

---

## Development Phases

### **PHASE 0: Foundation Setup** 
*Estimated Time: 2-3 hours*

#### Tasks
- [ ] **Update project metadata**
  - Change bundle ID from `io.ionic.starter` to `com.slideshowbuddy.app`
  - Update app name in Info.plist
  - Set proper app icons (placeholder for MVP)

- [ ] **Install core dependencies**
  - Will run: `npm install` for packages
  - Will run: `npx cap plugin add` for Capacitor plugins
  - Will NOT run: build, sync, test, or run scripts

- [ ] **Setup PrimeReact theming**
  - Import PrimeReact CSS in main.tsx
  - Configure theme to match Ionic/dark mode

- [ ] **Create folder structure**
  ```
  src/
    stores/          # Zustand stores
    services/        # API services (Spotify, Photo)
    types/           # TypeScript interfaces
    hooks/           # Custom React hooks
    utils/           # Helper functions
    constants/       # App constants
  ```

- [ ] **Configure iOS permissions**
  - Add `NSPhotoLibraryUsageDescription` to Info.plist
  - Add `NSPhotoLibraryAddUsageDescription` (if allowing saves)

#### Deliverables
- Updated project configuration
- Installed dependencies
- Project structure scaffolding
- iOS permissions configured

---

### **PHASE 1: Photo Library Integration**
*Estimated Time: 4-5 hours*

#### Tasks
- [ ] **Create Photo Service** (`src/services/PhotoService.ts`)
  - Implement photo library permission request
  - Implement photo import (single & batch)
  - Handle permission denied states
  - Convert native photo URIs to web-compatible format

- [ ] **Create Photo Store** (`src/stores/photoStore.ts`)
  - State: `photos`, `selectedPhotos`, `isLoading`, `error`
  - Actions: `importPhotos`, `togglePhotoSelection`, `clearSelection`, `selectAll`

- [ ] **Build Photo Library UI** (Tab 1)
  - Grid layout using PrimeReact DataView or custom grid
  - Multi-select with checkboxes (long-press to enter selection mode)
  - Import FAB with icon
  - Empty state when no photos
  - Selection counter header
  - "Deselect All" option when items selected

- [ ] **Add Photo Detail View** (optional for MVP)
  - Full-screen photo preview on tap
  - Swipe between photos

**Note**: No test code will be written for this phase.

#### Acceptance Criteria
- ✅ User can grant photo library permission
- ✅ User can import multiple photos from library
- ✅ Photos display in responsive grid
- ✅ User can select/deselect individual photos
- ✅ Selection count displays accurately
- ✅ Selected photos persist in store

---

### **PHASE 2: Spotify Authentication**
*Estimated Time: 4-5 hours*

#### Tasks
- [ ] **Register Spotify App**
  - Create app in Spotify Developer Dashboard
  - Configure redirect URI: `slideshowbuddy://callback`
  - Obtain Client ID
  - Store credentials securely (environment variables)

- [ ] **Create Spotify Auth Service** (`src/services/SpotifyAuthService.ts`)
  - Implement PKCE flow (code verifier/challenge)
  - Open Spotify login in Capacitor Browser
  - Handle OAuth callback
  - Store access/refresh tokens using Preferences API
  - Implement token refresh logic
  - Check token validity on app launch

- [ ] **Create Auth Store** (`src/stores/authStore.ts`)
  - State: `isAuthenticated`, `user`, `accessToken`, `tokenExpiry`
  - Actions: `login`, `logout`, `refreshToken`, `checkAuthStatus`

- [ ] **Build Spotify Connection UI** (Tab 2)
  - Connection status card (logged out state)
  - "Connect to Spotify" button with Spotify branding
  - Loading state during auth
  - User profile display when connected (name, profile pic)
  - "Disconnect" option
  - Premium account check/warning

**Note**: No test code will be written for this phase.

#### Acceptance Criteria
- ✅ User can authenticate with Spotify
- ✅ Tokens stored securely
- ✅ Tokens refresh automatically when expired
- ✅ Auth persists across app restarts
- ✅ User sees clear connection status
- ✅ Warning shown if non-Premium account

---

### **PHASE 3: Spotify Music Selection**
*Estimated Time: 5-6 hours*

#### Tasks
- [ ] **Create Spotify API Service** (`src/services/SpotifyService.ts`)
  - Fetch user's playlists (with pagination)
  - Fetch playlist tracks
  - Search playlists/tracks
  - Get user's recently played tracks
  - Error handling for API failures

- [ ] **Create Music Store** (`src/stores/musicStore.ts`)
  - State: `playlists`, `selectedMusic`, `recentTracks`, `isLoading`
  - Actions: `fetchPlaylists`, `selectPlaylist`, `selectTrack`, `searchMusic`

- [ ] **Build Music Selection UI** (Tab 2, below auth card)
  - Playlist list with PrimeReact DataScroller or List
  - Playlist cards with cover art, name, track count
  - Search bar with debouncing
  - Recently played section (collapsible)
  - Selected music indicator (checkmark badge)
  - Empty state when no playlists
  - Pull-to-refresh

- [ ] **Add Music Detail View**
  - Show playlist tracks
  - Allow selecting specific track from playlist (optional for MVP)
  - Back navigation

**Note**: No test code will be written for this phase.

#### Acceptance Criteria
- ✅ User's playlists load and display
- ✅ User can select a playlist for slideshow
- ✅ Search filters playlists in real-time
- ✅ Selected music persists in store
- ✅ Loading states shown appropriately
- ✅ Error messages display when API fails

---

### **PHASE 4: Slideshow Engine**
*Estimated Time: 6-8 hours*

#### Tasks
- [ ] **Create Slideshow Store** (`src/stores/slideshowStore.ts`)
  - State: `config`, `isPlaying`, `currentPhotoIndex`, `shuffledOrder`
  - Actions: `configureSlideshow`, `play`, `pause`, `next`, `previous`, `shuffle`

- [ ] **Create Slideshow Service** (`src/services/SlideshowService.ts`)
  - Generate shuffled photo order
  - Calculate transition timing
  - Handle photo preloading (next/previous)
  - Keep screen awake during playback

- [ ] **Build Slideshow Player Component** (`src/components/SlideshowPlayer.tsx`)
  - Full-screen immersive view
  - Photo display with smooth transitions (CSS transitions)
  - Auto-advance based on transition time
  - Swipe gestures (next/previous)
  - Tap to show/hide controls overlay
  - Controls overlay (semi-transparent bottom bar):
    - Play/Pause button
    - Progress indicator (current/total)
    - Exit/close button
    - Speed adjustment (optional: 2s, 3s, 5s, 10s)
  - Landscape orientation lock (optional)

- [ ] **Build Slideshow Configuration UI** (Tab 3)
  - "Quick Play" section
    - Display selected photo count
    - Display selected music
    - "Start Slideshow" button (disabled if incomplete)
  - Settings card:
    - Shuffle toggle (ON by default per requirements)
    - Transition speed slider (2-10 seconds)
    - Loop toggle (optional)
  - Validation: Require both photos and music

**Note**: No test code will be written for this phase.

#### Acceptance Criteria
- ✅ Slideshow player displays full-screen
- ✅ Photos transition smoothly
- ✅ Shuffle mode works correctly
- ✅ User can control playback (play/pause/exit)
- ✅ Screen stays awake during slideshow
- ✅ Transitions respect configured timing
- ✅ Swipe gestures work for navigation

---

### **PHASE 5: Background Music Playback**
*Estimated Time: 6-8 hours*

#### Tasks
- [ ] **Integrate Spotify Web Playback SDK**
  - Load Spotify SDK script
  - Initialize player with access token
  - Handle player state changes
  - Implement playback controls (play, pause, volume)
  - Handle player errors (device not available, etc.)

- [ ] **Create Music Player Service** (`src/services/MusicPlayerService.ts`)
  - Start playback with playlist/track URI
  - Control playback (play, pause, volume)
  - Handle track changes
  - Sync with slideshow lifecycle
  - Handle background audio (iOS audio session)

- [ ] **Integrate Music with Slideshow**
  - Start music when slideshow starts
  - Pause music when slideshow pauses
  - Stop music when slideshow exits
  - Handle interruptions (calls, notifications)
  - Volume control (optional)

- [ ] **Add Playback Status Indicators**
  - Now playing info in controls overlay (track name, artist)
  - Music icon/indicator when playing
  - Handle "no active device" error gracefully

**Note**: No test code will be written for this phase.

#### Acceptance Criteria
- ✅ Spotify music plays during slideshow
- ✅ Playlist continues through multiple tracks
- ✅ Music stops when slideshow exits
- ✅ Music pauses when slideshow pauses
- ✅ Current track displays in UI
- ✅ Handles phone interruptions gracefully
- ✅ Requires Spotify Premium (shows warning if not)

---

### **PHASE 6: Polish & UX Refinements**
*Estimated Time: 4-5 hours*

#### Tasks
- [ ] **Add Loading States**
  - Skeleton loaders for photos/playlists
  - Spinners for async operations
  - Progress indicators

- [ ] **Error Handling & User Feedback**
  - Toast notifications (PrimeReact Toast)
  - Permission denied flows
  - Network error handling
  - Spotify API error messages
  - Haptic feedback on interactions

- [ ] **Empty States**
  - No photos imported yet
  - No playlists found
  - Not connected to Spotify
  - Helpful illustrations/icons

- [ ] **Accessibility**
  - ARIA labels for icons
  - Sufficient color contrast
  - Keyboard navigation (iPad support)
  - VoiceOver hints

- [ ] **Navigation Improvements**
  - Update tab icons to meaningful ones (photos, music, play icons)
  - Update tab labels ("Photos", "Music", "Play")
  - Active tab indicators

- [ ] **Onboarding Flow** (optional nice-to-have)
  - Welcome screen on first launch
  - Permission explanations
  - Quick tutorial slides

#### Deliverables
- Polished UI with consistent styling
- Comprehensive error handling
- Smooth user experience
- Accessible interface

---

### **PHASE 7: Code Review & Documentation**
*Estimated Time: 2-3 hours*

#### Tasks
- [ ] **Code Review**
  - Review all implemented components for consistency
  - Verify TypeScript types are properly defined
  - Check error handling is comprehensive
  - Ensure loading states are present
  - Validate proper cleanup in useEffect hooks

- [ ] **Inline Code Documentation**
  - Add JSDoc comments to services and utilities
  - Document complex logic/algorithms
  - Add type documentation for interfaces
  - Comment non-obvious implementation decisions

- [ ] **Create Implementation Notes**
  - Document Spotify setup steps
  - Note iOS-specific configurations
  - List known limitations
  - Provide troubleshooting tips

- [ ] **Performance Review**
  - Review photo loading/rendering approach
  - Check for potential memory leaks
  - Verify proper resource cleanup
  - Review state management patterns

**Note**: All testing (manual, unit, e2e) will be performed by user on configured laptop. No test code will be written.

#### Deliverables
- Clean, documented codebase
- Implementation notes for setup
- Ready for user testing

---

### **PHASE 8: Final Preparation for Release**
*Estimated Time: 2-3 hours*

#### Tasks
- [ ] **App Store Assets**
  - Design app icon (proper iOS icon set)
  - Create launch screen/splash screen
  - Screenshot slideshow features for store listing
  - Write app description and keywords

- [ ] **Privacy & Compliance**
  - Privacy policy (photo access, Spotify data usage)
  - Terms of service (optional for MVP)
  - Add privacy policy link in app settings
  - Spotify Developer Terms compliance review

- [ ] **Build Configuration**
  - Configure proper bundle ID
  - Set version number (1.0.0 for MVP)
  - Configure code signing
  - Enable necessary capabilities in Xcode

- [ ] **Final Testing**
  - TestFlight build
  - Test on physical devices
  - Test with real Spotify Premium account
  - Test with varied photo libraries

- [ ] **Documentation**
  - Update README with setup instructions
  - Document Spotify app configuration
  - Known limitations/issues
  - Future enhancement ideas

#### Deliverables
- Production-ready build
- App Store assets
- User-facing documentation
- TestFlight release

---

## Technical Dependencies Summary

### New NPM Packages
```json
{
  "dependencies": {
    "zustand": "^4.x",
    "primereact": "^10.x",
    "primeicons": "^7.x",
    "@capacitor/camera": "^6.x",
    "@capacitor/preferences": "^6.x",
    "@capacitor-community/media": "^6.x",
    "@capacitor-community/keep-awake": "^6.x",
    "axios": "^1.x"
  }
}
```

### Spotify Integration
- **Spotify Developer Account**: Required
- **Spotify App Registration**: Client ID needed
- **Spotify Premium Account**: Required for playback control
- **Spotify Web Playback SDK**: For music playback

### iOS Requirements
- **Minimum iOS Version**: 13.0+ (Capacitor 7 requirement)
- **Device Permissions**: Photo Library access
- **Capabilities**: Background Modes (Audio) for music playback

---

## Risk Assessment & Mitigation

### High Priority Risks

**1. Spotify Premium Requirement**
- **Risk**: Users without Premium can't use core feature
- **Mitigation**: Clear messaging during onboarding, check account type after auth, provide helpful upgrade link

**2. Photo Library Performance**
- **Risk**: Large photo libraries (1000+ photos) may cause performance issues
- **Mitigation**: Implement pagination, lazy loading, thumbnail generation, limit initial load

**3. iOS Background Audio Limitations**
- **Risk**: iOS may suspend audio when app backgrounded
- **Mitigation**: Configure proper audio session category, test thoroughly, handle interruptions gracefully

**4. Spotify Token Management**
- **Risk**: Tokens expire, users logged out unexpectedly
- **Mitigation**: Implement robust refresh logic, silent re-auth when possible, clear user messaging

### Medium Priority Risks

**5. Memory Usage**
- **Risk**: Loading many high-res photos into memory
- **Mitigation**: Image compression, load only visible + adjacent photos, clear cache

**6. Network Dependency**
- **Risk**: Spotify requires internet connection
- **Mitigation**: Check connectivity, show offline message, graceful degradation

**7. Spotify API Rate Limits**
- **Risk**: Excessive API calls may hit rate limits
- **Mitigation**: Implement caching, debounce search, paginate requests

---

## Out of Scope for MVP

These features are explicitly excluded from MVP to maintain focus:

- ❌ Saving/managing multiple slideshow configurations
- ❌ Video support in slideshows
- ❌ iCloud photo library integration
- ❌ Apple Music integration
- ❌ Social sharing features
- ❌ Custom transition effects (fade only for MVP)
- ❌ Photo editing/filters
- ❌ Collaborative playlists
- ❌ Analytics/usage tracking
- ❌ In-app purchases or monetization
- ❌ iPad-optimized UI
- ❌ Widget support
- ❌ Apple Watch companion app

---

## Post-MVP Enhancement Ideas

**Phase 9 Candidates** (for discussion after MVP):
1. Save favorite slideshow configurations
2. Custom transition effects (slide, zoom, ken burns)
3. Photo filters and editing
4. Slideshow templates (birthday, wedding, vacation themes)
5. Export slideshow as video file
6. iCloud photo integration
7. Collaborative slideshows (share with friends)
8. Apple Music support
9. Advanced shuffle algorithms (face detection, date clustering)
10. AI-powered photo selection (best photos)

---

## Success Metrics for MVP

### Technical Goals
- App launch time < 2 seconds
- Photo grid renders 50+ photos smoothly (60fps)
- Slideshow transitions are smooth (no jank)
- Spotify auth success rate > 95%
- Zero critical crashes in TestFlight

### User Experience Goals
- User can complete first slideshow in < 5 minutes
- Spotify connection flow completes in < 30 seconds
- Slideshow supports 100+ photos without issues
- Music and photos stay in sync throughout playback

**Note**: These will be validated by user during testing phase on configured environment.

---

## Development Timeline Estimate

| Phase | Description | Estimated Time |
|-------|-------------|----------------|
| Phase 0 | Foundation Setup | 2-3 hours |
| Phase 1 | Photo Library Integration | 4-5 hours |
| Phase 2 | Spotify Authentication | 4-5 hours |
| Phase 3 | Spotify Music Selection | 5-6 hours |
| Phase 4 | Slideshow Engine | 6-8 hours |
| Phase 5 | Background Music Playback | 6-8 hours |
| Phase 6 | Polish & UX Refinements | 4-5 hours |
| Phase 7 | Code Review & Documentation | 2-3 hours |
| Phase 8 | Final Preparation | 2-3 hours |
| **TOTAL** | | **35-47 hours** |

**Note**: This is an estimate for focused development time on this laptop (code implementation only). Real-world timelines should account for:
- User testing and debugging iterations on testing laptop
- Spotify Developer approval wait time
- Design iteration and feedback
- Unexpected technical challenges
- Build/sync/test cycles on properly configured environment

---

## Getting Started

Once you approve this plan, you can proceed phase-by-phase with prompts like:
- "Proceed with Phase 0"
- "Proceed with Phase 1"
- etc.

Each phase will be implemented completely before moving to the next, ensuring a solid, testable foundation at each step.

---

## Questions for Consideration

Before proceeding, you may want to consider:

1. **App Name**: "Slideshow Buddy" final or open to alternatives?
2. **Monetization**: Free MVP or plan for future monetization? (affects Spotify app type)
3. **Target Audience**: General consumers or specific demographic? (affects design choices)
4. **Launch Timeline**: Soft deadline for MVP completion?
5. **Testing Resources**: Do you have Spotify Premium for testing?
6. **Design Assets**: Will you provide custom icons/branding or use defaults?

---

## Appendix: Useful Resources

### Documentation
- [Ionic React Docs](https://ionicframework.com/docs/react)
- [Capacitor Docs](https://capacitorjs.com/docs)
- [Spotify Web API](https://developer.spotify.com/documentation/web-api)
- [Spotify Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk)
- [PrimeReact Components](https://primereact.org/)

### Spotify Integration Guides
- [Authorization Guide](https://developer.spotify.com/documentation/web-api/concepts/authorization)
- [PKCE Flow for Mobile](https://developer.spotify.com/documentation/ios/concepts/authorization)
- [Web Playback SDK Tutorial](https://developer.spotify.com/documentation/web-playback-sdk/tutorials/getting-started)

### iOS Development
- [Info.plist Keys](https://developer.apple.com/library/archive/documentation/General/Reference/InfoPlistKeyReference/)
- [Background Audio Configuration](https://developer.apple.com/documentation/avfoundation/media_playback/configuring_your_app_for_media_playback)

---

**Last Updated**: November 5, 2025  
**Version**: 1.0  
**Status**: Awaiting Approval
