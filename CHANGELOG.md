# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
