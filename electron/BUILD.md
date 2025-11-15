# Slideshow Buddy - macOS Build Guide

This guide covers building, code signing, and distributing Slideshow Buddy for macOS.

## Prerequisites

### Required Software
- **Node.js** (v16 or later)
- **Xcode** (latest version from Mac App Store)
- **Xcode Command Line Tools**: `xcode-select --install`

### Apple Developer Account
- **Apple Developer Program** membership ($99/year) required for:
  - Code signing certificates
  - App notarization
  - Distribution outside Mac App Store

## Build Commands

### Development Builds (Unsigned)
```bash
# Build for development (unsigned, local testing only)
npm run build:mac:unsigned

# Alternative: Build with identity set to null
npm run build:mac -- --config.mac.identity=null
```

### Production Builds
```bash
# Build signed DMG (requires code signing setup)
npm run build:mac

# Build and distribute (signed)
npm run dist:mac

# Notarize after building (requires credentials)
npm run notarize
```

## Code Signing Setup

### 1. Certificate Requirements
You need these certificates from Apple Developer Portal:

- **Developer ID Application Certificate**
  - Used for signing the app for distribution outside Mac App Store
  - Format: "Developer ID Application: Your Name (TEAM_ID)"

- **Developer ID Installer Certificate** (optional)
  - Used for signing installer packages

### 2. Obtaining Certificates

#### Via Xcode (Recommended)
1. Open Xcode
2. Go to **Xcode > Preferences > Accounts**
3. Add your Apple Developer account
4. Select your account → **Manage Certificates**
5. Click **+** → **Developer ID Application**

