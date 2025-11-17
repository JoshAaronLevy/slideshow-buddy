# macOS User Guide for Slideshow Buddy

Welcome to Slideshow Buddy for macOS! This guide will help you get started with creating beautiful photo slideshows with synchronized music on your Mac.

## Table of Contents

- [Installation](#installation)
- [First-Time Setup](#first-time-setup)
- [Getting Started](#getting-started)
- [Creating Your First Slideshow](#creating-your-first-slideshow)
- [Using Spotify Integration](#using-spotify-integration)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [macOS-Specific Features](#macos-specific-features)
- [Troubleshooting](#troubleshooting)
- [Privacy & Permissions](#privacy--permissions)

## Installation

### System Requirements
- **macOS**: Sequoia 15.0 or later
- **Spotify Premium**: Required for music playback
- **Internet Connection**: Required for Spotify integration
- **Photos App**: Access to your macOS Photos library

### Download & Install
1. Download the latest `Slideshow Buddy.dmg` file from the official website
2. Double-click the `.dmg` file to mount the disk image
3. Drag **Slideshow Buddy** to your **Applications** folder
4. Eject the disk image when installation is complete

### First Launch
1. Open **Slideshow Buddy** from your Applications folder
2. If you see a security warning, right-click the app and select **Open**
3. Click **Open** in the security dialog to confirm you want to run the app
4. The app will request permissions for Photos access (see [Permissions](#privacy--permissions))

## First-Time Setup

### Photos Library Permissions
On first launch, Slideshow Buddy will request access to your Photos library:

1. **Permission Dialog**: Click **OK** when prompted to grant photo library access
2. **System Preferences**: If needed, go to **System Preferences > Security & Privacy > Privacy > Photos**
3. **Enable Access**: Ensure **Slideshow Buddy** is checked to allow photo access

### Spotify Authentication
To use music with your slideshows:

1. Click **Settings** (gear icon) in the sidebar
2. In the **Music** section, click **Connect with Spotify**
3. Your browser will open to Spotify's login page
4. Sign in with your **Spotify Premium** account
5. Click **Agree** to authorize Slideshow Buddy
6. Return to the app - you should see "Connected" status

## Getting Started

### Main Interface
When you open Slideshow Buddy, you'll see:

- **Sidebar Navigation**: Browse between Slideshows, Library, and Settings
- **Main Content Area**: View your slideshows and photos
- **Add Button**: Create new slideshows (+ icon)

### Importing Photos
1. Go to the **Library** tab in the sidebar
2. Click **Import Photos** button
3. Browse your Photos app albums:
   - **All Photos**: Your entire photo collection
   - **Albums**: Organized photo collections
   - **Favorites**: Photos you've marked as favorites
4. Select photos you want to use (supports multiple selection)
5. Click **Import** to add them to your library

## Creating Your First Slideshow

### Basic Slideshow Creation
1. Click the **+ (Add)** button in the main interface
2. **Name Your Slideshow**: Enter a descriptive name
3. **Select Photos**: Choose from your imported photo library
   - Click photos to select them
   - Use **Cmd+Click** to select multiple photos
   - Selected photos show a checkmark
4. **Choose Music** (optional):
   - **Spotify Playlists**: Browse your connected Spotify playlists
   - **Individual Tracks**: Search for specific songs
   - **No Music**: Create a silent slideshow
5. **Configure Settings**:
   - **Transition Speed**: How long each photo displays (3-10 seconds)
   - **Shuffle Photos**: Randomize photo order
   - **Loop Slideshow**: Repeat when finished
6. Click **Create Slideshow** to save

### Playing Your Slideshow
1. Find your slideshow on the main **Slideshows** tab
2. Click the **Play** button (▷ icon)
3. The slideshow opens in fullscreen mode
4. Use controls or keyboard shortcuts to navigate

## Using Spotify Integration

### Connecting Your Account
Your Spotify Premium account enables rich music integration:

1. **Initial Setup**: Follow the authentication steps in [First-Time Setup](#spotify-authentication)
2. **Automatic Sync**: Your playlists sync automatically
3. **Browse Music**: Access your playlists when creating slideshows

### Music Selection Options
- **Your Playlists**: Choose from your personal Spotify playlists
- **Liked Songs**: Use your liked songs collection
- **Search Tracks**: Find specific songs by name or artist
- **Album Playback**: Play entire albums during slideshows

### Music Playback Features
- **Background Playback**: Music continues when app is minimized
- **Volume Control**: Adjust volume within the app
- **Track Information**: See current song and artist
- **Spotify Connect**: Control playback from other Spotify devices

## Keyboard Shortcuts

### During Slideshow Playback
- **Spacebar**: Play/Pause slideshow
- **→ (Right Arrow)**: Next photo
- **← (Left Arrow)**: Previous photo
- **Escape**: Exit fullscreen and return to app
- **↑ (Up Arrow)**: Increase volume
- **↓ (Down Arrow)**: Decrease volume
- **F**: Toggle fullscreen mode
- **M**: Mute/unmute audio

### General App Navigation
- **Cmd+N**: Create new slideshow
- **Cmd+O**: Open slideshow settings
- **Cmd+,**: Open app preferences
- **Cmd+Q**: Quit application
- **Cmd+M**: Minimize window
- **Cmd+W**: Close current window/modal

### Photo Selection
- **Cmd+Click**: Select multiple photos
- **Shift+Click**: Select range of photos
- **Cmd+A**: Select all photos
- **Delete**: Remove selected photos from slideshow

## macOS-Specific Features

### Native Photos Integration
- **Albums Access**: Browse all your Photos app albums
- **Smart Albums**: Access Recently Added, Favorites, etc.
- **iCloud Photos**: Automatically syncs with your iCloud photo library
- **Metadata Preservation**: Maintains photo dates and locations

### Desktop Experience
- **Multiple Windows**: Open multiple slideshow windows
- **Menu Bar Integration**: Access features from the macOS menu bar
- **Dock Integration**: App icon shows in dock with bounce notifications
- **Drag & Drop**: Drag photos or music files into the app
- **Context Menus**: Right-click for additional options

### System Integration
- **Notifications**: Get notified when slideshows complete
- **System Theme**: Automatically matches macOS light/dark mode
- **Retina Display**: Optimized for high-resolution displays
- **Touch Bar**: Control slideshow playback on supported MacBooks

### Window Management
- **Fullscreen Mode**: Native macOS fullscreen experience
- **Split View**: Use alongside other apps
- **Mission Control**: Appears in Mission Control and Exposé
- **Spaces**: Works with multiple desktop spaces

## Privacy & Permissions

### Required Permissions
Slideshow Buddy requests these permissions to function:

#### Photos Library Access
- **Purpose**: Import photos from your Photos app
- **Scope**: Read-only access to your photo library
- **Data**: No photos are stored permanently; only references are kept

#### Network Access
- **Purpose**: Connect to Spotify for music streaming
- **Scope**: HTTPS connections to Spotify's servers only
- **Data**: Authentication tokens stored securely in macOS Keychain

### Data Storage
- **Local Storage**: App preferences and slideshow configurations
- **Keychain**: Spotify authentication tokens (encrypted)
- **No Cloud Sync**: All data stays on your Mac unless you explicitly export

### Privacy Protection
- **No Analytics**: App doesn't collect usage data or analytics
- **No Advertising**: No ads or third-party tracking
- **Spotify Only**: Music integration limited to Spotify API
- **Photo Privacy**: Photos never leave your device except for display

## Troubleshooting

### Common Issues

#### App Won't Launch
**Symptoms**: Double-clicking does nothing or shows error
**Solutions**:
1. Check macOS version (requires Sequoia 15.0+)
2. Right-click app and select **Open** 
3. Go to **System Preferences > Security & Privacy** and allow the app
4. Download fresh copy if file appears corrupted

#### Photos Won't Import
**Symptoms**: Empty photo library or import fails
**Solutions**:
1. **Check Permissions**:
   - System Preferences > Security & Privacy > Privacy > Photos
   - Ensure Slideshow Buddy is enabled
2. **Photos App**: Open Photos app first to ensure library loads
3. **Restart App**: Quit and reopen Slideshow Buddy
4. **iCloud Photos**: Wait for photos to sync if using iCloud

#### Spotify Connection Issues
**Symptoms**: Can't connect or login fails
**Solutions**:
1. **Check Account**: Ensure you have Spotify Premium (required)
2. **Browser Issues**: Try different browser for login
3. **Clear Data**:
   - Quit app completely
   - Go to Settings and disconnect Spotify
   - Reconnect with fresh authentication
4. **Network**: Check internet connection and firewall settings

#### Slideshow Playback Problems
**Symptoms**: Photos don't advance or music doesn't play
**Solutions**:
1. **Performance**:
   - Close other resource-intensive apps
   - Restart Slideshow Buddy
2. **Memory**: Large photo libraries may need more RAM
3. **Music Playback**:
   - Verify Spotify Premium account is active
   - Check internet connection
   - Try playing music in Spotify app first

#### Quality Issues
**Symptoms**: Blurry photos or poor performance
**Solutions**:
1. **Display**: Ensure using recommended resolution
2. **Photo Quality**: Use high-resolution originals
3. **Performance**: Reduce slideshow speed if transitions lag
4. **Memory**: Close other apps to free up RAM

### Performance Tips
- **Photo Library Size**: Large libraries (>10,000 photos) may load slowly initially
- **Internet Connection**: Stable connection required for Spotify streaming
- **System Resources**: Close unnecessary apps during slideshow creation
- **Display**: Use native resolution for best quality

### Getting Help
If you continue experiencing issues:

1. **Check System Requirements**: Ensure your Mac meets minimum requirements
2. **Update macOS**: Install latest macOS updates
3. **Restart**: Try restarting your Mac
4. **Reinstall**: Download and reinstall the app
5. **Contact Support**: Reach out with specific error messages

## Tips for Best Experience

### Photo Organization
- **Organize Albums**: Create themed albums in Photos app first
- **Use Favorites**: Mark best photos as favorites for easy access
- **Clean Library**: Remove duplicates and unwanted photos
- **High Resolution**: Use original quality photos for best results

### Music Selection
- **Curated Playlists**: Create specific playlists for different slideshow themes
- **Appropriate Length**: Match playlist duration to slideshow length
- **Volume Levels**: Ensure consistent volume across tracks
- **Explicit Content**: Consider audience when selecting music

### Slideshow Creation
- **Photo Count**: 20-50 photos work well for most slideshows
- **Timing**: 4-6 seconds per photo is often ideal
- **Flow**: Order photos to tell a story or show progression
- **Testing**: Preview slideshows before important presentations

### Performance Optimization
- **Regular Cleanup**: Remove unused slideshows and photos
- **System Maintenance**: Keep macOS updated
- **Storage Space**: Ensure adequate free disk space
- **Network**: Use reliable internet connection for Spotify

---

**Last Updated**: November 2024  
**App Version**: Compatible with Slideshow Buddy v0.4.3+  
**macOS Support**: Sequoia 15.0+