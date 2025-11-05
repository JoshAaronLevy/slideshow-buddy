/**
 * Core type definitions for Slideshow Buddy
 */

/**
 * Represents a photo from the user's library
 */
export interface Photo {
  id: string;
  uri: string;
  filename: string;
  timestamp: number;
  selected: boolean;
}

/**
 * Represents a Spotify track
 */
export interface SpotifyTrack {
  id: string;
  name: string;
  artists: string[];
  album: string;
  uri: string;
  duration_ms: number;
  preview_url?: string;
}

/**
 * Represents a Spotify playlist
 */
export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  image_url: string;
  track_count: number;
  uri: string;
  owner: string;
}

/**
 * Represents a Spotify user
 */
export interface SpotifyUser {
  id: string;
  display_name: string;
  email?: string;
  images?: Array<{ url: string }>;
  product?: 'premium' | 'free' | 'open';
}

/**
 * Configuration for a slideshow
 */
export interface SlideshowConfig {
  photos: Photo[];
  shuffle: boolean;
  transitionTime: number; // in seconds
  musicSource: SpotifyPlaylist | SpotifyTrack;
  loop?: boolean;
}

/**
 * Authentication tokens from Spotify
 */
export interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  expires_at: number; // timestamp when token expires
}

/**
 * Music source type discriminator
 */
export type MusicSource = 
  | { type: 'playlist'; data: SpotifyPlaylist }
  | { type: 'track'; data: SpotifyTrack };

/**
 * Error types for better error handling
 */
export interface AppError {
  code: string;
  message: string;
  details?: unknown;
}
