# Deployment Guide for Slideshow Buddy

This comprehensive guide covers building, signing, packaging, and distributing Slideshow Buddy for both iOS and macOS platforms.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [iOS Deployment](#ios-deployment)
- [macOS Deployment](#macos-deployment)
- [Version Management](#version-management)
- [Distribution Channels](#distribution-channels)
- [CI/CD Pipeline](#cicd-pipeline)
- [Troubleshooting Deployment Issues](#troubleshooting-deployment-issues)

## Overview

Slideshow Buddy supports deployment to multiple platforms with different requirements:

| Platform | Build System | Distribution | Code Signing | Target Audience |
|----------|-------------|--------------|--------------|-----------------|
| **iOS** | Xcode | App Store | Required | iPhone/iPad users |
| **macOS** | Electron | Direct Download, Mac App Store | Required for distribution | Mac desktop users |
| **Web** | Vite | Static hosting | Not required | Development/testing |

## Prerequisites

### System Requirements
- **macOS Sequoia 15.0+**: Required for both iOS and macOS development
- **Xcode 14+**: Latest version from Mac App Store
- **Node.js 18+**: For build scripts and dependency management
- **Apple Developer Account**: Required for code signing and distribution

### Development Tools
```bash
# Verify required tools are installed
node --version          # Should be 18.0+
npm --version           # Should be 9.0+
xcode-select --version  # Xcode Command Line Tools
```

### Apple Developer Account Setup
1. **Enroll in Apple Developer Program**: $99/year membership
2. **Download Certificates**: 
   - iOS App Development (for testing)
   - iOS Distribution (for App Store)
   - Developer ID Application (for macOS distribution)
3. **Create App IDs**: 
   - `com.slideshowbuddy.app` for both platforms
4. **Configure Provisioning Profiles**: For iOS testing and distribution

## iOS Deployment

### Development Build Process

#### 1. Prepare iOS Build
```bash
# Ensure dependencies are current
npm install
cd ios/App && pod install && cd ../../

# Build web assets and sync to iOS
npm run build
npm run cap:sync:ios
```

#### 2. Open in Xcode
```bash
# Open iOS project
npm run cap:open:ios
```

#### 3. Configure Signing in Xcode
1. Select **App** target in project navigator
2. Go to **Signing & Capabilities** tab
3. **Team**: Select your Apple Developer team
4. **Bundle Identifier**: Ensure `com.slideshowbuddy.app` matches your App ID
5. **Automatically manage signing**: Enable for development

### App Store Distribution

#### 1. Archive for Distribution
1. In Xcode, select **Any iOS Device** as target
2. **Product > Archive** to create distribution archive
3. **Window > Organizer** to manage archives

#### 2. App Store Connect Preparation
1. **Create App Listing**: 
   - Go to [App Store Connect](https://appstoreconnect.apple.com)
   - Create new app with bundle ID `com.slideshowbuddy.app`
2. **Required Assets**:
   - App icon (1024×1024px)
   - Screenshots for various device sizes
   - App description and keywords
   - Privacy policy URL (required for Spotify integration)

#### 3. Upload to App Store
1. In **Organizer**, select your archive
2. Click **Distribute App**
3. Choose **App Store Connect**
4. Follow upload wizard
5. Submit for review in App Store Connect

### iOS Configuration Files

#### [`ios/App/App/Info.plist`](../ios/App/App/Info.plist) - Key Settings
```xml
<!-- Required permissions -->
<key>NSPhotoLibraryUsageDescription</key>
<string>Access your photo library to create beautiful slideshows</string>

<!-- Spotify OAuth URL scheme -->
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>com.slideshowbuddy.auth</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.slideshowbuddy</string>
    </array>
  </dict>
</array>
```

## macOS Deployment

### Development Build Process

#### 1. Build Swift Native Modules
```bash
cd electron
npm run build:swift
```

#### 2. Build Application
```bash
# Build TypeScript and create app bundle
npm run build:ts

# Package unsigned app for local testing
npm run electron:pack
```

### Production Build Process

#### 1. Code Signing Setup
For distribution outside Mac App Store, you need **Developer ID Application** certificate.

**Environment Variables** (recommended for automation):
```bash
export CSC_NAME="Developer ID Application: Your Name (TEAM_ID)"
export APPLE_ID="your-apple-id@email.com"
export APPLE_ID_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="ABCD123456"
```

**Manual Certificate Configuration** in [`electron/electron-builder.config.json`](../electron/electron-builder.config.json):
```json
{
  "mac": {
    "identity": "Developer ID Application: Your Name (TEAM_ID)",
    "hardenedRuntime": true,
    "notarize": {
      "teamId": "ABCD123456"
    }
  }
}
```

#### 2. Build Signed DMG
```bash
# Build signed DMG for distribution
npm run build:mac

# Alternative: Build without automatic signing
npm run build:mac:unsigned
```

#### 3. Notarization Process
Apple requires notarization for macOS 10.15+ distribution:

**Automatic Notarization** (configured in electron-builder):
- Happens automatically during `npm run build:mac`
- Requires valid Apple ID credentials
- Takes 5-10 minutes for Apple to process

**Manual Notarization** (if automatic fails):
```bash
# Upload DMG to Apple for notarization
xcrun notarytool submit "dist/Slideshow Buddy-1.0.0.dmg" \
  --apple-id "your@email.com" \
  --password "app-specific-password" \
  --team-id "TEAM_ID" \
  --wait

# Staple notarization to DMG
xcrun stapler staple "dist/Slideshow Buddy-1.0.0.dmg"

# Verify notarization
xcrun stapler validate "dist/Slideshow Buddy-1.0.0.dmg"
```

### macOS Build Configuration

#### [`electron/electron-builder.config.json`](../electron/electron-builder.config.json)
```json
{
  "appId": "com.slideshowbuddy.app",
  "productName": "Slideshow Buddy",
  "directories": {
    "output": "dist",
    "buildResources": "assets"
  },
  "files": [
    "build/**/*",
    "assets/**/*"
  ],
  "mac": {
    "category": "public.app-category.photography",
    "target": [
      {
        "target": "dmg",
        "arch": ["x64", "arm64"]
      }
    ],
    "icon": "assets/appIcon.icns",
    "hardenedRuntime": true,
    "entitlements": "resources/entitlements.mac.plist",
    "notarize": {
      "teamId": "APPLE_TEAM_ID"
    }
  },
  "dmg": {
    "title": "Install Slideshow Buddy",
    "window": {
      "width": 540,
      "height": 380
    }
  }
}
```

#### [`electron/resources/entitlements.mac.plist`](../electron/resources/entitlements.mac.plist)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <!-- Required for hardened runtime -->
  <key>com.apple.security.hardened-runtime</key>
  <true/>
  
  <!-- Required for Photos library access -->
  <key>com.apple.security.photos-library</key>
  <true/>
  
  <!-- Required for network access (Spotify) -->
  <key>com.apple.security.network.client</key>
  <true/>
  
  <!-- Required for temporary file access -->
  <key>com.apple.security.temporary-exception.files.absolute-path.read-write</key>
  <array>
    <string>/tmp</string>
  </array>
</dict>
</plist>
```

### Build Output

After successful build, you'll find:
- **DMG Installer**: `electron/dist/Slideshow Buddy-1.0.0.dmg`
- **App Bundle**: `electron/dist/mac/Slideshow Buddy.app`
- **Build Logs**: Console output with signing and notarization status

## Version Management

### Semantic Versioning

Slideshow Buddy follows [Semantic Versioning](https://semver.org/):
- **MAJOR.MINOR.PATCH** (e.g., 1.2.3)
- **MAJOR**: Breaking changes or major new features
- **MINOR**: New features, backward compatible
- **PATCH**: Bug fixes, backward compatible

### Version Update Process

#### 1. Update Version Numbers
```bash
# Update package.json version
npm version patch  # or minor, major

# This automatically updates:
# - package.json
# - package-lock.json
# - Creates git tag
```

#### 2. Sync Platform Versions

**iOS Version Update** in [`ios/App/App/Info.plist`](../ios/App/App/Info.plist):
```xml
<key>CFBundleShortVersionString</key>
<string>1.0.0</string>
<key>CFBundleVersion</key>
<string>1</string>
```

**macOS Version Update** in [`electron/package.json`](../electron/package.json):
```json
{
  "version": "1.0.0"
}
```

#### 3. Update Changelog
Maintain [`CHANGELOG.md`](../CHANGELOG.md) with:
- Version number and release date
- New features, improvements, and bug fixes
- Breaking changes and migration notes

### Version Management Script
```bash
#!/bin/bash
# scripts/update-version.sh

VERSION=$1
if [ -z "$VERSION" ]; then
  echo "Usage: ./update-version.sh <version>"
  exit 1
fi

# Update package.json
npm version $VERSION --no-git-tag-version

# Update iOS Info.plist
plutil -replace CFBundleShortVersionString -string $VERSION ios/App/App/Info.plist

# Update Electron package.json  
cd electron && npm version $VERSION --no-git-tag-version && cd ..

# Update capacitor.config.ts if needed
# (version can be referenced from package.json)

echo "Version updated to $VERSION"
echo "Don't forget to:"
echo "  1. Update CHANGELOG.md"
echo "  2. Commit changes"
echo "  3. Create git tag: git tag v$VERSION"
```

## Distribution Channels

### iOS Distribution

#### App Store (Primary)
- **Audience**: All iOS users
- **Review Time**: 24-48 hours
- **Requirements**: App Store guidelines compliance
- **Revenue**: Apple takes 30% cut (15% for small businesses)

#### TestFlight (Beta Testing)
- **Audience**: Up to 10,000 external testers
- **Distribution**: App Store Connect > TestFlight
- **Review**: Minimal for beta builds
- **Duration**: 90-day build expiration

### macOS Distribution

#### Direct Download (Primary)
- **Audience**: Mac users via website/GitHub releases
- **Requirements**: Notarized DMG for modern macOS
- **Advantages**: Full control over distribution
- **Considerations**: Users must trust developer

#### Mac App Store (Future Option)
- **Audience**: Mac App Store users
- **Requirements**: Different entitlements, sandbox compliance
- **Review Process**: Similar to iOS App Store
- **Considerations**: More restrictive than direct distribution

### Release Distribution Workflow

#### 1. Pre-Release Checks
```bash
# Run comprehensive tests
npm run lint
npm run build

# Test both platforms
npm run ios:dev    # Test in iOS simulator
npm run electron:dev # Test macOS app

# Verify all features work
# - Photo import and slideshow creation
# - Spotify authentication and playback
# - Cross-platform functionality
```

#### 2. Create Release Builds

**iOS Release:**
```bash
# Build and archive
npm run ios:sync
# Archive in Xcode
# Upload to App Store Connect
```

**macOS Release:**
```bash
# Build signed DMG
npm run build:mac
# Verify notarization
xcrun stapler validate "dist/Slideshow Buddy-1.0.0.dmg"
```

#### 3. Upload to Distribution Channels

**GitHub Releases** (for macOS):
```bash
# Create GitHub release with DMG attachment
gh release create v1.0.0 \
  --title "Slideshow Buddy v1.0.0" \
  --notes-file CHANGELOG.md \
  "dist/Slideshow Buddy-1.0.0.dmg"
```

## CI/CD Pipeline

### GitHub Actions Workflow

#### `.github/workflows/build-and-deploy.yml`
```yaml
name: Build and Deploy

on:
  push:
    tags:
      - 'v*'

jobs:
  build-ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build web assets
        run: npm run build
        
      - name: Sync iOS
        run: npm run cap:sync:ios
        
      # Additional steps for iOS archive and upload
      # Requires stored certificates and provisioning profiles

  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: |
          npm ci
          cd electron && npm ci
          
      - name: Build Swift modules
        run: cd electron && npm run build:swift
        
      - name: Build and sign macOS app
        env:
          CSC_NAME: ${{ secrets.CSC_NAME }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_ID_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        run: npm run build:mac
        
      - name: Upload DMG to release
        uses: actions/upload-release-asset@v1
        with:
          asset_path: electron/dist/Slideshow Buddy-*.dmg
          asset_name: Slideshow-Buddy-macOS.dmg
          asset_content_type: application/x-apple-diskimage
```

### Required Secrets for CI/CD

Store these secrets in GitHub repository settings:

```bash
# macOS Code Signing
CSC_NAME="Developer ID Application: Your Name (TEAM_ID)"
APPLE_ID="your-apple-id@email.com"
APPLE_ID_PASSWORD="app-specific-password"
APPLE_TEAM_ID="ABCD123456"

# Optional: Base64 encoded certificate for CI
CSC_LINK="base64-encoded-developer-id-certificate"
CSC_KEY_PASSWORD="certificate-password"

# Environment variables
VITE_SPOTIFY_CLIENT_ID="spotify-client-id"
VITE_SPOTIFY_BACKEND_URL="https://slideshow-buddy-server.onrender.com"
```

## Troubleshooting Deployment Issues

### Common iOS Issues

#### Code Signing Errors
**Symptoms**: "No provisioning profiles found" or signing errors
**Solutions**:
1. **Refresh Profiles**: Xcode > Preferences > Accounts > Download Manual Profiles
2. **Bundle ID Match**: Ensure `com.slideshowbuddy.app` matches Apple Developer portal
3. **Team Selection**: Select correct development team in Xcode signing settings

#### App Store Rejection
**Common Reasons**:
- Missing privacy policy for Spotify integration
- App icon doesn't meet guidelines
- Insufficient screenshot variants
- Missing required device compatibility

### Common macOS Issues

#### Notarization Failures
**Symptoms**: "Could not notarize app" during build
**Solutions**:
1. **Check Credentials**: Verify APPLE_ID and app-specific password
2. **Hardened Runtime**: Ensure `hardenedRuntime: true` in build config
3. **Entitlements**: Check that required entitlements are present
4. **Manual Notarization**: Use `xcrun notarytool` for detailed error messages

#### DMG Won't Open on User Machines
**Symptoms**: "App is damaged" or security warnings
**Solutions**:
1. **Verify Notarization**: `xcrun stapler validate path/to/app.dmg`
2. **Check Code Signature**: `codesign -vvv --deep --strict path/to/app`
3. **Gatekeeper Test**: `sudo spctl --assess --verbose path/to/app`

#### Build Fails with Swift Errors
**Symptoms**: Swift compilation errors during `build:swift`
**Solutions**:
1. **Xcode Command Line Tools**: `xcode-select --install`
2. **Clean Build**: `rm -rf electron/build && npm run build:swift`
3. **Swift Version**: Ensure compatible Swift version with Xcode

### General Build Issues

#### Node.js/npm Version Conflicts
```bash
# Use Node Version Manager for consistent versions
nvm install 18
nvm use 18
npm ci  # Clean install
```

#### Capacitor Sync Issues
```bash
# Reset platforms and reinstall
npx cap remove ios
npx cap remove electron
npx cap add ios
npx cap add @capacitor-community/electron
npm run cap:sync
```

#### Environment Variable Issues
```bash
# Verify environment variables are set
echo $VITE_SPOTIFY_CLIENT_ID
echo $CSC_NAME

# Check .env file exists and is properly formatted
cat .env
```

### Build Verification Commands

#### Verify macOS App Signing
```bash
# Check code signature
codesign -dvvv "dist/mac/Slideshow Buddy.app"

# Verify entitlements
codesign -d --entitlements :- "dist/mac/Slideshow Buddy.app"

# Test Gatekeeper approval
sudo spctl --assess --verbose "dist/mac/Slideshow Buddy.app"
```

#### Verify iOS Build
```bash
# Check bundle identifier and version
plutil -p ios/App/App/Info.plist | grep -E "(CFBundle|Version)"

# Verify Capacitor sync
npx cap doctor ios
```

---

**Last Updated**: November 2024  
**Deployment Pipeline Version**: v1.0  
**Supports**: iOS 13+ and macOS Sequoia 15.0+