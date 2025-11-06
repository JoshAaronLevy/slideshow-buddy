# User Experience Redesign Plan

## Overview

This document outlines the comprehensive plan to redesign Slideshow Buddy from a 3-tab "select-and-play" experience to a 2-tab "create-and-manage" experience with persistent slideshows and custom music playlists.

**Current Experience:** Users select photos and music on separate tabs, then play them once on a third tab.

**New Experience:** Users create named, saveable slideshows with custom settings, and manage custom music collections, all persisted locally.

---

## Key Changes Summary

### Layout Changes
- **Before:** 3 tabs (Photos, Music, Play)
- **After:** 2 tabs (Slideshows, Music)

### Feature Changes
1. **Multi-photo selection** in a single picker (using `@capacitor-community/media`)
2. **Named slideshows** with persistent storage (using Capacitor Preferences)
3. **Custom playlist creation** from Spotify tracks (virtual playlists stored locally)
4. **Slideshow management** (view, edit, delete, play saved slideshows)
5. **Playlist management** (view, edit, delete custom playlists)

---

## UX Flow Comparison

### Current Flow
```
Tab 1 (Photos) → Import photos one-by-one → Select multiple
Tab 2 (Music) → Connect Spotify → Browse playlists
Tab 3 (Play) → Configure settings → Start slideshow → Lose everything after
```

### New Flow - Slideshows Tab
```
Tab 1 (Slideshows) → View saved slideshows
                   ↓
            Tap "New Slideshow"
                   ↓
            Select photos (multi-select in one go)
                   ↓
            Configuration screen:
              - Name the slideshow
              - Choose music source (playlist/none)
              - Set slide duration (5s default)
              - Toggle shuffle
              - Save & Play or just Save
                   ↓
            Slideshow saved to local storage
                   ↓
            Can view, edit, delete, or play later
```

### New Flow - Music Tab
```
Tab 2 (Music) → Connect Spotify (if not connected)
              ↓
         View custom playlists
              ↓
         Tap "New Playlist"
              ↓
         Browse Spotify (search or browse library)
              ↓
         Select multiple tracks
              ↓
         Playlist configuration:
           - Name the playlist
           - (Future) Add tags
           - Save
              ↓
         Playlist saved to local storage
              ↓
         Can view, edit, delete, or use in slideshows
```

---

## Alternative UX Approach (Recommendation)

I recommend a **slightly modified flow** for slideshow creation that feels more natural:

### Recommended: "Name First" Flow
```
Tap "New Slideshow"
    ↓
Configuration Screen First:
  - Name your slideshow (required)
  - Choose music (optional, can add later)
  - Set preferences (duration, shuffle)
    ↓
Tap "Add Photos" button
    ↓
Multi-photo picker
    ↓
Return to config screen with photo count displayed
    ↓
Can add more photos, adjust settings, or save
    ↓
Tap "Save" or "Save & Play"
```

**Why this is better:**
1. **More intentional:** Naming first makes users think about what they're creating
2. **Flexible:** Can configure settings before/after photo selection
3. **Editable:** Easy to add more photos or change music before saving
4. **Clear state:** Users see all their choices in one place before committing
5. **Standard pattern:** Matches iOS/Android app conventions (name → content → save)

**Why your original flow is also valid:**
- Faster for users who know what they want
- Photos-first feels natural for a photo app
- Less friction for quick slideshow creation

**My suggestion:** Implement the "name first" flow initially, but we can easily adjust based on your preference after you try it.

---

## Implementation Stages

### Stage 1: Foundation & Data Layer
**Goal:** Set up the data structures, storage, and services for persistent slideshows and playlists.

**Tasks:**
1. Create new TypeScript interfaces:
   - `SavedSlideshow` (id, name, photoIds, musicSource, settings, createdAt, updatedAt)
   - `CustomPlaylist` (id, name, trackIds, tags[], createdAt, updatedAt)
   - `SavedPhoto` (enhance current Photo type with persistent storage ID)
   - `MusicSource` (discriminated union: CustomPlaylist | SpotifyPlaylist | null)

2. Create storage service (`src/services/StorageService.ts`):
   - `getSlideshows()`, `saveSlideshow()`, `updateSlideshow()`, `deleteSlideshow()`
   - `getPlaylists()`, `savePlaylist()`, `updatePlaylist()`, `deletePlaylist()`
   - `getPhotos()`, `savePhotos()`, `deletePhotos()`
   - All using Capacitor Preferences with JSON serialization

