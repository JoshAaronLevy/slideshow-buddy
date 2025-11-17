# Swift Photos Library FFI Bridge

This directory contains the Foreign Function Interface (FFI) bridge that enables Electron to call native Swift code for accessing the macOS Photos library.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Electron      │    │   FFI Bridge    │    │   Swift Code    │
│   Main Process  │◄──►│   (koffi)       │◄──►│   PHPhotoLibrary│
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Components

### 1. Swift Native Code (`.swift` files)
- **`PhotosLibraryBridge.swift`** - Main bridge class with C-compatible FFI export functions
- **`PhotosPermissionManager.swift`** - Handles macOS Photos permission requests
- **`PhotoAssetConverter.swift`** - Converts PHAssets to web-compatible format

### 2. Build System
- **`../scripts/build-swift.sh`** - Compiles Swift code into `libPhotosLibraryBridge.dylib`
- **`../package.json`** - Build scripts (`npm run build:swift`)
- **`../electron-builder.config.json`** - Packaging configuration

### 3. FFI Interface (`.ts` files)
- **`types.ts`** - TypeScript type definitions for all interfaces
- **`PhotosLibraryFFI.ts`** - Main FFI wrapper with memory management

### 4. Configuration
- **`../resources/entitlements.mac.plist`** - macOS permissions for Photos access

## How It Works

### 1. Swift to C FFI Functions

The Swift code exports C-compatible functions using `@_cdecl`:

```swift
@_cdecl("photos_request_permission")
public func photos_request_permission() -> UnsafePointer<CChar> {
    // Swift implementation
    return strdup(result) // Returns C string
}
```

Swift handles the memory allocation with `strdup()` which must be freed on the JavaScript side.

### 2. TypeScript FFI Binding

The TypeScript wrapper uses `koffi` to call these functions:

```typescript
// Load the dynamic library
this.lib = koffi.load(libraryPath);

// Define function signature
const StringReturn = koffi.pointer(koffi.types.char);
const photos_request_permission = this.lib.func('photos_request_permission', StringReturn, []);

// Call function and manage memory
const stringPtr = photos_request_permission();
const result = koffi.decode(stringPtr, koffi.string);
koffi.free(stringPtr); // Critical: Free Swift-allocated memory
```

### 3. Memory Management

**Critical for preventing memory leaks:**

1. Swift allocates strings with `strdup()` 
2. TypeScript reads the string with `koffi.decode()`
3. TypeScript **must** call `koffi.free()` to release memory
4. The FFI wrapper handles this automatically

### 4. Error Handling

- Swift returns JSON with `error` field for failures
- TypeScript wrapper parses JSON and throws `PhotosLibraryError`
- Permission errors, library loading errors, and JSON parsing errors are all handled

## API Reference

### `photosLibraryFFI.requestPermission(): Promise<boolean>`
Request Photos library access permission from user.

### `photosLibraryFFI.checkPermission(): boolean`
Check current permission status (synchronous).

### `photosLibraryFFI.getAlbums(): Promise<PhotoAlbum[]>`
Get all photo albums from the library.

### `photosLibraryFFI.getPhotos(albumId?: string, quantity?: number): Promise<Photo[]>`
Get photos from specific album or all photos.

## Build Process

### Development Build
```bash
cd electron
npm run build:swift  # Compiles Swift → build/native/libPhotosLibraryBridge.dylib
npm run build:ts     # Compiles TypeScript
npm run build        # Both Swift and TypeScript
```

### Production Build
```bash
npm run electron:pack  # Creates packaged app with embedded library
```

The build process:
1. `build-swift.sh` compiles Swift source files
2. Creates `libPhotosLibraryBridge.dylib` in `build/native/`
3. Copies library to `assets/` for packaging
4. electron-builder includes library in final app bundle

## Library Loading Strategy

The FFI wrapper tries multiple paths to find the library:

1. **Development**: `build/native/libPhotosLibraryBridge.dylib`
2. **Packaged**: `app.getAppPath() + '/assets/libPhotosLibraryBridge.dylib'`
3. **Alternative**: `process.resourcesPath + '/libPhotosLibraryBridge.dylib'`

This ensures the library works in both development and packaged environments.

## Troubleshooting

### Library Not Found
```
PhotosLibraryError: Swift Photos library not found
```
**Solution**: Run `npm run build:swift` to compile the Swift library.

### Permission Denied
```
PhotosLibraryError: Permission denied
```
**Solution**: Call `requestPermission()` first and ensure `entitlements.mac.plist` is properly configured.

### Symbol Not Found
```
Error: dlsym(RTLD_DEFAULT, photos_request_permission): symbol not found
```
**Solution**: Check that Swift compilation succeeded and @_cdecl functions are properly exported.

### Memory Errors
If you see crashes or memory issues, check that:
1. All `koffi.free()` calls are made
2. No double-free operations
3. No use-after-free of string pointers

## Security Considerations

- **Entitlements**: App needs `com.apple.security.assets.photos.read-only`
- **Code Signing**: Disable library validation for native modules
- **Sandboxing**: JIT and unsigned memory execution must be allowed
- **User Consent**: Photos access requires explicit user permission

## Dependencies

- **Runtime**: macOS 11.0+ (required for async/await in Swift)
- **Build**: Xcode with Swift compiler (`swiftc`)
- **FFI**: `koffi` NPM package for Node.js FFI
- **Frameworks**: Foundation, Photos, AppKit (auto-linked by `swiftc`)