/**
 * SpotifyService - Handles Spotify API calls for music data
 */

import axios from 'axios';
import { SPOTIFY_CONFIG } from '../constants';
import { SpotifyPlaylist, SpotifyTrack } from '../types';
import {
  SpotifyApiPlaylist,
  SpotifyApiPlaylistItem,
  SpotifyApiRecentlyPlayedItem,
  SpotifyApiArtist,
  SpotifyApiTrackSearchItem,
} from '../types/spotify-api';
import { getAccessToken } from './SpotifyAuthService';

/**
 * Get authorization headers for Spotify API requests
 */
const getAuthHeaders = async () => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('No access token available');
  }
  return {
    Authorization: `Bearer ${token}`,
  };
};

/**
 * Fetch user's playlists
 * @param limit - Number of playlists to fetch per page (default 50)
 * @param offset - Offset for pagination (default 0)
 */
export const fetchUserPlaylists = async (
  limit: number = 50,
  offset: number = 0
): Promise<SpotifyPlaylist[]> => {
  try {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${SPOTIFY_CONFIG.API_BASE_URL}/me/playlists`, {
      headers,
      params: { limit, offset },
    });

    if (!response.data || !response.data.items) {
      return [];
    }

    return response.data.items.map((item: SpotifyApiPlaylist) => ({
      id: item.id,
      name: item.name,
      description: item.description || '',
      images: item.images || [],
      owner: item.owner?.display_name || 'Unknown',
      trackCount: item.tracks?.total || 0,
      uri: item.uri,
    }));
  } catch (error) {
    console.error('Error fetching playlists:', error);
    throw new Error('Failed to fetch playlists');
  }
};

/**
 * Fetch tracks from a playlist
 * @param playlistId - Spotify playlist ID
 */
export const fetchPlaylistTracks = async (playlistId: string): Promise<SpotifyTrack[]> => {
  try {
    const headers = await getAuthHeaders();
    const response = await axios.get(
      `${SPOTIFY_CONFIG.API_BASE_URL}/playlists/${playlistId}/tracks`,
      {
        headers,
        params: { limit: 100 },
      }
    );

    return response.data.items
      .filter((item: SpotifyApiPlaylistItem) => item.track !== null) // Filter out null tracks
      .map((item: SpotifyApiPlaylistItem) => {
        const track = item.track!; // Non-null assertion after filter
        return {
          id: track.id,
          name: track.name,
          artists: track.artists?.map((artist: SpotifyApiArtist) => artist.name) || [],
          album: track.album?.name || '',
          uri: track.uri,
          duration_ms: track.duration_ms || 0,
          preview_url: track.preview_url,
        };
      });
  } catch (error) {
    console.error('Error fetching playlist tracks:', error);
    throw new Error('Failed to fetch playlist tracks');
  }
};

/**
 * Search for playlists and tracks
 * @param query - Search query string
 * @param type - Type to search (playlist, track, or both)
 */
export const searchMusic = async (
  query: string,
  type: 'playlist' | 'track' | 'playlist,track' = 'playlist,track'
): Promise<{
  playlists: SpotifyPlaylist[];
  tracks: SpotifyTrack[];
}> => {
  try {
    if (!query.trim()) {
      return { playlists: [], tracks: [] };
    }

    const headers = await getAuthHeaders();
    const response = await axios.get(`${SPOTIFY_CONFIG.API_BASE_URL}/search`, {
      headers,
      params: {
        q: query,
        type,
        limit: 20,
      },
    });

    const playlists =
      response.data.playlists?.items.map((item: SpotifyApiPlaylist) => ({
        id: item.id,
        name: item.name,
        description: item.description || '',
        image_url: item.images?.[0]?.url || '',
        track_count: item.tracks?.total || 0,
        uri: item.uri,
        owner: item.owner?.display_name || 'Unknown',
      })) || [];

    const tracks =
      response.data.tracks?.items.map((item: SpotifyApiTrackSearchItem) => ({
        id: item.id,
        name: item.name,
        artists: item.artists?.map((artist: SpotifyApiArtist) => artist.name) || [],
        album: item.album?.name || '',
        uri: item.uri,
        duration_ms: item.duration_ms || 0,
        preview_url: item.preview_url,
      })) || [];

    return { playlists, tracks };
  } catch (error) {
    console.error('Error searching music:', error);
    throw new Error('Failed to search music');
  }
};

/**
 * Get user's recently played tracks
 * @param limit - Number of tracks to fetch (default 20)
 */
export const fetchRecentlyPlayed = async (limit: number = 20): Promise<SpotifyTrack[]> => {
  try {
    const headers = await getAuthHeaders();
    const response = await axios.get(
      `${SPOTIFY_CONFIG.API_BASE_URL}/me/player/recently-played`,
      {
        headers,
        params: { limit },
      }
    );

    return response.data.items.map((item: SpotifyApiRecentlyPlayedItem) => ({
      id: item.track.id,
      name: item.track.name,
      artists: item.track.artists?.map((artist: SpotifyApiArtist) => artist.name) || [],
      album: item.track.album?.name || '',
      uri: item.track.uri,
      duration_ms: item.track.duration_ms || 0,
      preview_url: item.track.preview_url,
    }));
  } catch (error) {
    console.error('Error fetching recently played:', error);
    // Return empty array if user hasn't played anything yet
    return [];
  }
};

/**
 * Get a single playlist by ID
 * @param playlistId - Spotify playlist ID
 */
export const fetchPlaylist = async (playlistId: string): Promise<SpotifyPlaylist> => {
  try {
    const headers = await getAuthHeaders();
    const response = await axios.get(
      `${SPOTIFY_CONFIG.API_BASE_URL}/playlists/${playlistId}`,
      { headers }
    );

    return {
      id: response.data.id,
      name: response.data.name,
      description: response.data.description || '',
      image_url: response.data.images?.[0]?.url || '',
      track_count: response.data.tracks?.total || 0,
      uri: response.data.uri,
      owner: response.data.owner?.display_name || 'Unknown',
    };
  } catch (error) {
    console.error('Error fetching playlist:', error);
    throw new Error('Failed to fetch playlist');
  }
};

/**
 * Get featured playlists (curated by Spotify)
 * @param limit - Number of playlists to fetch
 */
export const fetchFeaturedPlaylists = async (limit: number = 20): Promise<SpotifyPlaylist[]> => {
  try {
    const headers = await getAuthHeaders();
    const response = await axios.get(
      `${SPOTIFY_CONFIG.API_BASE_URL}/browse/featured-playlists`,
      {
        headers,
        params: { limit },
      }
    );

    return response.data.playlists.items.map((item: SpotifyApiPlaylist) => ({
      id: item.id,
      name: item.name,
      description: item.description || '',
      image_url: item.images?.[0]?.url || '',
      track_count: item.tracks?.total || 0,
      uri: item.uri,
      owner: item.owner?.display_name || 'Spotify',
    }));
  } catch (error) {
    console.error('Error fetching featured playlists:', error);
    return [];
  }
};
