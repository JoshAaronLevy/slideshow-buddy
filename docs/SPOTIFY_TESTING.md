# Spotify Integration Testing Guide

> **Important**: This guide is for Stage 4 testing - verifying that the Spotify SDK implementation is ready for Electron. Stage 5 will handle OAuth setup.

## Prerequisites

Before testing, ensure you have:

### Required Accounts & Setup
- **Spotify Premium Account**: Web Playback SDK requires Spotify Premium
- **Spotify App Registration**: OAuth app configured (will be set up in Stage 5)
- **Development Environment**: Electron app built and ready to run

### Environment Setup Verification
- [ ] CSP configured in [`electron/src/setup.ts`](../electron/src/setup.ts) to allow Spotify domains
- [ ] MusicPlayerService implementation in place
- [ ] TokenManager integration completed

## CSP Configuration Verification

The Content Security Policy in Electron must allow Spotify domains. Verify these directives are present in [`electron/src/setup.ts`](../electron/src/setup.ts:220-255):

```javascript
// Required CSP directives for Spotify SDK
script-src: 'https://sdk.scdn.co'        // Spotify Web Playback SDK
connect-src: 'https://api.spotify.com'   // Spotify API
connect-src: 'https://accounts.spotify.com' // Spotify Auth
media-src: 'https: data:'                // Audio playback
```

**What this allows:**
- Loading Spotify Web Playback SDK from `https://sdk.scdn.co/spotify-player.js`
- API requests to Spotify's REST API
- Audio streaming from Spotify CDN
- Authentication with Spotify OAuth

## Testing Phases

### Phase 1: SDK Loading Test

**Objective**: Verify Spotify SDK loads without CSP violations

#### Test Steps:
1. **Launch Electron App**:
   ```bash
   npm run electron:dev
   # or
   npm run electron:build
   ```

2. **Open Developer Tools**: 
   - Press `Cmd+Option+I` (macOS) or `Ctrl+Shift+I` (Windows/Linux)

3. **Check Console for Errors**:
   - Look for CSP violation errors
   - Look for network errors loading Spotify SDK

#### Success Indicators:
- [ ] No CSP violation messages in console
- [ ] No 404 or network errors for `https://sdk.scdn.co/spotify-player.js`
- [ ] `window.Spotify` object available after SDK loads

#### Potential Issues:
- **CSP Violation**: Update CSP in `electron/src/setup.ts`
- **Network Error**: Check internet connection
- **Timeout**: SDK load may take time on slower connections

### Phase 2: MusicPlayerService Compilation

**Objective**: Verify MusicPlayerService compiles without errors

#### Test Steps:
1. **Check TypeScript Compilation**:
   ```bash
   npm run build
   ```

2. **Review Output**: Focus on MusicPlayerService-related errors only

#### Success Indicators:
- [ ] No TypeScript errors in `src/services/MusicPlayerService.ts`
- [ ] No TypeScript errors in Spotify-related imports
- [ ] Build completes successfully (PhotoService errors are unrelated)

#### Expected Results:
- **✓ Should compile**: MusicPlayerService uses standard Web APIs
- **⚠️ May have errors**: PhotoService (unrelated to Spotify integration)

### Phase 3: Player Initialization Test

**Objective**: Verify player can initialize without authentication errors

> **Note**: This test will fail with authentication errors until Stage 5 OAuth setup is complete. We're testing the initialization flow, not successful auth.

#### Test Steps:
1. **Add Test Button** (temporary):
   ```typescript
   // Add to any component for testing
   const testSpotifyInit = async () => {
     try {
       await loadSpotifySDK();
       console.log('SDK loaded successfully');
       await initializePlayer();
     } catch (error) {
       console.error('Init error:', error);
     }
   };
   ```

2. **Click Test Button**

3. **Monitor Console Output**

#### Success Indicators:
- [ ] `[MusicPlayer:Init] init_start` log appears
- [ ] SDK loads without errors
- [ ] Player initialization begins
- [ ] Expected authentication error (until Stage 5)

#### Expected Errors (Normal):
- `Authentication error: No token available` - Expected until Stage 5
- `getOAuthToken callback failed` - Expected until Stage 5

#### Failure Indicators (Problems):
- CSP violations during SDK load
- JavaScript errors in initialization code
- TypeScript compilation preventing execution

### Phase 4: Device Detection Test

**Objective**: Verify device appears in Spotify Connect (requires authentication)

> **Note**: This test can only be completed after Stage 5 OAuth implementation

#### Test Steps:
1. **Complete OAuth Setup** (Stage 5)
2. **Initialize Player Successfully**
3. **Check Spotify Connect Device List**:
   - Open Spotify app on phone/computer
   - Go to Connect to a device
   - Look for "Slideshow Buddy" device

#### Success Indicators:
- [ ] "Slideshow Buddy" appears in device list
- [ ] Device shows as available
- [ ] Can transfer playback to device

## Runtime Testing Checklist

### Core Functionality Tests

