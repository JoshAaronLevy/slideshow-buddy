# Slideshow Buddy

A cross-platform photo slideshow application that creates beautiful slideshows with Spotify music integration. Available for both iOS and macOS. Built with Ionic React and Capacitor.

## Overview

Slideshow Buddy allows users to:
- Import photos from their device photo library (iOS) or Photos app (macOS)
- Connect to Spotify and select playlists or tracks
- Create beautiful slideshows with synchronized music playback
- Customize slideshow settings (transition speed, shuffle, loop)
- Enjoy native platform experiences on both mobile and desktop

## Requirements

- **Node.js**: v18+ recommended
- **npm**: v9+ recommended
- **iOS Development**:
  - macOS with Xcode 14+ installed
  - iOS device or simulator running iOS 13+
  - Apple Developer account (for device testing)
- **macOS Development**:
  - macOS Sequoia 15.0+ for development
  - Xcode Command Line Tools
  - Apple Developer account (for code signing and distribution)
- **Spotify**:
  - Spotify Developer account (for API credentials)
  - Spotify Premium account (required for music playback)

## Installation

### For iOS Development
```bash
# Clone the repository
git clone <repository-url>
cd slideshow-buddy

# Install dependencies
npm install

# Sync Capacitor with iOS
npm run cap:sync:ios
```

### For macOS Development
```bash
# Clone the repository
git clone <repository-url>
cd slideshow-buddy

# Install dependencies
npm install

# Install Electron dependencies
cd electron && npm install && cd ..

# Sync Capacitor with Electron
npm run cap:sync:electron
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

### macOS Development Workflow

#### Quick Start
- **`npm run electron:dev`** - Full development workflow: build → sync → open Electron
  - Builds web assets
  - Syncs to Electron platform
  - Opens Electron app for testing
  
- **`npm run electron:sync`** - Build and sync to Electron (without opening app)
  - Useful when you just need to update Electron with latest changes

#### Electron Build Scripts (in `electron/` directory)

**Building & Development:**
- **`npm run build`** - Full orchestrated build pipeline
  - Runs environment validation → clean → Swift → TypeScript → verification
  - **Use this for:** Clean builds, ensuring everything is up-to-date
  - **Time:** ~10-15 seconds
  
- **`npm run build:swift`** - Compile Swift Photos library (native FFI bridge)
  - Creates universal binary (x86_64 + arm64)
  - Outputs to `assets/libPhotosLibraryBridge.dylib`
  - **Use this when:** You modify Swift source files in `src/native/`
  - **Time:** ~4-5 seconds
  
- **`npm run build:ts`** - Compile TypeScript to JavaScript
  - Compiles `src/` → `app/` directory
  - Runs electron-rebuild for native modules
  - Creates necessary symlinks and config files
  - **Use this when:** You modify TypeScript files in `electron/src/`
  - **Time:** ~1-2 seconds
  
- **`npm run build:clean`** - Remove build artifacts
  - Cleans `app/`, `dist/`, `capacitor.config.json`, symlinks
  - **Use this when:** Starting fresh or troubleshooting build issues
  
- **`npm run build:reset`** - Clean + full rebuild
  - Equivalent to `build:clean` + `build`
  - **Use this when:** Resolving mysterious build issues

**Verification Scripts:**
- **`npm run build:verify-swift`** - Validate Swift build artifacts
  - Checks if dylib exists, has correct size, and contains FFI symbols
  
- **`npm run build:verify-ts`** - Validate TypeScript build output
  - Checks if all .js files compiled correctly
  - Validates JavaScript syntax
  
- **`npm run build:verify-artifacts`** - Final comprehensive check
  - Validates all critical files before packaging
  - **Use this before:** Packaging or distributing

**Running in Development:**
- **`npm run electron:start`** - Build and launch with debugger
  - Runs full build pipeline then opens app with Chrome DevTools
  - **Use this for:** Active development with debugging
  
- **`npm run electron:start:clean`** - Clean build + launch
  - Full clean → build → launch
  - **Use this when:** Debugging issues that might be build-related
  
- **`npm run electron:start:reset`** - Reset + launch
  - Quick clean → build → launch
  - **Use this for:** Fresh start without deleting everything

**Packaging for Distribution:**
- **`npm run build:mac:unsigned`** - Package unsigned .app (fastest)
  - **Use this for:** Testing packaged app locally
  - **Output:** `dist/mac-arm64/slideshow-buddy.app` + DMG
  - **Time:** ~30-60 seconds after build
  - **When:** Daily testing, verifying packaging works
  
- **`npm run build:mac`** - Package signed .app
  - Requires valid code signing certificate
  - **Use this for:** Beta testing, TestFlight
  - **When:** Preparing for distribution to testers
  
- **`npm run build:mac:clean`** - Clean + package signed
  - Full clean build before packaging
  - **Use this for:** Release builds
  - **When:** Creating final production builds
  
- **`npm run build:mac:clean-unsigned`** - Clean + package unsigned
  - Full clean build, unsigned packaging
  - **Use this for:** Thorough local testing
  - **When:** Troubleshooting packaging issues
  
- **`npm run build:mac:reset-unsigned`** - Reset + package unsigned
  - Quick clean + unsigned package
  - **Use this for:** Fast iteration on packaging configuration
  
- **`npm run electron:package`** - Ultimate packaging script
  - Comprehensive: clean everything → build web → sync → build Swift & TS → package
  - **Use this for:** Complete release builds
  - **Time:** ~2-3 minutes
  - **When:** Final production packaging with confidence

#### Common Scenarios

**Scenario 1: Daily Development**
```bash
# Make changes to React/TypeScript code in src/
npm run dev  # Live reload for web testing

