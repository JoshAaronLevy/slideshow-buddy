# Music Implementation Plan - Slideshow Buddy

## Overview
This document outlines the implementation plan for completing the music feature user experience after successful Spotify authentication. The goal is to create a seamless flow from Spotify connection through playlist creation to slideshow playback with music.

---

## Current State Analysis

### ✅ What's Already Implemented
1. **Spotify OAuth Flow** - Working with external Express server callback
2. **Auth Store** - Complete authentication state management (authStore.ts)
3. **Music Store** - Spotify API integration for fetching playlists, tracks, search
4. **Playlist Library Store** - Custom playlist CRUD operations
5. **Storage Service** - Persistent storage for custom playlists and slideshows
6. **UI Components**:
   - `PlaylistCreationModal` - Create new custom playlists
   - `PlaylistEditModal` - Edit existing playlists
   - `MusicSelectorModal` - Select music source for slideshows
   - `SlideshowConfigModal` - Configure slideshow with music selection
   - `CustomPlaylistCard` - Display custom playlists

### ❌ Current Issue
**Problem**: After successful Spotify authentication, the user is redirected back to the "Connect to Spotify" screen instead of seeing the authenticated music interface.

**Root Cause**: The authentication callback is being handled, but the UI is not properly detecting the authenticated state change. Likely issues:
1. The `checkAuthStatus()` call in Tab2 is not re-running after callback
2. The auth state is not being persisted/restored correctly
3. The browser redirect from Express callback may not be triggering the app URL listener

---

## Implementation Plan - MVP Features

### Phase 1: Fix Authentication State Persistence ⚠️ CRITICAL
**Goal**: Ensure user stays logged in after successful OAuth callback

#### 1.1 Debug Auth Callback Flow
**Files to investigate**:
- `src/services/SpotifyAuthService.ts`
- `src/stores/authStore.ts`
- `src/pages/Tab2.tsx`

**Changes needed**:
1. **Add debug logging** to trace the auth flow:
   ```typescript
   // In SpotifyAuthService.ts - handleCallback()
   console.log('[Auth] Callback received:', { code: code.substring(0, 10) + '...', state });
   console.log('[Auth] Tokens received:', { hasAccessToken: !!tokens.access_token });
   console.log('[Auth] User profile fetched:', user);
   ```

2. **Verify callback URL handling**:
   - Ensure Express callback is redirecting to: `slideshowbuddy://callback?code=...&state=...`
   - Check that `App.addListener('appUrlOpen')` in `setupAuthListener()` is triggering
   - Add console.log in the listener to confirm it's called

3. **Test token persistence**:
   ```typescript
   // After login, verify tokens are stored
   const token = await Preferences.get({ key: STORAGE_KEYS.SPOTIFY_ACCESS_TOKEN });
   console.log('[Auth] Stored token:', !!token.value);
   ```

#### 1.2 Force State Refresh After Callback
**File**: `src/pages/Tab2.tsx`

**Change**: Ensure `checkAuthStatus()` is called after callback completes:
```typescript
useEffect(() => {
  setupAuthListener(async (code, state) => {
    await handleCallback(code, state);
    // Force re-check auth status after callback
    await checkAuthStatus();
  });
}, [handleCallback, checkAuthStatus]);
```

