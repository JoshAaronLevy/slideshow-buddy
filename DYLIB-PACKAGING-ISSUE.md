# Swift dylib Packaging Issue - Electron Builder

## Critical Blocker
The packaged Electron app cannot load the Swift Photos library (libPhotosLibraryBridge.dylib) despite multiple attempted fixes. This is blocking production release.

## Current Status
- ✅ **FIXED**: Original issue - "Cannot find module './build/src/index.js'" error resolved by renaming TypeScript output from `build/` to `app/`
- ❌ **BLOCKING**: Swift dylib not accessible in packaged .app despite being included in build

## The Problem
When launching the packaged app (`dist/mac-arm64/slideshow-buddy.app`), it throws:

```
PhotosLibraryError: Failed to load Swift Photos library: Swift Photos library not found. 
Tried the following paths:
1. /Users/joshua.a.levy/Desktop/code/slideshow-buddy/dist/mac-arm64/slideshow-buddy.app/Contents/Resources/assets/libPhotosLibraryBridge.dylib
2. /Users/joshua.a.levy/Desktop/code/slideshow-buddy/dist/mac-arm64/slideshow-buddy.app/Contents/Resources/libPhotosLibraryBridge.dylib
```

**Key Finding**: The dylib IS being packaged - it's inside `app.asar` at path `/assets/libPhotosLibraryBridge.dylib`. However, native FFI libraries CANNOT be loaded from inside an asar archive - they must be real files on disk.

## What We've Tried (All Failed)

### Attempt 1: asarUnpack
```json
"asar": true,
"asarUnpack": ["assets/**/*"]
```
**Result**: No `app.asar.unpacked` directory created. Assets still packed in asar.

### Attempt 2: extraResources (multiple variations)
```json
"extraResources": [
  {
    "from": "assets/libPhotosLibraryBridge.dylib",
    "to": "assets/libPhotosLibraryBridge.dylib"
  }
]
```
**Result**: No assets directory in `Contents/Resources/`. Files not copied.

### Attempt 3: extraFiles
```json
"extraFiles": [
  {
    "from": "assets",
    "to": "Resources/assets"
  }
]
```
**Result**: Same - no assets directory created.

### Attempt 4: Exclude from files + extraResources
```json
"files": [
  "!assets"
],
"extraResources": [
  "assets/**/*"
]
```
**Result**: Assets still in asar, not in Resources/.

## Current electron-builder Configuration

File: `electron/electron-builder.config.json`

```json
{
  "appId": "com.slideshowbuddy.app",
  "asar": true,
  "asarUnpack": [
    "assets/**/*"
  ],
  "files": [
    "index.js",
    "package.json",
    "node_modules/**/*",
    "app/**/*",
    "capacitor.config.*",
    "dist/**/*",
    "!assets"
  ],
  "extraResources": [
    "assets/**/*"
  ]
}
```

## Current File Structure

**Development (working fine):**
```
electron/
├── index.js (entry point)
├── app/ (compiled TypeScript)
│   └── src/
│       ├── index.js
│       └── native/PhotosLibraryFFI.js
├── assets/
│   └── libPhotosLibraryBridge.dylib (498KB, universal binary)
└── dist/ -> ../dist (symlink to web content)
```

**Packaged .app (dylib not accessible):**
```
slideshow-buddy.app/
└── Contents/
    └── Resources/
        ├── app.asar (contains /assets/libPhotosLibraryBridge.dylib - WRONG!)
        └── (no assets/ directory - MISSING!)
```

## How the dylib is Loaded

File: `electron/src/native/PhotosLibraryFFI.ts` (compiles to `app/src/native/PhotosLibraryFFI.js`)

**Production paths checked (in order):**
1. `process.resourcesPath + '/assets/libPhotosLibraryBridge.dylib'`
2. `process.resourcesPath + '/libPhotosLibraryBridge.dylib'`

`process.resourcesPath` in packaged app = `Contents/Resources/`

**The code expects the dylib at:**
- `Contents/Resources/assets/libPhotosLibraryBridge.dylib` (primary)
- `Contents/Resources/libPhotosLibraryBridge.dylib` (fallback)

## Verification Commands

**Check if dylib is in asar:**
```bash
npx asar list "dist/mac-arm64/slideshow-buddy.app/Contents/Resources/app.asar" | grep dylib
# Result: /assets/libPhotosLibraryBridge.dylib (INSIDE ASAR - WRONG)
```

**Check if dylib is in Resources:**
```bash
find "dist/mac-arm64/slideshow-buddy.app" -name "*.dylib" -not -path "*/Frameworks/*"
# Result: No Swift dylib found (only Electron's own dylibs)
```

**Check for assets directory:**
```bash
ls "dist/mac-arm64/slideshow-buddy.app/Contents/Resources/" | grep assets
# Result: (empty - assets directory doesn't exist)
```

## Cyclic Problem
We keep going in circles:
1. Try config change → rebuild (~2 min) → test → dylib still in asar
2. Try different config → rebuild → test → dylib still in asar  
3. Try another approach → rebuild → test → same result

**Pattern**: electron-builder consistently packs assets in asar despite multiple exclusion/extraction attempts.

## Build Process
```bash
cd electron
npm run build:mac:unsigned
# Runs: build pipeline → electron-builder --mac --publish never --config.mac.identity=null
# Takes: ~1-2 minutes
# Output: dist/mac-arm64/slideshow-buddy.app
```

## What Works
- ✅ Development mode: `npm run electron:start` loads dylib perfectly from `electron/assets/`
- ✅ TypeScript compilation: `app/` directory structure works
- ✅ App launches: No "Cannot find module" errors
- ✅ Swift library compiles: Creates valid universal binary (x86_64 + arm64)

## What Doesn't Work
- ❌ Packaging: dylib trapped inside asar, inaccessible to FFI
- ❌ `asarUnpack`: Doesn't create `app.asar.unpacked` directory
- ❌ `extraResources`: Doesn't copy assets to Resources/
- ❌ Exclusion patterns: Assets still end up in asar

## Environment
- macOS: Sequoia 15.0 (24.6.0)
- Node: v20.19.0
- npm: 10.8.2
- electron: 26.2.2
- electron-builder: 23.6.0
- TypeScript: 5.9.3
- Swift: 6.1.2

## Question for Review
Why does electron-builder consistently ignore `extraResources`, `asarUnpack`, and file exclusion patterns (`!assets`) when packaging the Swift dylib? The assets directory containing the native library keeps getting packed into the asar archive instead of being extracted to `Contents/Resources/assets/` as configured.

Is there a special configuration required for native libraries (.dylib files) in electron-builder that we're missing?

## Time Spent
Nearly one week of back-and-forth attempting various electron-builder configurations with no success.
