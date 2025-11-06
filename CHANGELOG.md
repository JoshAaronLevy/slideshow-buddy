# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2025-11-06

### Added
- Loop/repeat toggle for slideshows - automatically restart from beginning when finished
- Re-shuffle feature - when both loop and shuffle are enabled, photos are randomly shuffled each time the slideshow restarts
- Photo permission check on app launch with user-friendly alert if access is denied
- Spotify sync modal that appears after photo permissions are granted (first launch only)
- SpotifySyncModal component with "Sync Now" and "Sync Later" options
- User preference storage to remember if Spotify sync was dismissed

### Fixed
- Controls no longer auto-hide in slideshow player - now hide after 3 seconds on slideshow start
- X button in slideshow player now only hides controls instead of closing the entire slideshow
- Added dedicated "Exit" button (with text label) to properly close slideshows
- Infinite scroll loading spinner now clearly visible when fetching more photos in PhotoPickerModal

### Changed
- Redesigned slideshow player control buttons layout with separate hide/exit actions
- Enhanced infinite scroll spinner visibility with larger size and primary color styling

## [0.3.0] - 2025-11-06

### Added
- Photo album browsing - users can now view and select photos from any album in their device library
- `PhotoAlbum` type for representing device photo albums
- `getPhotoAlbums()` function to fetch available photo albums from device
- `getPhotosFromAlbum()` function with pagination support for loading photos from specific albums or all photos
- Infinite scroll for photo loading - photos load automatically as user scrolls (no "Load More" button needed)
- Album view with "All Photos" option plus all device albums in PhotoPickerModal
- Complete photo objects (with base64 data URIs) now stored in slideshows instead of just IDs

### Changed
- **BREAKING**: Completely rewrote PhotoPickerModal to support album browsing and direct device library access
- **BREAKING**: Removed "imported photos" workflow - photos are now selected directly from device library when creating slideshows
- **BREAKING**: Slideshows now store complete Photo objects instead of relying on separate photo store
- PhotoService now uses pagination with `createdBefore` parameter for efficient photo loading
- SlideshowsTab no longer uses photoStore for photo management
- Photo selection flow simplified - clicking "+" button now directly opens device photo library

### Fixed
- **Bug 1**: Users can now view and browse all their photo albums, not just the default photo library
- **Bug 2**: Eliminated confusing "imported photos" page - photo selection is now direct and intuitive
- **Bug 3**: Fixed "Load More Photos" button not working - replaced with infinite scroll that properly loads all photos
- **Bug 4**: Fixed slideshow controls automatically appearing and disappearing after each photo transition - controls now only appear on user tap

### Removed
- Photo import workflow from photoStore (photos no longer need to be imported into app before creating slideshows)
- "Import Photos" and "Import More Photos" buttons from PhotoPickerModal
- Dependency on photoStore in SlideshowsTab and SlideshowPlayer

## [0.2.1] - 2025-11-05

### Fixed
- Fixed slideshow card thumbnail displaying as blank gray box - now shows the most recent photo from the slideshow
- Fixed "Save and Play" getting stuck on "Initializing music player..." overlay when music fails to load or no music is selected - slideshow now plays regardless of music status with appropriate error toasts
- Fixed photo duplication bug where photos appeared multiple times in the picker after creating multiple slideshows - photo library now properly filters out duplicate imports

## [0.2.0] - 2025-11-05

### Added
- Spotify OAuth implementation with Authorization Code + PKCE (S256) flow
- `src/lib/pkce.ts` - PKCE utility functions (code verifier generation, SHA-256, base64url encoding, S256 challenge)
- `src/services/spotifyAuth.ts` - Backend token exchange service (buildAuthUrl, exchangeCodeForTokens, verifyState)
- `src/hooks/useSpotifyAuth.ts` - React hook for Spotify OAuth with callbacks and App URL listener
- `src/components/SpotifyLoginButton.tsx` - Reusable Spotify login button component with status indicators
- Demo integration in Tab1 (My Photos) page to showcase new OAuth implementation
- Comprehensive OAuth documentation in `SPOTIFY_OAUTH_IMPLEMENTATION.md`
- Environment variable support for backend token exchange (VITE_API_BASE_URL)
- Custom URL scheme handling via @capacitor/app for `com.slideshowbuddy://callback`
- sessionStorage-based OAuth state management (non-persistent, secure)

### Changed
- Updated `.env.example` with backend API URL and OAuth scopes configuration
- Enhanced Tab1 page with Spotify OAuth demo card for testing

### Security
- OAuth state stored in sessionStorage (cleared on browser close) instead of localStorage
- Token exchange performed via backend to keep client secret secure (never exposed to mobile app)
- PKCE (Proof Key for Code Exchange) prevents authorization code interception attacks
- State parameter verification prevents CSRF attacks

## [0.1.0] - 2025-11-05

### Added
- HapticService with 7 feedback functions for tactile user interactions (impact light/medium/heavy, notification success/warning/error, selection changed)
- SkeletonLoader component for improved perceived performance during loading states
- Skeleton loaders to photo grid in Tab1 (displays 12 photo skeletons during import)
- Skeleton loaders to music lists in Tab2 (playlists, tracks, recently played, and featured sections)
- Music player initialization loading overlay in SlideshowPlayer with spinner and status message
- Comprehensive ARIA labels to all icon buttons and interactive elements across all components
- Screen reader support for Tab1, Tab2, Tab3, SlideshowPlayer, and PlaylistDetailModal

### Changed
- Enhanced empty states in Tab1 with images icon, descriptive text, and helpful hints
- Enhanced empty states in Tab2 with better messaging and visual feedback
- Integrated haptic feedback throughout the app: photo import, photo selection, playlist selection, slideshow controls, toggle switches, and all button interactions
- Improved accessibility with descriptive aria-labels on all interactive elements
- Updated Tab1 photo grid with enhanced loading states and empty state styling
- Updated Tab2 music selection with skeleton loading for better UX during data fetch

### Fixed
- Loading state consistency across photo and music selection screens
- Accessibility compliance for screen readers and assistive technologies

## [0.0.1] - 2025-11-05

### Added
- Initial MVP implementation with photo library management
- Spotify authentication and music selection
- Slideshow engine with configurable settings
- Background music playback during slideshows
- Photo import from device camera and library
- Spotify Premium integration for music playback
- Slideshow controls: play/pause, next/previous, speed adjustment
- Keep-awake functionality during slideshow playback
- Swipe gestures for photo navigation
- Auto-advance with configurable transition times
- Loop and shuffle options for slideshows