#### 1.3 Handle Express Callback Redirect
**External Express Server** - Ensure proper redirect:
```javascript
// In Express callback route
app.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  
  // Redirect to app with deep link
  const redirectUrl = `slideshowbuddy://callback?code=${code}&state=${state}`;
  
  // For iOS
  res.redirect(redirectUrl);
  
  // Alternative: Show success page with auto-redirect
  res.send(`
    <html>
      <body>
        <h1>Authentication Successful!</h1>
        <p>Redirecting to app...</p>
        <script>
          window.location.href = '${redirectUrl}';
          setTimeout(() => {
            window.close();
          }, 1000);
        </script>
      </body>
    </html>
  `);
});
```

---

### Phase 2: Authenticated Music Tab Experience
**Goal**: Show proper interface after successful Spotify connection

#### 2.1 Hide "Connect to Spotify" Card When Authenticated
**File**: `src/pages/Tab2.tsx`

**Current behavior**: The connection card is shown when `!isAuthenticated`

**Expected behavior**: Already correct - card only shows when not authenticated

**Verify**: The `isAuthenticated` flag is properly updated after callback

#### 2.2 Show User Profile Card (Already Implemented)
**File**: `src/pages/Tab2.tsx` (lines 470-548)

**Status**: ✅ Already implemented correctly

Features:
- User avatar/display name
- Premium badge (required for playback)
- Disconnect button

#### 2.3 Show Custom Playlist Creation (Already Implemented)
**File**: `src/pages/Tab2.tsx` (lines 242-278)

**Status**: ✅ Already implemented correctly

Features:
- "My Playlists" section
- "New" button to create playlist
- Grid display of custom playlists
- Empty state with helpful message

---

### Phase 3: Playlist Creation Flow
**Goal**: User can create and save custom playlists from Spotify library

#### 3.1 Verify PlaylistCreationModal Functionality
**File**: `src/components/PlaylistCreationModal.tsx`

**Status**: ✅ Already fully implemented

Features:
- Name input with auto-generated default
- "Add Tracks" button → opens TrackPickerModal
- Track list with reordering (drag & drop)
- Remove track button
- Save validation (requires name + tracks)

#### 3.2 Verify TrackPickerModal Exists and Works
**File**: `src/components/TrackPickerModal.tsx`

**Action needed**: Check if this component exists and is properly implemented

**Expected features**:
- Browse Spotify library (playlists, recently played, search)
- Multi-select tracks with checkboxes
- Search functionality
- Confirm button to return selected tracks

**If not implemented**, create it with:
```typescript
interface TrackPickerModalProps {
  isOpen: boolean;
  selectedTrackIds: string[]; // Pre-selected tracks
  onDismiss: () => void;
  onConfirm: (trackIds: string[], tracks: SpotifyTrack[]) => void;
}
```

#### 3.3 Playlist Persistence (Already Implemented)
**Files**: 
- `src/stores/playlistLibraryStore.ts`
- `src/services/StorageService.ts`

**Status**: ✅ Complete CRUD operations implemented

Features:
- Create: `createPlaylist()`
- Read: `loadPlaylists()`, stored in `playlists` array
- Update: `updatePlaylist()`
- Delete: `deletePlaylist()`
- Persisted in Capacitor Preferences

---

### Phase 4: Display Custom Playlists in Music Tab
**Goal**: Show created playlists in the Music tab

#### 4.1 Custom Playlist Display (Already Implemented)
**File**: `src/pages/Tab2.tsx` (lines 242-278)

**Status**: ✅ Implemented

Features:
- Loads playlists on mount: `loadCustomPlaylists()`
- Grid display with `CustomPlaylistCard` component
- Play, Edit, Delete actions

#### 4.2 Verify CustomPlaylistCard Component
**File**: `src/components/CustomPlaylistCard.tsx`

**Status**: ✅ Should be implemented (referenced in Tab2)

**Expected features**:
- Playlist thumbnail (album art from first track)
- Playlist name
- Track count
- Play button
- Edit button (pencil icon)
- Delete button (trash icon)

---

### Phase 5: Assign Music to Slideshows
**Goal**: User can select a playlist when creating/editing a slideshow

#### 5.1 Music Selection in Slideshow Creation (Already Implemented)
**File**: `src/components/SlideshowConfigModal.tsx` (lines 100-108)

**Status**: ✅ Implemented

Features:
- Music selection button with current selection display
- Opens `MusicSelectorModal` on click
- Stores `musicSource` in slideshow config

#### 5.2 MusicSelectorModal (Already Implemented)
**File**: `src/components/MusicSelectorModal.tsx`

**Status**: ✅ Fully implemented

Features:
- Radio group selection
- "No Music" option
- Custom playlists section
- Spotify playlists section
- Search functionality
- Confirm button

#### 5.3 Verify Slideshow Saves Music Source
**Files**:
- `src/pages/SlideshowsTab.tsx` (or wherever slideshows are created)
- `src/stores/slideshowLibraryStore.ts`

**Action needed**: Check that the `onSave()` callback in SlideshowConfigModal properly stores the `musicSource` in the slideshow

**Expected flow**:
```typescript
// In SlideshowsTab.tsx or similar
const handleSlideshowSave = async (
  name: string,
  musicSource: MusicSource,
  settings: SlideshowSettings
) => {
  const newSlideshow: NewSlideshow = {
    name,
    photoIds: selectedPhotos.map(p => p.id),
    photos: selectedPhotos,
    musicSource, // ← This must be saved
    settings,
  };
  
  await saveSlideshowToStore(newSlideshow);
};
```

---

### Phase 6: Slideshow Playback with Music
**Goal**: Play selected playlist during slideshow

#### 6.1 Check SlideshowPlayer Component
**File**: `src/components/SlideshowPlayer.tsx`

**Action needed**: Verify this component is implemented and handles music playback

**Expected features**:
1. Receives `slideshow` prop with `musicSource`
2. On slideshow start, begins music playback
3. Controls:
   - Play/pause slideshow
   - Previous/next photo
   - Music volume control (optional)
   - Exit fullscreen

**Critical implementation details**:

```typescript
interface SlideshowPlayerProps {
  slideshow: SavedSlideshow;
  isPlaying: boolean;
  onClose: () => void;
}