3. Create new Zustand store (`src/stores/slideshowLibraryStore.ts`):
   - Manages collection of saved slideshows
   - CRUD operations that sync with StorageService
   - Selection state for editing/playing

4. Create new Zustand store (`src/stores/playlistLibraryStore.ts`):
   - Manages collection of custom playlists
   - CRUD operations that sync with StorageService
   - Track selection state for playlist building

5. Update `photoStore`:
   - Remove the temporary selection logic (no longer needed)
   - Add photo persistence using StorageService
   - Photos become a permanent library, not temporary selections

**Files to create:**
- `src/types/slideshow.ts` (new type definitions)
- `src/types/playlist.ts` (new type definitions)
- `src/services/StorageService.ts`
- `src/stores/slideshowLibraryStore.ts`
- `src/stores/playlistLibraryStore.ts`

**Files to modify:**
- `src/types/index.ts` (import and export new types)
- `src/stores/photoStore.ts` (add persistence)
- `src/constants/index.ts` (add new storage keys)

**Testing:** Unit tests for storage service serialization/deserialization

---

### Stage 2: Multi-Photo Selection
**Goal:** Implement true multi-photo selection using `@capacitor-community/media`.

**Tasks:**
1. Update `PhotoService.ts`:
   - Replace `Camera.getPhoto()` with `Media.getMedias()`
   - Configure for multiple selection
   - Handle permissions properly
   - Convert media assets to our Photo format
   - Support up to 50 photos per selection (or configurable limit)

2. Update photo selection behavior:
   - Remove the "select individual photos after import" concept
   - All imported photos go directly into the photo library
   - Photo selection happens during slideshow creation (Stage 3)

3. Create reusable photo picker modal component:
   - `src/components/PhotoPickerModal.tsx`
   - Shows grid of all photos in library
   - Multi-select with checkboxes
   - "Select All" / "Deselect All" buttons
   - Shows selection count
   - Used in slideshow creation/editing

**Files to create:**
- `src/components/PhotoPickerModal.tsx`
- `src/components/PhotoPickerModal.css`

**Files to modify:**
- `src/services/PhotoService.ts` (use Media plugin)
- `src/stores/photoStore.ts` (simplify to just library management)