#### Via Developer Portal
1. Go to [Apple Developer Portal](https://developer.apple.com)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Create a **Developer ID Application** certificate
4. Download and install in Keychain Access

### 3. Configuration

#### Option A: Automatic (Recommended)
Set environment variables for electron-builder to find certificates automatically:

```bash
# Certificate identity (find in Keychain Access)
export CSC_NAME="Developer ID Application: Your Name (TEAM_ID)"

# For CI/CD: Base64 encoded certificate
export CSC_LINK="/path/to/certificate.p12"
export CSC_KEY_PASSWORD="certificate_password"
```

#### Option B: Manual Configuration
Update [`electron-builder.config.json`](./electron-builder.config.json):

```json
{
  "mac": {
    "identity": "Developer ID Application: Your Name (TEAM_ID)"
  }
}
```

## App Notarization

### What is Notarization?
- Required for macOS 10.15+ distribution
- Apple scans your app for malicious content
- Prevents "App is damaged" warnings

### Setup Notarization

#### 1. App-Specific Password
1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign in → **App-Specific Passwords**
3. Generate password for "electron-builder"

#### 2. Environment Variables
```bash
# Apple ID credentials for notarization
export APPLE_ID="your-apple-id@email.com"
export APPLE_ID_PASSWORD="app-specific-password"

# Team ID (find in Apple Developer Portal)
export APPLE_TEAM_ID="ABCD123456"
```

#### 3. Enable Notarization
Uncomment in [`electron-builder.config.json`](./electron-builder.config.json):

```json
{
  "mac": {
    "notarize": {
      "teamId": "ABCD123456"
    }
  }
}
```

### Manual Notarization (Fallback)
If automatic notarization fails:

```bash
# Upload to Apple for notarization
xcrun notarytool submit "Slideshow Buddy-1.0.0.dmg" \
  --apple-id "your@email.com" \
  --password "app-specific-password" \
  --team-id "TEAM_ID" \
  --wait

# Staple notarization to DMG
xcrun stapler staple "Slideshow Buddy-1.0.0.dmg"
```

## Build Assets

### Required Icons
- **appIcon.icns**: App icon for macOS
  - Generate from 1024×1024 PNG using Icon Composer or online tools
  - Place in: `assets/appIcon.icns`

### Optional DMG Assets
- **dmg-background.png**: Custom DMG installer background (540×380px)
  - Place in: `assets/dmg-background.png`
  - Will fallback to default if not provided

## Environment Setup

### Development Environment
```bash
# Create .env file in electron/ directory
cat > .env << EOF
# Development settings
CSC_IDENTITY_AUTO_DISCOVERY=false
EOF
```

### CI/CD Environment
```bash
# Required for automated builds
CSC_LINK=base64_encoded_certificate_or_path
CSC_KEY_PASSWORD=certificate_password
APPLE_ID=your_apple_id
APPLE_ID_PASSWORD=app_specific_password
APPLE_TEAM_ID=your_team_id
```

## Build Process

### Full Build Workflow
```bash
# 1. Install dependencies
npm install

# 2. Build Swift native modules
npm run build:swift

# 3. Build TypeScript
npm run build:ts

# 4. Create signed DMG
npm run build:mac
```

### Build Output
- **DMG Location**: `dist/Slideshow Buddy-1.0.0.dmg`
- **App Location**: `dist/mac/Slideshow Buddy.app`

## Troubleshooting

### Common Issues

#### "No identity found" Error
```bash
# Check available certificates
security find-identity -v -p codesigning

# Solution: Install Developer ID Application certificate
```

#### "App is damaged" Message
- **Cause**: App not notarized or signature invalid
- **Solution**: Ensure proper code signing and notarization

#### Keychain Access Issues
```bash
# Unlock keychain if needed
security unlock-keychain ~/Library/Keychains/login.keychain
```

#### Build Fails with "Team ID not found"
1. Check Apple Developer Portal for your Team ID
2. Ensure you're signed in to Xcode with correct account
3. Verify team membership is active

### Verification Commands

#### Check Code Signature
```bash
# Verify app signature
codesign -vvv --deep --strict "/path/to/Slideshow Buddy.app"

# Check certificate details
codesign -dvvv "/path/to/Slideshow Buddy.app"
```

#### Check Notarization
```bash
# Check if app is notarized
xcrun stapler validate "/path/to/Slideshow Buddy.app"

# Check DMG notarization
xcrun stapler validate "Slideshow Buddy-1.0.0.dmg"
```

#### Test Gatekeeper
```bash
# Simulate Gatekeeper check
sudo spctl --assess --verbose "/path/to/Slideshow Buddy.app"
```

## Distribution Workflow

### For Beta Testing
1. Build unsigned version: `npm run build:mac:unsigned`
2. Distribute to known testers via direct download
3. Users must right-click → Open to bypass Gatekeeper

### For Public Release
1. Ensure code signing certificates are valid
2. Build signed version: `npm run build:mac`
3. Verify notarization completed successfully
4. Test DMG on clean macOS system
5. Upload to website or distribution platform

### App Store Distribution (Future)
- Requires different certificates (Mac App Store)
- Additional entitlements may be needed
- Review process typically 24-48 hours

## Security Notes

### Certificate Security
- **Never commit certificates** to version control
- Use environment variables for CI/CD
- Rotate certificates before expiration
- Keep private keys secure

### Entitlements
Current entitlements in `resources/entitlements.mac.plist`:
- **Hardened Runtime**: Enhanced security
- **Photo Library Access**: Required for slideshow creation
- **Network Access**: For Spotify integration

### Privacy
App requests permission for:
- **Photo Library**: "Access your photo library to create beautiful slideshows"
- **Microphone**: Currently not used

## Resources

- [Apple Developer Documentation](https://developer.apple.com/documentation/)
- [electron-builder Code Signing Guide](https://www.electron.build/code-signing)
- [Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [macOS Gatekeeper](https://developer.apple.com/documentation/security/gatekeeper)

## Support

For build issues:
1. Check this documentation first
2. Verify all prerequisites are installed
3. Check Apple Developer Portal for account status
4. Review build logs for specific error messages

---

**Last Updated**: November 2024  
**Electron Version**: 26.2.2  
**electron-builder Version**: 23.6.0