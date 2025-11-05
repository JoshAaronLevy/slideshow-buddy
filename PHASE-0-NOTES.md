# Phase 0 Setup Notes

## Completed Tasks

### 1. Project Metadata Updated
- ✅ Bundle ID changed: `io.ionic.starter` → `com.slideshowbuddy.app`
- ✅ App display name: `slideshow-buddy` → `Slideshow Buddy`
- ✅ Updated in `capacitor.config.ts` and `ios/App/App/Info.plist`

### 2. Dependencies Installed
**NPM Packages:**
- ✅ `zustand` - State management
- ✅ `primereact` - UI component library
- ✅ `primeicons` - Icon library for PrimeReact
- ✅ `axios` - HTTP client for Spotify API

**Capacitor Plugins:**
- ✅ `@capacitor/camera` - Photo library access
- ✅ `@capacitor/preferences` - Secure storage for tokens
- ✅ `@capacitor-community/media` - Media handling
- ✅ `@capacitor-community/keep-awake` - Keep screen awake during slideshow

### 3. PrimeReact Theme Configured
- ✅ Imported `lara-dark-blue` theme in `src/main.tsx` (matches Ionic dark mode)
- ✅ Imported PrimeReact core CSS and PrimeIcons

### 4. Folder Structure Created
```
src/
├── stores/          # Zustand stores (photoStore, musicStore, etc.)
├── services/        # API services (Spotify, Photo)
├── types/           # TypeScript interfaces and types
├── hooks/           # Custom React hooks
├── utils/           # Helper functions
└── constants/       # App constants and configuration
```

### 5. TypeScript Types Defined
Created `src/types/index.ts` with core interfaces:
- `Photo` - Photo library items
- `SpotifyTrack` - Spotify track data
- `SpotifyPlaylist` - Spotify playlist data
- `SpotifyUser` - User profile data
- `SlideshowConfig` - Slideshow configuration
- `SpotifyTokens` - OAuth tokens
- `MusicSource` - Discriminated union for music sources
- `AppError` - Error handling

### 6. Constants Defined
Created `src/constants/index.ts` with:
- `SPOTIFY_CONFIG` - API endpoints, scopes, redirect URI
- `SLIDESHOW_DEFAULTS` - Default transition times, shuffle settings
- `STORAGE_KEYS` - Keys for Capacitor Preferences storage
- `UI_CONSTANTS` - UI-related constants
- `COLORS` - Design color palette

### 7. iOS Permissions Configured
Added to `ios/App/App/Info.plist`:
- ✅ `NSPhotoLibraryUsageDescription` - For reading photos
- ✅ `NSPhotoLibraryAddUsageDescription` - For saving photos (future use)

### 8. Environment Configuration
- ✅ Created `.env.example` with `VITE_SPOTIFY_CLIENT_ID`
- ✅ Updated `.gitignore` to exclude `.env` file

## Next Steps (Before Phase 1)

### Required: Spotify Developer Setup
1. Go to https://developer.spotify.com/dashboard
2. Create a new app called "Slideshow Buddy"
3. Add redirect URI: `slideshowbuddy://callback`
4. Copy your Client ID
5. Create `.env` file in project root:
   ```
   VITE_SPOTIFY_CLIENT_ID=your_actual_client_id_here
   ```

### Required: Capacitor Sync (On Testing Laptop)
On your properly configured laptop, run:
```bash
npx cap sync ios
```

This will:
- Copy web assets to iOS project
- Update native dependencies
- Configure iOS project with new bundle ID and permissions

### Ready for Phase 1
Once Capacitor sync is complete on your testing laptop, the app will be ready for Phase 1: Photo Library Integration.

## Notes
- No build or sync commands were run on this laptop per your instructions
- All code implementation is complete for Phase 0
- Testing should be done on your configured laptop after syncing