**Testing:** Manual testing on iOS device/simulator (multi-select isn't available in web preview)

---

### Stage 3: Slideshows Tab - New UI
**Goal:** Transform Tab 1 from "Photos" to "Slideshows" with creation and management capabilities.

**Tasks:**
1. Rename and restructure Tab1:
   - File: `src/pages/SlideshowsTab.tsx` (rename from Tab1.tsx)
   - Show list of saved slideshows (initially empty)
   - Each slideshow card shows: thumbnail (first photo), name, photo count, music info, last played
   - "New Slideshow" FAB button
   - Tap slideshow card to see options: Play, Edit, Delete

2. Create Slideshow Creation Modal:
   - File: `src/components/SlideshowCreationModal.tsx`
   - Form fields: Name (required), Music selector, Duration slider, Shuffle toggle
   - "Add Photos" button → opens PhotoPickerModal
   - Shows thumbnail strip of selected photos
   - "Save" and "Save & Play" buttons
   - Validation: require name and at least 1 photo

3. Create Slideshow Edit Modal:
   - File: `src/components/SlideshowEditModal.tsx`
   - Same fields as creation modal, pre-populated
   - Can add/remove photos
   - Can change all settings
   - Shows created/updated timestamps

4. Music selector component:
   - File: `src/components/MusicSelectorModal.tsx`
   - Lists: Custom Playlists, Spotify Playlists, "No Music"
   - Shows which is currently selected
   - Search/filter capability
   - Preview button for playlists

5. Update routing in `App.tsx`:
   - Change `/tab1` route to `/slideshows`
   - Update tab bar label and icon

**Files to create:**
- `src/pages/SlideshowsTab.tsx` (rename from Tab1)
- `src/pages/SlideshowsTab.css`
- `src/components/SlideshowCreationModal.tsx`
- `src/components/SlideshowCreationModal.css`
- `src/components/SlideshowEditModal.tsx`
- `src/components/SlideshowEditModal.css`
- `src/components/MusicSelectorModal.tsx`
- `src/components/MusicSelectorModal.css`
- `src/components/SlideshowCard.tsx` (reusable card component)
- `src/components/SlideshowCard.css`

**Files to modify:**
- `src/App.tsx` (routing changes)
- `src/pages/Tab1.tsx` → delete or archive

**Testing:** Create, save, view, edit, delete slideshows

---

### Stage 4: Music Tab - Custom Playlists
**Goal:** Add custom playlist creation and management to the Music tab.

**Tasks:**
1. Restructure Tab2:
   - Keep Spotify connection UI (already good)
   - Add "Custom Playlists" section above Spotify content
   - Add "New Playlist" button
   - Show list of custom playlists with play counts

2. Create Track Picker Modal:
   - File: `src/components/TrackPickerModal.tsx`
   - Search Spotify tracks (already have search in musicStore)
   - Browse user's saved tracks
   - Browse playlists and select individual tracks
   - Multi-select with checkboxes
   - Shows selection count
   - Preview track button

3. Create Playlist Creation Modal:
   - File: `src/components/PlaylistCreationModal.tsx`
   - Name field (required)
   - "Add Tracks" button → opens TrackPickerModal
   - Shows list of selected tracks with reorder capability
   - Remove track button per track
   - Save button

4. Create Playlist Edit Modal:
   - File: `src/components/PlaylistEditModal.tsx`
   - Same as creation modal, pre-populated
   - Can add/remove/reorder tracks
   - Shows created/updated timestamps

5. Update MusicStore:
   - Add `customPlaylists` state
   - Add `selectedTracks` for building playlists
   - Add CRUD actions for custom playlists
   - Add track multi-select state and actions

**Files to create:**
- `src/components/TrackPickerModal.tsx`
- `src/components/TrackPickerModal.css`
- `src/components/PlaylistCreationModal.tsx`
- `src/components/PlaylistCreationModal.css`
- `src/components/PlaylistEditModal.tsx`
- `src/components/PlaylistEditModal.css`
- `src/components/CustomPlaylistCard.tsx`
- `src/components/CustomPlaylistCard.css`

**Files to modify:**
- `src/pages/Tab2.tsx` (add custom playlists section)
- `src/pages/Tab2.css` (styling updates)
- `src/stores/musicStore.ts` (add custom playlist state)

**Testing:** Create, save, edit, delete custom playlists; use in slideshows

---

### Stage 5: Slideshow Playback Integration
**Goal:** Integrate the new slideshow system with the existing player.

**Tasks:**
1. Update SlideshowPlayer component:
   - Accept a `SavedSlideshow` prop instead of loose config
   - Load photos by their stored IDs
   - Load music source (custom playlist, Spotify playlist, or none)
   - Handle music source types correctly
   - Update "currently playing" slideshow in store

2. Refactor Tab3 or remove it:
   - **Option A (Recommended):** Remove Tab3 entirely
     - Slideshow player is modal/overlay only
     - Launched from Slideshows tab when user taps "Play"
     - Reduces tab count to 2 as desired
   
   - **Option B:** Keep Tab3 as "Now Playing"
     - Shows currently playing slideshow
     - Shows history of played slideshows
     - Quick access to recently played
     - Could be useful but not essential for MVP

3. Update App.tsx routing:
   - Remove Tab3 route if going with Option A
   - Update tab bar to only show 2 tabs

4. Add "Play" functionality to Slideshows tab:
   - Tap slideshow card → show action sheet
   - Actions: Play, Edit, Delete, Share (future)
   - Play → Load slideshow → Show player modal/fullscreen

**Files to modify:**
- `src/components/SlideshowPlayer.tsx`
- `src/components/SlideshowPlayer.css`
- `src/App.tsx` (routing)
- `src/pages/SlideshowsTab.tsx` (add play action)
- `src/pages/Tab3.tsx` → delete if going with Option A

**Files to create (if Option B):**
- `src/pages/NowPlayingTab.tsx`

**Testing:** Play saved slideshows with different music sources

---

### Stage 6: Polish & UX Refinements
**Goal:** Add the finishing touches for a polished, production-ready experience.

**Tasks:**
1. Empty states:
   - "No slideshows yet" with helpful onboarding in Slideshows tab
   - "No custom playlists yet" in Music tab
   - "No photos in library" in photo picker

2. Loading states:
   - Skeleton loaders for slideshow list
   - Skeleton loaders for playlist list
   - Loading spinner when saving/deleting
   - Progress indicator for photo import

3. Error handling:
   - Toast notifications for failures
   - Retry mechanisms for network errors
   - Validation messages in forms
   - Graceful degradation if storage fails

4. Haptic feedback:
   - Add to all new buttons and interactions
   - Long-press actions
   - Swipe gestures (if added)

5. Accessibility:
   - ARIA labels for all new components
   - Screen reader announcements for state changes
   - Keyboard navigation (if applicable)
   - Color contrast checks

6. Animations & transitions:
   - Smooth modal open/close
   - Card hover/press states
   - List item animations
   - Photo grid transitions

7. Responsive design:
   - Test on different iOS device sizes
   - Adjust layouts for iPad (if supported)
   - Handle landscape orientation

8. Data management:
   - Add "Delete All Data" option in a settings modal
   - Export/Import functionality (future)
   - Storage usage indicator

**Files to modify:**
- All new component files (add polish)
- All new page files (add polish)
- `src/theme/variables.css` (any new theme variables)

**Testing:** 
- Manual testing on physical iOS device
- Test all user flows end-to-end
- Test error scenarios
- Test with no network connection
- Test with large photo libraries

---

### Stage 7: Stretch Goals (Future Enhancements)
**Goal:** Advanced features mentioned by the user as "nice to have."

**Tasks:**
1. Song/Playlist tagging system:
   - Add `tags: string[]` to CustomPlaylist
   - Tag management UI (add, remove, search by tag)
   - Create tag-based "Smart Playlists" in slideshow music selector
   - Filter playlists by tag
   - Auto-shuffle tracks with matching tag(s)

2. Smart slideshow suggestions:
   - "Recently added photos" slideshow
   - "Photos from this month" slideshow
   - Seasonal playlists (holiday music with matching photos)

3. Slideshow templates:
   - Pre-configured settings for common use cases
   - "Quick 1-minute", "5-minute story", "Long form 30-minute"

4. Photo editing:
   - Basic filters
   - Crop/rotate
   - Captions overlay

5. Social features:
   - Share slideshow export (video file)
   - QR code to view slideshow on another device
   - Collaborative slideshows

**Files to create:** TBD based on which features are chosen

**Testing:** TBD

---

## Data Models

### SavedSlideshow
```typescript
interface SavedSlideshow {
  id: string;                    // UUID
  name: string;                  // User-defined name
  photoIds: string[];            // IDs of photos in library
  musicSource: MusicSource;      // What music to play
  settings: {
    transitionTime: number;      // Seconds per slide
    shuffle: boolean;            // Randomize order
    loop: boolean;               // Restart when done
  };
  thumbnailUri?: string;         // First photo URI for display
  createdAt: number;             // Timestamp
  updatedAt: number;             // Timestamp
  lastPlayedAt?: number;         // Timestamp
  playCount: number;             // How many times played
}
```

### CustomPlaylist
```typescript
interface CustomPlaylist {
  id: string;                    // UUID
  name: string;                  // User-defined name
  trackIds: string[];            // Spotify track IDs
  tracks: SpotifyTrack[];        // Full track objects (cached)
  tags?: string[];               // Optional tags (stretch goal)
  createdAt: number;             // Timestamp
  updatedAt: number;             // Timestamp
  thumbnailUri?: string;         // Album art from first track
}
```

### MusicSource (Discriminated Union)
```typescript
type MusicSource = 
  | { type: 'custom-playlist'; playlistId: string }
  | { type: 'spotify-playlist'; playlistId: string }
  | { type: 'none' };
```

### Updated Photo Interface
```typescript
interface Photo {
  id: string;                    // Persistent ID
  uri: string;                   // File URI
  filename: string;              // Original filename
  timestamp: number;             // Date imported
  // Remove 'selected' - not needed anymore
}
```

---

## Storage Keys

Add to `src/constants/index.ts`:

```typescript
export const STORAGE_KEYS = {
  // Existing keys...
  SLIDESHOWS: 'slideshows',
  CUSTOM_PLAYLISTS: 'custom_playlists',
  PHOTO_LIBRARY: 'photo_library',
  APP_VERSION: 'app_version', // For future migrations
};
```

---

## Migration Strategy

Since this is a breaking change from the current version, we need a migration strategy:

### Option A: Clean Slate (Recommended for now)
- Don't migrate any data from v0.2.0
- App starts fresh with new storage format
- Users start with empty slideshows and playlists
- Simplest approach, acceptable for early development

### Option B: Data Migration
- Detect old storage format on app launch
- Convert old selected photos → photo library
- Show one-time migration success message
- More complex, only needed if users have important data

**Recommendation:** Start with Option A (clean slate). If users report needing their data, implement Option B in a patch release.

---

## User Flows for Testing

### Creating a Slideshow
1. Open app → Slideshows tab (empty state)
2. Tap "New Slideshow" FAB
3. Creation modal opens
4. Enter name: "Summer Vacation 2024"
5. Tap "Add Photos"
6. Photo picker opens (empty - first time)
7. Tap "Import Photos" button
8. System photo picker appears (multi-select)
9. Select 15 photos → Tap "Add"
10. Return to creation modal, see 15 photos
11. Tap "Choose Music"
12. Music selector opens
13. Select "Road Trip Tunes" custom playlist
14. Return to creation modal
15. Adjust duration slider to 7 seconds
16. Enable shuffle
17. Tap "Save & Play"
18. Slideshow saves and immediately starts playing
19. Full-screen player with photos + music
20. After slideshow, return to Slideshows tab
21. See new slideshow card in list

### Creating a Custom Playlist
1. Open app → Music tab
2. Connect Spotify (if not already)
3. Scroll to "Custom Playlists" section (empty state)
4. Tap "New Playlist" button
5. Creation modal opens
6. Enter name: "Chill Vibes"
7. Tap "Add Tracks"
8. Track picker opens
9. Search "lofi hip hop"
10. Select 8 tracks with checkboxes
11. Tap "Done"
12. Return to creation modal, see 8 tracks listed
13. Tap "Save"
14. Playlist saves
15. See new playlist card in Custom Playlists section
16. Can now use in slideshows

### Editing a Slideshow
1. Slideshows tab → Tap existing slideshow card
2. Action sheet appears: Play, Edit, Delete
3. Tap "Edit"
4. Edit modal opens with current values
5. Change name
6. Tap "Add Photos" to add 5 more
7. Change music to different playlist
8. Adjust settings
9. Tap "Save"
10. Return to list, see updated slideshow

---

## Technical Notes

### Storage Size Considerations
- **Photos:** Store only URIs, not actual image data (images stay in photo library)
- **Tracks:** Store Spotify IDs + cached metadata, not audio files
- **Slideshows:** Small JSON objects, ~1-5KB each
- **Playlists:** Small JSON objects, ~2-10KB each depending on track count
- **Estimated total:** ~100 slideshows + 50 playlists = ~1-2MB max

Capacitor Preferences has no hard limit but recommend keeping under 5MB. We're well under that.

### Performance Considerations
- Load slideshows/playlists on app start (async, don't block UI)
- Cache photo URIs to avoid repeated lookups
- Lazy load playlist track details (show name first, fetch details later)
- Debounce search inputs
- Virtualize long lists (if >100 items)

### Error Handling
- Network errors: Show toast, cache last good state, retry with exponential backoff
- Storage errors: Log to console, show error modal, offer "Clear Data" option
- Permission errors: Show explanation modal with "Open Settings" button
- Spotify errors: Refresh token if expired, re-authenticate if needed

---

## Implementation Timeline Estimate

- **Stage 1 (Foundation):** 4-6 hours
- **Stage 2 (Multi-photo):** 2-3 hours
- **Stage 3 (Slideshows Tab):** 6-8 hours
- **Stage 4 (Music Tab):** 4-6 hours
- **Stage 5 (Playback):** 3-4 hours
- **Stage 6 (Polish):** 4-6 hours
- **Stage 7 (Stretch):** TBD (8+ hours for full tagging system)

**Total MVP (Stages 1-6):** ~25-35 hours of development

---

## Open Questions for User

1. **Creation flow preference:** Do you prefer the "name first" approach I recommended, or stick with your original "photos first → config screen" flow?

2. **Tab 3 removal:** Are you okay with completely removing the third tab, or would you like to keep it as a "Now Playing" or "Settings" tab?

3. **Playlist behavior:** Should custom playlists play in the order you added tracks, or always shuffled? Or user choice per playlist?

4. **Photo library management:** Should users be able to permanently delete photos from their app library, or just remove them from slideshows?

5. **Spotify playlists:** Should users be able to select individual Spotify playlists for slideshows, or only custom playlists? (Currently shows Spotify playlists, but can't edit them)

6. **Slideshow limits:** Any max limits? (e.g., max 100 photos per slideshow, max 50 slideshows total)

---

## Summary

This plan transforms Slideshow Buddy from a temporary, session-based experience into a permanent, curated library of slideshows and music. The key improvements are:

1. ✅ **Persistence** - Everything is saved and accessible later
2. ✅ **Organization** - Named slideshows and playlists with metadata
3. ✅ **Multi-select** - Select many photos/tracks at once
4. ✅ **Flexibility** - Edit anything after creation
5. ✅ **Discoverability** - Browse saved content easily
6. ✅ **2-tab layout** - Simpler navigation

The staged approach allows you to review and approve each phase independently, with each stage building on the previous one. We can adjust the plan based on your feedback before implementation begins.

---

**Ready to proceed?** Let me know if you'd like any changes to the plan, or if you're ready to start with Stage 1!