# When ready to test in Electron:
cd electron
npm run electron:start  # Builds & launches with debugger
```

**Scenario 2: Modified Electron TypeScript**
```bash
cd electron
npm run build:ts  # Just compile TypeScript
npx electron --inspect=5858 ./  # Launch manually
```

**Scenario 3: Modified Swift FFI Code**
```bash
cd electron
npm run build:swift  # Recompile Swift library
npm run electron:start  # Launch to test
```

**Scenario 4: Build Troubleshooting**
```bash
cd electron
npm run build:reset  # Nuclear option - clean everything and rebuild
npm run build:verify-artifacts  # Check what went wrong
```

**Scenario 5: Testing Packaged App**
```bash
cd electron
npm run build:mac:unsigned  # Create .app bundle

# Test the packaged app:
open "dist/mac-arm64/slideshow-buddy.app"
```

**Scenario 6: Release Build**
```bash
# From project root:
npm run electron:package  # Complete packaging pipeline

# Result: dist/mac-arm64/slideshow-buddy.app and .dmg
```

#### Build Output Locations
- **TypeScript Compiled**: `electron/app/` (JS files)
- **Swift Compiled**: `electron/assets/libPhotosLibraryBridge.dylib`
- **Packaged App**: `electron/dist/mac-arm64/slideshow-buddy.app`
- **DMG Installer**: `electron/dist/slideshow-buddy-1.0.0-arm64.dmg`
- **ZIP Archive**: `electron/dist/slideshow-buddy-1.0.0-arm64-mac.zip`

### Capacitor Commands
- **`npm run cap:sync`** - Sync web assets to all platforms (iOS, Electron)
- **`npm run cap:sync:ios`** - Sync web assets to iOS only
- **`npm run cap:sync:electron`** - Sync web assets to Electron only
- **`npm run cap:open:ios`** - Open iOS project in Xcode
- **`npm run cap:open:electron`** - Open Electron project
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

### macOS Desktop Testing
```bash
# Option 1: Full workflow (most common)
npm run electron:dev
# This builds, syncs, and opens the Electron app

# Option 2: Just sync changes (if you want to manually open)
npm run electron:sync
npm run cap:open:electron
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