Once authentication is working (Stage 5), verify:

#### SDK Integration:
- [ ] **SDK Loading**: `loadSpotifySDK()` succeeds without CSP violations
- [ ] **Player Creation**: `initializePlayer()` creates player instance
- [ ] **Device Registration**: Device appears as "Slideshow Buddy" in Spotify Connect
- [ ] **Callback Setup**: All player event listeners attached correctly

#### Playback Controls:
- [ ] **Start Playback**: `startPlayback()` begins track/playlist
- [ ] **Pause/Resume**: `pausePlayback()` / `resumePlayback()` work
- [ ] **Volume Control**: `setVolume()` / `getVolume()` function correctly
- [ ] **Track Navigation**: `nextTrack()` / `previousTrack()` work
- [ ] **State Updates**: `getCurrentState()` returns current playback info

#### Error Handling:
- [ ] **Auth Errors**: Handled gracefully with user feedback
- [ ] **Network Errors**: Retry logic works for temporary failures
- [ ] **Premium Required**: Clear message when non-premium account used
- [ ] **Token Refresh**: Automatic renewal when tokens expire

#### Integration Points:
- [ ] **TokenManager**: Gets valid tokens for API calls
- [ ] **Slideshow Integration**: Music plays during photo slideshow
- [ ] **State Management**: Playback state updated in app UI
- [ ] **Cleanup**: `cleanup()` properly disconnects when slideshow ends

## Expected Console Output

### Successful Initialization:
```
[MusicPlayer:Init] {"timestamp":1699123456,"action":"init_start",...}
[MusicPlayer:DeviceReady] {"timestamp":1699123457,"deviceId":"abc123",...}
[MusicPlayer:Init] {"timestamp":1699123458,"action":"init_success",...}
```

### Successful Playback:
```
[MusicPlayer:DeviceTransfer] {"action":"transfer_start","deviceId":"abc123"}
[MusicPlayer:DeviceTransfer] {"action":"transfer_success","deviceId":"abc123"}
[MusicPlayer:Playback] {"action":"playback_success","deviceId":"abc123"}
```

## Troubleshooting Guide

### Common Issues

#### 1. CSP Violations
**Symptoms**: Console errors about blocked resources
**Solution**: Update CSP in `electron/src/setup.ts`
```javascript
// Ensure these directives are present:
script-src: 'https://sdk.scdn.co'
connect-src: 'https://api.spotify.com https://accounts.spotify.com'
```

#### 2. SDK Load Timeout
**Symptoms**: "Spotify SDK load timeout" error
**Solution**: 
- Check network connection
- Verify CSP allows `https://sdk.scdn.co`
- Increase timeout if needed

#### 3. Auth Callback Errors
**Symptoms**: "Authentication error" during initialization
**Solution**: 
- Expected until Stage 5 OAuth setup
- Verify TokenManager integration
- Check token validity

#### 4. Device Not Appearing
**Symptoms**: "Slideshow Buddy" not in Spotify Connect
**Solution**:
- Ensure Premium account
- Check player initialization succeeded
- Verify device_id is set
- Try restarting Spotify app

#### 5. Playback Fails
**Symptoms**: startPlayback() throws errors
**Solution**:
- Verify device is active in Spotify
- Check playlist/track URIs are valid
- Confirm Premium account status
- Review Spotify API response errors

### Debug Tools

#### Console Logging
All MusicPlayerService functions include detailed logging:
- Search for `[MusicPlayer:*]` in console
- Timestamps help track operation duration
- JSON format provides structured debugging data

#### Spotify API Monitoring
- Monitor network tab for Spotify API calls
- Check response status codes
- Verify request headers include valid Bearer tokens

## Testing Environment Setup

### Development Testing:
```bash
# Run in development mode with DevTools
npm run electron:dev
```

### Production Testing:
```bash
# Build and test production app
npm run electron:build
# Test built app in /dist or platform-specific folder
```

### Network Debugging:
- Use Electron DevTools Network tab
- Monitor requests to `sdk.scdn.co` and `api.spotify.com`
- Verify response codes and timing

## Post-Testing Actions

After successful testing:

1. **Document any issues found** in implementation plan
2. **Note any CSP adjustments needed** 
3. **Confirm readiness for Stage 5** OAuth implementation
4. **Update testing checklist** with platform-specific findings

## Stage 4 Completion Criteria

✅ **Ready for Stage 5** when:
- [ ] No CSP violations during SDK loading
- [ ] MusicPlayerService compiles without errors  
- [ ] Player initialization code executes (auth errors expected)
- [ ] All standard Web APIs function correctly in Electron
- [ ] No mobile-specific code conflicts detected
- [ ] TokenManager integration points verified

🚫 **Not ready** if:
- CSP blocks Spotify domains
- TypeScript compilation fails for MusicPlayerService
- DOM manipulation fails in Electron context
- Core initialization throws unexpected errors

## Next Steps

👉 **Stage 5**: Configure Spotify OAuth implementation for authentication