const SlideshowPlayer: React.FC<SlideshowPlayerProps> = ({ slideshow, isPlaying, onClose }) => {
  // Initialize music player on mount
  useEffect(() => {
    if (slideshow.musicSource.type !== 'none') {
      initializeMusicPlayback(slideshow.musicSource);
    }
    
    return () => {
      // Cleanup: stop music when slideshow ends
      stopMusicPlayback();
    };
  }, [slideshow.musicSource]);
  
  // ... photo transition logic
};
```

#### 6.2 Implement Music Playback Service
**File**: `src/services/MusicPlayerService.ts`

**Action needed**: Check if this exists and is properly implemented

**Required functionality**:

```typescript
/**
 * Initialize music playback for a slideshow
 */
export const initializePlayback = async (musicSource: MusicSource): Promise<void> => {
  if (musicSource.type === 'custom-playlist') {
    const playlist = await getPlaylist(musicSource.playlistId);
    await playCustomPlaylist(playlist);
  } else if (musicSource.type === 'spotify-playlist') {
    await playSpotifyPlaylist(musicSource.playlistId);
  }
};

/**
 * Play a custom playlist
 */
const playCustomPlaylist = async (playlist: CustomPlaylist): Promise<void> => {
  // Get Spotify URIs from playlist.trackIds
  const trackUris = playlist.tracks.map(t => t.uri);
  
  // Use Spotify Web Playback SDK to play tracks
  await playSpotifyTracks(trackUris);
};

/**
 * Play a Spotify playlist
 */
const playSpotifyPlaylist = async (playlistId: string): Promise<void> => {
  const playlistUri = `spotify:playlist:${playlistId}`;
  await playSpotifyUri(playlistUri);
};

/**
 * Play Spotify tracks/playlist using Web Playback SDK
 */
const playSpotifyUri = async (uri: string): Promise<void> => {
  const token = await getAccessToken();
  
  // Put endpoint to start playback
  await axios.put(
    'https://api.spotify.com/v1/me/player/play',
    { context_uri: uri },
    { headers: { Authorization: `Bearer ${token}` } }
  );
};

/**
 * Stop music playback
 */
