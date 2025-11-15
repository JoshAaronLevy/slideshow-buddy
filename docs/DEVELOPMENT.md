# Development Setup Guide

This guide covers setting up the development environment for both iOS and macOS platforms of Slideshow Buddy.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Development Environment Setup](#development-environment-setup)
- [Project Structure](#project-structure)
- [Development Commands](#development-commands)
- [Platform-Specific Development](#platform-specific-development)
- [Common Development Tasks](#common-development-tasks)
- [Testing](#testing)
- [Troubleshooting Development Issues](#troubleshooting-development-issues)

## Prerequisites

### System Requirements
- **macOS**: macOS Sequoia 15.0+ (required for both iOS and macOS development)
- **Node.js**: v18.0+ (v20.17.0+ recommended)
- **npm**: v9.0+ (v11.4.0+ recommended)

### Required Development Tools

#### For Both Platforms
```bash
# Verify Node.js and npm versions
node --version  # Should be 18.0+
npm --version   # Should be 9.0+
```

#### For iOS Development
- **Xcode**: 14.0+ from Mac App Store
- **Xcode Command Line Tools**:
  ```bash
  xcode-select --install
  ```
- **Apple Developer Account**: For device testing and distribution

#### For macOS Development
- **Xcode Command Line Tools**: (same as iOS)
- **Electron Dependencies**: Automatically installed with project setup

### Spotify Development Setup
- **Spotify Developer Account**: [Create at Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
- **Spotify Premium Account**: Required for testing music playback
- **Spotify App Registration**: OAuth app with custom redirect URI

## Development Environment Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd slideshow-buddy
```

### 2. Install Dependencies

#### Root Project Dependencies
```bash
# Install web application dependencies
npm install
```

#### Electron Dependencies (for macOS)
```bash
# Install Electron platform dependencies
cd electron
npm install
cd ..
```

### 3. Environment Configuration

#### Create Environment File
```bash
# Copy template environment file
cp .env.example .env
```

#### Configure Spotify Integration
Edit `.env` file with your Spotify app credentials:
```env
VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id_here
VITE_SPOTIFY_REDIRECT_URI=com.slideshowbuddy://callback
VITE_SPOTIFY_BACKEND_URL=https://slideshow-buddy-server.onrender.com
```

### 4. Platform Setup

#### iOS Platform Setup
```bash
# Add iOS platform
npx cap add ios

# Initial sync
npm run cap:sync:ios
```

#### macOS Platform Setup
```bash
# Add Electron platform (if not already added)
npx cap add @capacitor-community/electron

# Initial sync
npm run cap:sync:electron

# Build Swift native modules
cd electron
npm run build:swift
cd ..
```

### 5. Verify Installation
```bash
# Build the project
npm run build

# Verify iOS setup
npm run cap:open:ios
# Xcode should open with the iOS project

# Verify macOS setup
npm run electron:dev
# Electron app should launch
```

## Project Structure

```
slideshow-buddy/
├── src/                          # Main application source
│   ├── components/               # React components
│   ├── pages/                    # Page components (Tab1, Tab2, Tab3, SettingsTab)
│   ├── services/                 # Business logic services
│   │   ├── PhotoService.ts       # Photo import and management
│   │   ├── SpotifyAuthService.ts # Spotify OAuth handling
│   │   ├── MusicPlayerService.ts # Music playback control
│   │   ├── SlideshowService.ts   # Slideshow coordination
│   │   ├── StorageService.ts     # Cross-platform storage
│   │   └── LifecycleService.ts   # App lifecycle management
│   ├── stores/                   # Zustand state management
│   ├── types/                    # TypeScript type definitions
│   ├── utils/                    # Utility functions
│   │   └── platform.ts           # Platform detection utilities
│   ├── constants/                # App configuration constants
│   └── theme/                    # CSS themes and styling
├── ios/                          # iOS native project
│   └── App/                      # Xcode project files
├── electron/                     # macOS native project
│   ├── src/                      # Electron main process
│   │   ├── index.ts              # Main process entry point
│   │   ├── preload.ts            # Renderer preload script
│   │   ├── menu.ts               # macOS menu bar setup
│   │   └── native/               # Swift native modules
│   │       ├── PhotosLibraryBridge.swift
│   │       ├── PhotoAssetConverter.swift
│   │       └── PhotosPermissionManager.swift
│   ├── assets/                   # App icons and resources
│   ├── resources/                # Build resources
│   │   └── entitlements.mac.plist
│   ├── scripts/                  # Build scripts
│   │   └── build-swift.sh        # Swift compilation script
│   ├── BUILD.md                  # Detailed build instructions
│   └── package.json              # Electron dependencies
├── public/                       # Static web assets
├── docs/                         # Documentation
├── capacitor.config.ts           # Capacitor configuration
├── package.json                  # Main dependencies and scripts
└── tsconfig.json                 # TypeScript configuration
```

### Key Configuration Files
- [`capacitor.config.ts`](../capacitor.config.ts) - Platform configuration
- [`package.json`](../package.json) - Dependencies and scripts
- [`electron/package.json`](../electron/package.json) - Electron-specific dependencies
- [`tsconfig.json`](../tsconfig.json) - TypeScript compilation settings

## Development Commands

### Core Development Commands

#### Web Development
```bash
# Start Vite development server (web preview)
npm run dev
# Opens http://localhost:5173

# Build production web assets
npm run build

# Preview production build
npm run preview

# Clean build artifacts
npm run clean
```

#### Code Quality
```bash
# Run ESLint
npm run lint

# Run TypeScript compilation check
npx tsc --noEmit
```

### iOS Development Commands

```bash
# Full iOS development workflow
npm run ios:dev
# Builds → syncs → opens Xcode

# Build and sync without opening Xcode
npm run ios:sync

# Just open Xcode project
npm run cap:open:ios

# Manual Capacitor commands
npm run cap:sync:ios        # Sync web assets to iOS
npm run cap:copy           # Copy assets without plugin updates
npm run cap:update         # Update Capacitor plugins
```

### macOS Development Commands

```bash
# Full macOS development workflow
npm run electron:dev
# Builds → syncs → opens Electron app

# Build and sync without opening app
npm run electron:sync

# Open Electron app manually
npm run cap:open:electron

# Build for production
npm run electron:build:mac

# Build Swift native modules
cd electron && npm run build:swift
```

### Capacitor Commands
```bash
# Sync to all platforms
npm run cap:sync

# Platform-specific sync
npm run cap:sync:ios
npm run cap:sync:electron

# Copy web assets only (no plugin updates)
npm run cap:copy

# Update all Capacitor plugins
npm run cap:update
```

## Platform-Specific Development

### iOS Development Workflow

1. **Start Development**:
   ```bash
   npm run ios:dev
   ```

2. **Make Code Changes**: Edit files in `src/`

3. **Update iOS**: When you make changes:
   ```bash
   npm run ios:sync
   ```

4. **Run in Xcode**: Press "Play" button in Xcode

5. **Debug**: Use Xcode debugger for native issues, browser dev tools for web layer

#### iOS-Specific Considerations
- **Device Testing**: Requires Apple Developer account
- **Simulator**: Test on various iOS device simulators
- **Permissions**: Configure in [`ios/App/App/Info.plist`](../ios/App/App/Info.plist)
- **Icons**: Update in [`ios/App/App/Assets.xcassets/`](../ios/App/App/Assets.xcassets/)

### macOS Development Workflow

1. **Start Development**:
   ```bash
   npm run electron:dev
   ```

2. **Make Code Changes**: Edit files in `src/`

3. **Update Electron**: When you make changes:
   ```bash
   npm run electron:sync
   # Or restart the Electron app
   ```

4. **Debug**: Use Electron DevTools (Cmd+Option+I)

5. **Swift Module Changes**: If modifying Swift code:
   ```bash
   cd electron
   npm run build:swift
   cd ..
   npm run electron:sync
   ```

#### macOS-Specific Considerations
- **Swift Native Modules**: Located in [`electron/src/native/`](../electron/src/native/)
- **Permissions**: Configure in [`electron/resources/entitlements.mac.plist`](../electron/resources/entitlements.mac.plist)
- **App Icons**: Update in [`electron/assets/`](../electron/assets/)
- **Menu Bar**: Configured in [`electron/src/menu.ts`](../electron/src/menu.ts)

## Common Development Tasks

### Adding New Features

1. **Cross-Platform Service**: Create in `src/services/`
   ```typescript
   // src/services/NewFeatureService.ts
   import { isMacOS, isIOS } from '../utils/platform';
   
   export const newFeatureAction = async () => {
     if (isMacOS()) {
       // macOS implementation
     } else if (isIOS()) {
       // iOS implementation
     }
   };
   ```

2. **Platform-Specific Code**: Use platform detection
   ```typescript
   import { isMacOS, isMobile } from '../utils/platform';
   
   const MyComponent = () => {
     return (
       <div>
         {isMacOS() && <MacOSOnlyFeature />}
         {isMobile() && <MobileOnlyFeature />}
       </div>
     );
   };
   ```

3. **Update Both Platforms**: Sync changes to both platforms
   ```bash
   npm run ios:sync
   npm run electron:sync
   ```

### Working with Swift Native Modules

1. **Edit Swift Code**: Modify files in [`electron/src/native/`](../electron/src/native/)

2. **Compile Swift Modules**:
   ```bash
   cd electron
   npm run build:swift
   ```

3. **Update TypeScript Bindings**: Edit [`electron/src/native/PhotosLibraryFFI.ts`](../electron/src/native/PhotosLibraryFFI.ts)

4. **Test Changes**:
   ```bash
   cd ..
   npm run electron:sync
   ```

### Adding New Dependencies

#### Web Dependencies
```bash
npm install new-package
```

#### Capacitor Plugins
```bash
npm install @capacitor/new-plugin
npm run cap:sync
```

#### Electron Dependencies
```bash
cd electron
npm install electron-specific-package
cd ..
npm run electron:sync
```

### Managing Environment Variables

1. **Add to `.env`**:
   ```env
   VITE_NEW_VARIABLE=value
   ```

2. **Use in Code**:
   ```typescript
   const newValue = import.meta.env.VITE_NEW_VARIABLE;
   ```

3. **Platform-Specific Variables**:
   ```typescript
   const apiUrl = isMacOS() 
     ? import.meta.env.VITE_MACOS_API_URL 
     : import.meta.env.VITE_IOS_API_URL;
   ```

## Testing

### Manual Testing Workflow

#### Web Testing
```bash
npm run dev
# Test at http://localhost:5173
```

#### iOS Testing
```bash
npm run ios:dev
# Test in iOS Simulator or device via Xcode
```

#### macOS Testing
```bash
npm run electron:dev
# Test in Electron app window
```

### Testing Checklist

#### Cross-Platform Features
- [ ] Photo import works on both platforms
- [ ] Spotify authentication completes
- [ ] Slideshow playback functions correctly
- [ ] App lifecycle events handled properly
- [ ] Storage persistence across app restarts

#### Platform-Specific Features
- [ ] **iOS**: Haptic feedback works
- [ ] **macOS**: Keyboard shortcuts function
- [ ] **macOS**: Menu bar integration works
- [ ] **macOS**: Native Photos library access
- [ ] **macOS**: Window management features

#### Performance Testing
- [ ] Large photo libraries load efficiently
- [ ] Memory usage remains reasonable during slideshow
- [ ] Smooth transitions and animations
- [ ] Audio synchronization quality

## Troubleshooting Development Issues

### Common Build Issues

#### TypeScript Errors
```bash
# Check TypeScript compilation
npx tsc --noEmit

# Common fixes
npm run clean
npm install
npm run build
```

#### Capacitor Sync Issues
```bash
# Reset Capacitor platforms
npx cap remove ios
npx cap remove electron
npx cap add ios
npx cap add @capacitor-community/electron
npm run cap:sync
```

#### Swift Build Errors (macOS)
```bash
# Clean and rebuild Swift modules
cd electron
rm -rf build
npm run build:swift

# Check Xcode Command Line Tools
xcode-select --install
```

### Platform-Specific Issues

#### iOS Issues
- **Xcode Version**: Ensure Xcode 14+ is installed
- **Simulator Issues**: Reset simulator if needed
- **Code Signing**: Check Apple Developer account status
- **Plugin Compatibility**: Verify Capacitor plugin iOS supports

#### macOS Issues
- **Electron Version**: Ensure compatible with your macOS version
- **Native Module Compilation**: Check Swift/Objective-C compilation
- **Permissions**: Verify entitlements configuration
- **CSP Issues**: Check Content Security Policy settings

### Performance Issues
- **Memory Leaks**: Use browser/Electron dev tools to profile memory usage
- **Photo Loading**: Implement lazy loading for large photo libraries
- **Bundle Size**: Analyze bundle size with `npm run build` output
- **Native Performance**: Profile Swift modules if needed

### Debugging Tips

#### Web Layer Debugging
- **Browser DevTools**: Use in development mode (`npm run dev`)
- **Console Logging**: Add strategic console.log statements
- **React DevTools**: Install browser extension for React debugging

#### iOS Debugging
- **Xcode Console**: View native iOS logs
- **Safari Web Inspector**: Debug web content in iOS app
- **Simulator**: Test various device sizes and iOS versions

#### macOS Debugging
- **Electron DevTools**: Press `Cmd+Option+I` in Electron app
- **Main Process Logs**: Check terminal output when running `electron:dev`
- **Swift Debugging**: Add print statements to Swift modules

#### Cross-Platform Debugging
- **Platform Detection**: Verify `platform.ts` utilities work correctly
- **Service Layer**: Add logging to service methods
- **State Management**: Use Zustand dev tools for state debugging

---

**Last Updated**: November 2024  
**Capacitor Version**: 7.4.4  
**Electron Version**: 26.2.2  
**Node.js**: v18.0+ Required