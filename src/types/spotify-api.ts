/**
 * Spotify API Response Types
 * These types match the Spotify Web API response structure
 */

export interface SpotifyApiImage {
  url: string;
  height: number;
  width: number;
}

export interface SpotifyApiArtist {
  id: string;
  name: string;
  uri: string;
}

export interface SpotifyApiAlbum {
  id: string;
  name: string;
  images?: SpotifyApiImage[];
}

export interface SpotifyApiOwner {
  display_name: string;
  id: string;
}

export interface SpotifyApiTrack {
  id: string;
  name: string;
  artists?: SpotifyApiArtist[];
  album?: SpotifyApiAlbum;
  uri: string;
  duration_ms: number;
  preview_url?: string;
}

export interface SpotifyApiPlaylistItem {
  track: SpotifyApiTrack | null;
}

export interface SpotifyApiPlaylist {
  id: string;
  name: string;
  description?: string;
  images?: SpotifyApiImage[];
  tracks?: {
    total: number;
  };
  uri: string;
  owner?: SpotifyApiOwner;
}

export interface SpotifyApiRecentlyPlayedItem {
  track: SpotifyApiTrack;
  played_at: string;
}

// Track item returned from search endpoint (slightly different structure)
export interface SpotifyApiTrackSearchItem {
  id: string;
  name: string;
  artists: SpotifyApiArtist[];
  album: SpotifyApiAlbum;
  uri: string;
  duration_ms: number;
  preview_url: string | null;
}
