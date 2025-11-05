# Slideshow Buddy

An iOS application that creates photo slideshows with Spotify music integration. Built with Ionic React and Capacitor.

## Overview

Slideshow Buddy allows users to:
- Import photos from their device photo library
- Connect to Spotify and select playlists or tracks
- Create beautiful slideshows with synchronized music playback
- Customize slideshow settings (transition speed, shuffle, loop)

## Requirements

- **Node.js**: v18+ recommended
- **npm**: v9+ recommended
- **iOS Development**:
  - macOS with Xcode 14+ installed
  - iOS device or simulator running iOS 13+
  - Apple Developer account (for device testing)
- **Spotify**:
  - Spotify Developer account (for API credentials)
  - Spotify Premium account (required for music playback)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd slideshow-buddy

# Install dependencies
npm install

# Sync Capacitor with iOS
npm run cap:sync:ios
```

## Development Scripts

### Core Development
- **`npm run dev`** - Start Vite development server (web preview)
- **`npm run build`** - Build the production web assets (TypeScript compilation + Vite build)
- **`npm run preview`** - Preview production build locally
- **`npm run lint`** - Run ESLint to check code quality

### iOS Development Workflow
- **`npm run ios:dev`** - Full development workflow: build → sync → open Xcode
  - Builds web assets
  - Syncs to iOS platform
  - Opens project in Xcode for running on device/simulator
  
- **`npm run ios:sync`** - Build and sync to iOS (without opening Xcode)
  - Useful when you just need to update iOS with latest changes

### Capacitor Commands
- **`npm run cap:sync`** - Sync web assets to all platforms (iOS)
- **`npm run cap:sync:ios`** - Sync web assets to iOS only
- **`npm run cap:open:ios`** - Open iOS project in Xcode
- **`npm run cap:run:ios`** - Build and run on iOS device/simulator (if configured)
- **`npm run cap:copy`** - Copy web assets to native platforms without updating plugins
- **`npm run cap:update`** - Update Capacitor plugins to latest compatible versions

### Ionic Commands
- **`npm run ionic:serve`** - Serve app with Ionic CLI (includes live reload)
- **`npm run ionic:build`** - Build app using Ionic CLI

### Utility Scripts
- **`npm run clean`** - Clean build artifacts (dist folder and Vite cache)

### Testing
- **`npm run test.unit`** - Run unit tests with Vitest
- **`npm run test.e2e`** - Run end-to-end tests with Cypress

## Typical Development Workflow

### Web Development & Testing
```bash
# Start development server for quick web testing
npm run dev
# Open http://localhost:5173 in browser
```

### iOS Device/Simulator Testing
```bash
# Option 1: Full workflow (most common)
npm run ios:dev
# This builds, syncs, and opens Xcode
# Then press "Play" in Xcode to run on device/simulator

# Option 2: Just sync changes (if Xcode is already open)
npm run ios:sync
# Then run again from Xcode
```

### Making Code Changes
1. Edit source files in `src/`
2. For web testing: Changes auto-reload with `npm run dev`
3. For iOS testing: Run `npm run ios:sync` then build/run in Xcode

## Project Structure

```
slideshow-buddy/
├── src/
│   ├── components/      # Reusable React components
│   │   ├── SkeletonLoader.tsx
│   │   ├── SlideshowPlayer.tsx
│   │   └── PlaylistDetailModal.tsx
│   ├── pages/           # Tab pages (Tab1, Tab2, Tab3)
│   ├── services/        # Business logic and API services
│   │   ├── PhotoService.ts
│   │   ├── SpotifyAuthService.ts
│   │   ├── SpotifyService.ts
│   │   ├── SlideshowService.ts
│   │   ├── MusicPlayerService.ts
│   │   └── HapticService.ts
│   ├── stores/          # Zustand state management
│   │   ├── photoStore.ts
│   │   ├── authStore.ts
│   │   ├── musicStore.ts
│   │   └── slideshowStore.ts
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Helper utilities (PKCE, etc.)
│   ├── constants/       # App constants and configurations
│   └── theme/           # CSS theme and variables
├── ios/                 # iOS native project (Xcode)
├── public/              # Static assets
├── capacitor.config.ts  # Capacitor configuration
└── package.json         # Dependencies and scripts
```

## Configuration

### Spotify Integration Setup

1. **Create Spotify App**:
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Create a new app
   - Note your Client ID
   - Add redirect URI: `slideshowbuddy://callback`

2. **Configure Environment**:
   - Create `.env` file in project root (if not exists)
   - Add your Spotify credentials:
     ```
     VITE_SPOTIFY_CLIENT_ID=your_client_id_here
     VITE_SPOTIFY_REDIRECT_URI=slideshowbuddy://callback
     ```

3. **Update iOS Info.plist**:
   - The redirect URI is already configured in `ios/App/App/Info.plist`
   - Verify `CFBundleURLSchemes` includes `slideshowbuddy`

### iOS Permissions

The following permissions are configured in `ios/App/App/Info.plist`:
- **NSPhotoLibraryUsageDescription**: Required for photo library access
- **NSPhotoLibraryAddUsageDescription**: Optional, for saving photos

## Features

### Phase 0-5 (Complete)
- ✅ Photo library import and management
- ✅ Multi-photo selection with grid view
- ✅ Spotify OAuth authentication (PKCE flow)
- ✅ Playlist and track selection
- ✅ Full-screen slideshow player
- ✅ Background music playback with Spotify SDK
- ✅ Slideshow controls (play/pause, next/previous, speed adjustment)
- ✅ Configurable settings (shuffle, loop, transition time)

### Phase 6 (Complete - v0.1.0)
- ✅ Haptic feedback on all interactions
- ✅ Skeleton loading states for photos and music
- ✅ Enhanced empty states with helpful messaging
- ✅ Comprehensive accessibility (ARIA labels, screen reader support)
- ✅ Music player loading indicator
- ✅ Improved UX polish throughout

## Known Limitations

- **Spotify Premium Required**: Music playback requires an active Spotify Premium subscription
- **iOS Only**: Currently iOS-specific (uses Capacitor iOS platform)
- **Internet Required**: Spotify integration requires internet connection
- **No Offline Mode**: Photos require device storage; music requires Spotify connectivity

## Troubleshooting

### Build Issues
```bash
# Clean build artifacts and rebuild
npm run clean
npm install
npm run build
```

### iOS Sync Issues
```bash
# Remove and re-add iOS platform
npx cap remove ios
npx cap add ios
npm run cap:sync:ios
```

### Capacitor Plugin Issues
```bash
# Update all Capacitor plugins
npm run cap:update
```

### Xcode Build Errors
- Ensure you have Xcode 14+ installed
- Open `ios/App/App.xcworkspace` (not .xcodeproj)
- Clean build folder in Xcode: Product → Clean Build Folder
- Check code signing settings in Xcode

## Contributing

1. Create a feature branch from `dev`
2. Make your changes
3. Test thoroughly on iOS device/simulator
4. Commit with descriptive messages
5. Push and create a pull request

## Version History

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

- **v0.1.0** (2025-11-05): Phase 6 - Polish & UX refinements
- **v0.0.1** (2025-11-05): Initial MVP implementation (Phases 0-5)

## License

Proprietary - All rights reserved

## Support

For issues or questions:
- Check existing documentation in `MVP-PLAN.md`
- Review [Ionic Documentation](https://ionicframework.com/docs)
- Review [Capacitor Documentation](https://capacitorjs.com/docs)
- Review [Spotify API Documentation](https://developer.spotify.com/documentation)