export const stopPlayback = async (): Promise<void> => {
  const token = await getAccessToken();
  
  await axios.put(
    'https://api.spotify.com/v1/me/player/pause',
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
};

/**
 * Control volume
 */
export const setVolume = async (volumePercent: number): Promise<void> => {
  const token = await getAccessToken();
  
  await axios.put(
    `https://api.spotify.com/v1/me/player/volume?volume_percent=${volumePercent}`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
};
```

**Important**: This requires:
- Spotify Premium account
- Active device (Spotify app must be open on device or use Web Playback SDK)
- Proper error handling if no devices are available

#### 6.3 Alternative: Spotify Web Playback SDK Integration
**For in-app playback without external Spotify app**:

**File**: `src/services/SpotifyWebPlaybackSDK.ts` (new file)

```typescript
/**
 * Initialize Spotify Web Playback SDK
 * Allows playing music directly in the app
 */
export const initializeWebPlayback = async (): Promise<Spotify.Player> => {
  return new Promise((resolve, reject) => {
    // Load Spotify SDK script
    if (!window.Spotify) {
      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      document.body.appendChild(script);
    }
    
    window.onSpotifyWebPlaybackSDKReady = () => {
      const token = await getAccessToken();
      
      const player = new window.Spotify.Player({
        name: 'Slideshow Buddy Player',
        getOAuthToken: (cb: (token: string) => void) => { cb(token); },
        volume: 0.5,
      });
      
      // Ready
      player.addListener('ready', ({ device_id }: { device_id: string }) => {
        console.log('Web Playback SDK ready with device ID:', device_id);
        resolve(player);
      });
      
      // Errors
      player.addListener('initialization_error', ({ message }) => {
        console.error('SDK initialization error:', message);
        reject(new Error(message));
      });
      
      // Connect
      player.connect();
    };
  });
};
```

**Note**: Web Playback SDK requires:
- Spotify Premium
- HTTPS (won't work in development without proper setup)
- Additional setup in Capacitor for mobile

---

### Phase 7: User Experience Polish

#### 7.1 Playlist Preview in Music Tab
**Enhancement**: Allow users to preview/play playlists from the Music tab

**File**: `src/pages/Tab2.tsx`

**Changes**:
```typescript
const handlePlayCustomPlaylist = (playlist: CustomPlaylist) => {
  HapticService.impactMedium();
  
  // Start preview playback
  MusicPlayerService.playPreview(playlist);
  
  presentToast({
    message: `Playing "${playlist.name}"`,
    duration: 2000,
    color: 'primary',
    position: 'top',
  });
};
```

#### 7.2 Visual Feedback for Music State
**Enhancement**: Show currently playing music in slideshow player

**File**: `src/components/SlideshowPlayer.tsx`

Add UI element:
```tsx
{musicSource.type !== 'none' && (
  <div className="slideshow-music-info">
    <IonIcon icon={musicalNotesOutline} />
    <IonText>{currentTrackName}</IonText>
  </div>
)}
```

#### 7.3 Error Handling for Premium Requirement
**Enhancement**: Better messaging when user tries to play music without Premium

**Files**: 
- `src/components/SlideshowPlayer.tsx`
- `src/services/MusicPlayerService.ts`

**Implementation**:
```typescript
try {
  await initializePlayback(musicSource);
} catch (error) {
  if (error.message.includes('Premium')) {
    presentToast({
      message: 'Spotify Premium required for music playback',
      duration: 5000,
      color: 'warning',
      buttons: [
        {
          text: 'Upgrade',
          handler: () => {
            Browser.open({ url: 'https://www.spotify.com/premium/' });
          },
        },
      ],
    });
  }
}
```

#### 7.4 Empty State Improvements
**Enhancement**: Guide users through the flow when they have no playlists

**File**: `src/pages/Tab2.tsx`

Already implemented - verify messaging is clear:
- Custom playlists section: "Create playlists to use in your slideshows"
- Music selector: "Create custom playlists in the Music tab or connect to Spotify"

---

## Testing Checklist

### Authentication Flow
- [ ] User taps "Connect with Spotify"
- [ ] Browser opens with Spotify login
- [ ] User authorizes app
- [ ] Express server receives callback
- [ ] App receives deep link redirect
- [ ] User profile is loaded and displayed
- [ ] Auth state persists after app restart

### Playlist Creation Flow
- [ ] Tap "New" button in Custom Playlists section
- [ ] PlaylistCreationModal opens with auto-generated name
- [ ] Tap "Add Tracks"
- [ ] TrackPickerModal shows Spotify library
- [ ] Search for tracks works
- [ ] Select multiple tracks
- [ ] Confirm selection
- [ ] Tracks appear in playlist
- [ ] Reorder tracks via drag & drop
- [ ] Remove tracks works
- [ ] Save playlist
- [ ] Playlist appears in Music tab

### Playlist Management
- [ ] Edit playlist (modify name, add/remove tracks)
- [ ] Delete playlist (with confirmation)
- [ ] Playlists persist after app restart

### Slideshow Music Assignment
- [ ] Create new slideshow
- [ ] In SlideshowConfigModal, tap "Music"
- [ ] MusicSelectorModal opens
- [ ] See "No Music", "Custom Playlists", "Spotify Playlists" sections
- [ ] Select a custom playlist
- [ ] Confirm selection
- [ ] Selected playlist name shows in config
- [ ] Save slideshow
- [ ] Slideshow stores musicSource correctly

### Slideshow Playback
- [ ] Open saved slideshow
- [ ] Tap "Play"
- [ ] Photos transition at configured interval
- [ ] Music starts playing (if assigned)
- [ ] Music continues through slideshow
- [ ] Pause/resume works
- [ ] Music stops when slideshow ends
- [ ] Music stops when user exits slideshow

### Premium Requirements
- [ ] Non-premium users see warning badge
- [ ] Non-premium users can create playlists
- [ ] Music playback fails gracefully for non-premium
- [ ] Helpful error message shown

---

## Known Limitations & Future Enhancements

### Current Limitations
1. **Spotify Premium Required** - Cannot play music without premium subscription
2. **Active Device Required** - User must have Spotify app open or use Web Playback SDK
3. **No Offline Playback** - Requires internet connection for music
4. **No Track Scrubbing** - Cannot seek within tracks during slideshow

### Future Enhancements (Post-MVP)
1. **Local Music Support** - Import music from device library (Apple Music, files)
2. **Playlist Sharing** - Share custom playlists with other users
3. **Smart Playlists** - Auto-generate playlists based on mood, genre, etc.
4. **Crossfade Transitions** - Smooth audio transitions between tracks
5. **Sync Music to Photos** - Time photo transitions to music beats
6. **Background Playback** - Continue music when app is backgrounded
7. **Volume Ducking** - Auto-adjust volume for video clips in slideshows
8. **Spotify Playlist Sync** - Save custom playlists to user's Spotify account
9. **Collaborative Playlists** - Allow multiple users to contribute tracks
10. **Music Recommendations** - Suggest tracks based on slideshow theme/photos

---

## Estimated Implementation Time

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1 | Fix Auth State Persistence | 2-4 hours |
| Phase 2 | Verify Authenticated UI | 1 hour |
| Phase 3 | Playlist Creation Flow | 4-6 hours (if TrackPickerModal needs building) |
| Phase 4 | Custom Playlist Display | 1 hour (verify existing) |
| Phase 5 | Slideshow Music Assignment | 1 hour (verify existing) |
| Phase 6 | Music Playback Implementation | 8-12 hours (most complex) |
| Phase 7 | UX Polish & Error Handling | 4-6 hours |
| Testing | End-to-end testing | 4-6 hours |
| **Total** | | **25-40 hours** |

---

## Priority Implementation Order

### P0 (Critical - Must Fix First)
1. **Phase 1**: Fix authentication state persistence
   - This is blocking everything else
   - Without this, users can't access music features

### P1 (High - Core MVP)
2. **Phase 3**: Verify/implement TrackPickerModal
3. **Phase 6**: Music playback during slideshow
   - These are the core value features

### P2 (Medium - Enhanced MVP)
4. **Phase 7.3**: Error handling for non-premium users
5. **Phase 7.1**: Playlist preview in Music tab

### P3 (Low - Polish)
6. **Phase 7.2**: Visual feedback for music state
7. **Phase 7.4**: Empty state improvements

---

## Next Steps

1. **Review this plan** and confirm the approach
2. **Test authentication** to diagnose the callback issue
3. **Prioritize phases** based on your timeline
4. **Start with Phase 1** (authentication fix) as it's blocking
5. **Verify existing implementations** (TrackPickerModal, SlideshowPlayer)
6. **Implement missing pieces** based on priority

Let me know when you'd like to proceed with implementation, and which phase you'd like to tackle first!
