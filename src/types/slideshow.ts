/**
 * Slideshow type definitions
 * Defines the structure for saved slideshows and music sources
 */

/**
 * Music source discriminated union
 * Represents different types of music that can be played during a slideshow
 */
export type MusicSource =
  | { type: 'custom-playlist'; playlistId: string }
  | { type: 'spotify-playlist'; playlistId: string }
  | { type: 'none' };

/**
 * Slideshow settings configuration
 */
export interface SlideshowSettings {
  transitionTime: number; // Seconds per slide (2-10)
  shuffle: boolean; // Randomize photo order
  loop: boolean; // Restart when finished
}

/**
 * Saved slideshow
 * Represents a complete slideshow with all metadata and settings
 */
export interface SavedSlideshow {
  id: string; // UUID
  name: string; // User-defined name
  photoIds: string[]; // IDs of photos from photo library
  musicSource: MusicSource; // What music to play
  settings: SlideshowSettings; // Playback settings
  thumbnailUri?: string; // First photo URI for display
  createdAt: number; // Timestamp (ms since epoch)
  updatedAt: number; // Timestamp (ms since epoch)
  lastPlayedAt?: number; // Timestamp (ms since epoch)
  playCount: number; // How many times this slideshow has been played
}

/**
 * Helper type for creating a new slideshow
 * Makes optional fields that will be auto-generated
 */
export type NewSlideshow = Omit<SavedSlideshow, 'id' | 'createdAt' | 'updatedAt' | 'playCount' | 'lastPlayedAt'> & {
  id?: string;
  createdAt?: number;
  updatedAt?: number;
  playCount?: number;
};

/**
 * Helper type for updating an existing slideshow
 * All fields except id are optional
 */
export type SlideshowUpdate = Partial<Omit<SavedSlideshow, 'id' | 'createdAt'>> & {
  id: string;
};
