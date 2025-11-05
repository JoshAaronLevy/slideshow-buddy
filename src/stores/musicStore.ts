/**
 * musicStore - Zustand store for managing music selection state
 */

import { create } from 'zustand';
import { SpotifyPlaylist, SpotifyTrack } from '../types';
import * as SpotifyService from '../services/SpotifyService';

interface MusicState {
  // Data
  playlists: SpotifyPlaylist[];
  recentTracks: SpotifyTrack[];
  playlistTracks: SpotifyTrack[];
  featuredPlaylists: SpotifyPlaylist[];
  searchResults: {
    playlists: SpotifyPlaylist[];
    tracks: SpotifyTrack[];
  };
  
  // Selected music
  selectedPlaylist: SpotifyPlaylist | null;
  selectedTrack: SpotifyTrack | null;
  
  // UI state
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  
  // Actions
  fetchPlaylists: () => Promise<void>;
  fetchRecentTracks: () => Promise<void>;
  fetchFeaturedPlaylists: () => Promise<void>;
  fetchPlaylistTracks: (playlistId: string) => Promise<void>;
  searchMusic: (query: string) => Promise<void>;
  selectPlaylist: (playlist: SpotifyPlaylist) => void;
  selectTrack: (track: SpotifyTrack) => void;
  clearSelection: () => void;
  setSearchQuery: (query: string) => void;
  clearSearchResults: () => void;
  reset: () => void;
}

const initialState = {
  playlists: [],
  recentTracks: [],
  playlistTracks: [],
  featuredPlaylists: [],
  searchResults: { playlists: [], tracks: [] },
  selectedPlaylist: null,
  selectedTrack: null,
  isLoading: false,
  error: null,
  searchQuery: '',
};

export const useMusicStore = create<MusicState>((set) => ({
  ...initialState,

  fetchPlaylists: async () => {
    set({ isLoading: true, error: null });
    try {
      const playlists = await SpotifyService.fetchUserPlaylists();
      set({ playlists, isLoading: false });
    } catch (error) {
      console.error('Error fetching playlists:', error);
      set({
        error: 'Failed to load playlists. Please try again.',
        isLoading: false,
      });
    }
  },

  fetchRecentTracks: async () => {
    try {
      const recentTracks = await SpotifyService.fetchRecentlyPlayed(20);
      set({ recentTracks });
    } catch (error) {
      console.error('Error fetching recent tracks:', error);
      // Don't set error state for recent tracks - it's optional
    }
  },

  fetchFeaturedPlaylists: async () => {
    try {
      const featuredPlaylists = await SpotifyService.fetchFeaturedPlaylists(10);
      set({ featuredPlaylists });
    } catch (error) {
      console.error('Error fetching featured playlists:', error);
      // Don't set error state for featured playlists - it's optional
    }
  },

  fetchPlaylistTracks: async (playlistId: string) => {
    set({ isLoading: true, error: null });
    try {
      const playlistTracks = await SpotifyService.fetchPlaylistTracks(playlistId);
      set({ playlistTracks, isLoading: false });
    } catch (error) {
      console.error('Error fetching playlist tracks:', error);
      set({
        error: 'Failed to load playlist tracks. Please try again.',
        isLoading: false,
      });
    }
  },

  searchMusic: async (query: string) => {
    if (!query.trim()) {
      set({ searchResults: { playlists: [], tracks: [] } });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const searchResults = await SpotifyService.searchMusic(query);
      set({ searchResults, isLoading: false });
    } catch (error) {
      console.error('Error searching music:', error);
      set({
        error: 'Failed to search music. Please try again.',
        isLoading: false,
      });
    }
  },

  selectPlaylist: (playlist: SpotifyPlaylist) => {
    set({ selectedPlaylist: playlist, selectedTrack: null });
  },

  selectTrack: (track: SpotifyTrack) => {
    set({ selectedTrack: track });
  },

  clearSelection: () => {
    set({ selectedPlaylist: null, selectedTrack: null });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  clearSearchResults: () => {
    set({ searchResults: { playlists: [], tracks: [] }, searchQuery: '' });
  },

  reset: () => {
    set(initialState);
  },
}));
