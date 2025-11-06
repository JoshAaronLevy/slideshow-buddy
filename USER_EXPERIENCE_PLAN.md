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
              - Auto-generated name "Slideshow-Nov-5-2024" (editable)
              - Choose music source (custom playlist/none)
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

## Confirmed Flow: "Photos First" Approach

Based on user feedback, we'll implement the **"Photos First"** flow:

```
Tap "New Slideshow"
    ↓
Multi-photo picker opens immediately
    ↓
User selects photos (25, 50, 100, or any number)
    ↓
Configuration screen:
  - Auto-generated name: "Slideshow-Nov-5-2024" (fully editable)
  - Choose music: Custom playlists or None
  - Set slide duration: 5s default (2-10s range)
  - Toggle shuffle: on/off
    ↓
Tap "Save" or "Save & Play"
    ↓
Slideshow saved to local storage
```

**Why this works well:**
1. **Photos are the core content** - Get them selected first
2. **Low friction** - Users can quickly create slideshows
3. **Smart defaults** - Auto-generated name reduces cognitive load
4. **Single configuration screen** - All settings in one place after photo selection
5. **Natural flow** - Select content → Configure → Save

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

2. Create Slideshow Configuration Modal:
   - File: `src/components/SlideshowConfigModal.tsx`
   - **Opens AFTER photo selection** (photos already selected via multi-picker)
   - Form fields:
     - Name (pre-filled with "Slideshow-Nov-5-2024", fully editable)
     - Music selector (choose custom playlist or none)
     - Duration slider (2-10s, default 5s)
     - Shuffle toggle (default on)
   - Shows thumbnail strip/grid of selected photos at top
   - Photo count indicator (e.g., "25 photos selected")
   - "Save" and "Save & Play" buttons
   - Validation: require name and at least 1 photo (already guaranteed by flow)

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
- `src/components/SlideshowConfigModal.tsx` (configuration screen, opens after photo selection)
- `src/components/SlideshowConfigModal.css`
- `src/components/SlideshowEditModal.tsx` (similar to config modal but for editing)
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
   - **Tab 1: Search** - Search all of Spotify
   - **Tab 2: My Library** - Browse user's saved tracks
   - **Tab 3: From Playlists** - Browse Spotify playlists, then select tracks from within them
     - Show list of user's Spotify playlists
     - Tap playlist → see all tracks in that playlist
     - Multi-select tracks from the playlist
     - Can navigate back to browse other playlists
   - Multi-select with checkboxes across all tabs
   - Shows running selection count (sticky footer)
   - Preview track button (30s preview if available)
   - "Done" button to confirm selection

3. Create Playlist Creation Modal:
   - File: `src/components/PlaylistCreationModal.tsx`
   - Name field (required)
   - "Add Tracks" button → opens TrackPickerModal (with all 3 tabs)
   - Shows list of selected tracks
   - Remove track button per track
   - **Note:** Tracks play in the order they were added (no reorder UI for MVP)
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

