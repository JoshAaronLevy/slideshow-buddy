/**
 * Playlist type definitions
 * Defines the structure for custom playlists created from Spotify tracks
 */

import { SpotifyTrack } from './index';

/**
 * Custom playlist
 * Represents a user-created playlist with tracks from Spotify
 * Stored locally, not synced to Spotify
 */
export interface CustomPlaylist {
  id: string; // UUID
  name: string; // User-defined name
  trackIds: string[]; // Spotify track IDs in play order
  tracks: SpotifyTrack[]; // Full track objects (cached for performance)
  tags?: string[]; // Optional tags for organization (future feature)
  thumbnailUri?: string; // Album art from first track
  createdAt: number; // Timestamp (ms since epoch)
  updatedAt: number; // Timestamp (ms since epoch)
  playCount?: number; // How many times used in slideshows (future metric)
}

/**
 * Helper type for creating a new playlist
 * Makes optional fields that will be auto-generated
 */
export type NewPlaylist = Omit<CustomPlaylist, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
  createdAt?: number;
  updatedAt?: number;
};

/**
 * Helper type for updating an existing playlist
 * All fields except id are optional
 */
export type PlaylistUpdate = Partial<Omit<CustomPlaylist, 'id' | 'createdAt'>> & {
  id: string;
};