2. Hide Tab3 (comment out, don't delete):
   - Comment out Tab3 in App.tsx routing
   - Comment out Tab3 button in tab bar
   - Keep the file for future "Quick Play" feature (see Stage 7)
   - Reduces tab count to 2 for MVP

3. Update App.tsx routing:
   - Comment out Tab3 route
   - Comment out Tab3 tab button
   - Keep code intact for future re-implementation

4. Add "Play" functionality to Slideshows tab:
   - Tap slideshow card → show action sheet
   - Actions: Play, Edit, Delete, Share (future)
   - Play → Load slideshow → Show player modal/fullscreen

**Files to modify:**
- `src/components/SlideshowPlayer.tsx`
- `src/components/SlideshowPlayer.css`
- `src/App.tsx` (comment out Tab3 routing and tab button)
- `src/pages/SlideshowsTab.tsx` (add play action)
- `src/pages/Tab3.tsx` → keep as-is (commented out, for future use)

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

#### 7A. Quick Play Tab (High Priority)
Transform the current Tab3 into a "Quick Play" feature for instant slideshows.

**Concept:**
- Re-enable Tab3 as "Quick Play" tab
- Three large, prominent buttons:
  - **"Quick 25"** - Play 25 random photos
  - **"Quick 50"** - Play 50 random photos
  - **"Quick 100"** - Play 100 random photos
- When tapped:
  - Randomly selects N photos from user's library
  - Randomly selects a custom playlist (if any exist) or plays without music
  - Immediately starts playing with shuffle enabled
  - Uses default settings (5s per slide, loop enabled)
- Ephemeral - not saved as a slideshow
- Great for "I just want to see my photos with music right now"

**UI Design:**
```
┌─────────────────────────────┐
│       Quick Play            │
├─────────────────────────────┤
│                             │
│  ┌───────────────────────┐ │
│  │                       │ │
│  │      Quick 25         │ │
│  │   [shuffle icon]      │ │
│  │                       │ │
│  └───────────────────────┘ │
│                             │
│  ┌───────────────────────┐ │
│  │                       │ │
│  │      Quick 50         │ │
│  │   [shuffle icon]      │ │
│  │                       │ │
│  └───────────────────────┘ │
│                             │
│  ┌───────────────────────┐ │
│  │                       │ │
│  │     Quick 100         │ │
│  │   [shuffle icon]      │ │
│  │                       │ │
│  └───────────────────────┘ │
│                             │
│  Settings:                  │
│  ⚙️ Slide duration: 5s     │
│  🎵 Random music: On       │
│                             │
└─────────────────────────────┘
```

**Implementation:**
- Minimal changes to existing Tab3
- Add random selection logic to photoStore
- Add random playlist selection to musicStore
- Wire up to existing SlideshowPlayer
- Add optional Quick Play settings (mini config panel)

**Files to modify:**
- `src/pages/Tab3.tsx` (complete redesign)
- `src/pages/Tab3.css` (new styling)
- `src/App.tsx` (uncomment Tab3)
- `src/stores/photoStore.ts` (add `getRandomPhotos(count)`)
- `src/stores/playlistLibraryStore.ts` (add `getRandomPlaylist()`)

**Testing:** 
- Test with small photo library (< 25 photos)
- Test with large photo library (> 100 photos)
- Test with no custom playlists
- Test all three quick play options

---

#### 7B. Song/Playlist Tagging System
- Add `tags: string[]` to CustomPlaylist
- Tag management UI (add, remove, search by tag)
- Create tag-based "Smart Playlists" in slideshow music selector
- Filter playlists by tag
- Auto-shuffle tracks with matching tag(s)
- Example: Tag songs as "Zoe" (dog's name), create slideshow, select "Shuffle songs tagged: Zoe"

---

#### 7C. Track Reordering in Playlists
- Drag-and-drop reordering in PlaylistCreationModal and PlaylistEditModal
- Visual drag handles on each track
- Smooth animations during reorder
- Persist new order to storage

---

#### 7D. Playlist Playback Options
- Add `playbackMode` to CustomPlaylist:
  - `sequential` - Play in order added
  - `shuffle` - Randomize each time
  - `user-choice` - Prompt user when selecting for slideshow
- Add toggle in playlist creation/edit modal
- Show playback mode icon on playlist cards

---

#### 7E. Photo Library Management
- View all imported photos in a separate "Photo Library" view
- Remove photos from app library (not from device)
- Photo metadata (date imported, used in N slideshows)
- Bulk operations (select multiple, remove)
- Search/filter photos by date

---

#### 7F. Smart Slideshow Suggestions
- "Recently added photos" auto-slideshow
- "Photos from this month" auto-slideshow
- Seasonal playlists (holiday music with matching photos)
- "On this day" memories

---

#### 7G. Slideshow Templates
- Pre-configured settings for common use cases
- "Quick 1-minute" (12 photos, 5s each)
- "5-minute story" (60 photos, 5s each)
- "Long form 30-minute" (360 photos, 5s each)
- Custom templates (user-created)

---

#### 7H. Social Features
- Export slideshow as video file (MP4)
- Share via iOS share sheet
- QR code to view slideshow on another device
- Collaborative slideshows (multiple users contribute photos)

---

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
3. System photo picker opens immediately (multi-select enabled via @capacitor-community/media)
4. Select 15 photos → Tap "Add"
5. Configuration modal opens
6. See auto-generated name: "Slideshow-Nov-5-2024" in editable text field
7. Edit name to: "Summer Vacation 2024"
8. See thumbnail grid of 15 photos at top of modal
9. Tap "Choose Music" button
10. Music selector opens showing custom playlists
11. Select "Road Trip Tunes" custom playlist
12. Return to config modal
13. Adjust duration slider to 7 seconds
14. Shuffle toggle already on (keep it)
15. Tap "Save & Play"
16. Slideshow saves to local storage
17. Immediately starts playing full-screen
18. Player shows photos + music
19. After slideshow ends (or user closes), return to Slideshows tab
20. See new "Summer Vacation 2024" slideshow card in list with thumbnail

### Creating a Custom Playlist (from Spotify Playlist)
1. Open app → Music tab
2. Connect Spotify (if not already)
3. Scroll to "Custom Playlists" section (empty state)
4. Tap "New Playlist" button
5. Playlist creation modal opens
6. Enter name: "Mallory - Romantic"
7. Tap "Add Tracks"
8. Track picker modal opens with 3 tabs
9. Tap "From Playlists" tab
10. See list of user's Spotify playlists
11. Tap "Mallory - All Songs" playlist (the big diverse one)
12. See all tracks in that playlist
13. Scroll through and select 12 romantic tracks with checkboxes
14. Selection counter shows "12 tracks selected"
15. Tap "Done"
16. Return to playlist creation modal
17. See 12 tracks listed in order selected
18. Tap "Save"
19. Playlist "Mallory - Romantic" saves to local storage
20. See new playlist card in Custom Playlists section
21. Can now use this playlist in slideshows
22. Later, create "Mallory - Adventures" by repeating with different track selection

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
- **Slideshows:** Small JSON objects, ~1-5KB each (even with 800 photos, just storing IDs)
- **Playlists:** Small JSON objects, ~2-10KB each depending on track count
- **Estimated total:** ~100 slideshows + 50 playlists = ~1-2MB max
- **Large slideshow (800 photos):** Still only ~10KB (800 photo URIs + metadata)

Capacitor Preferences has no hard limit but recommend keeping under 5MB. We're well under that even with large slideshows.

### Performance Considerations
- Load slideshows/playlists on app start (async, don't block UI)
- Cache photo URIs to avoid repeated lookups
- Lazy load playlist track details (show name first, fetch details later)
- Debounce search inputs
- **Virtualize long lists** - Essential for 800-photo slideshows and large playlists
  - Use `react-window` or `react-virtualized` for photo grids
  - Only render visible items + small buffer
  - Dramatically improves scroll performance
- Photo thumbnail generation on-demand with caching
- Batch operations for storage updates

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

## Open Questions - ANSWERED ✅

1. **Creation flow preference:** ✅ **Photos first**, with auto-generated name (e.g., "Slideshow-Nov-5-2024") that's editable. Config screen comes after photo selection.

2. **Tab 3 removal:** ✅ **Comment out for MVP**, keep code intact. Future "Quick Play" feature planned (see Stage 7A) with 25/50/100 random photo options.

3. **Playlist behavior:** ✅ **Play in order added** for MVP. User choice per playlist can be a future enhancement (Stage 7D).

4. **Photo library management:** ✅ **No deletion from device photo library**. Users can only remove photos from individual slideshows. No write access to device photo library for MVP.

5. **Spotify playlists:** ✅ **Custom playlists only for slideshow music**. BUT users can browse their Spotify playlists to pick individual tracks when building custom playlists. Track picker has 3 tabs: Search, My Library, and From Playlists (browse Spotify playlists → select tracks from within).

6. **Slideshow limits:** ✅ **No limits**. User has 800-photo albums and wants to create slideshows from entire albums. Design for scale.

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
