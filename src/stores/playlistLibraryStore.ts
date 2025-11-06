/**
 * playlistLibraryStore - Zustand store for managing custom playlists
 */

import { create } from 'zustand';
import { CustomPlaylist, NewPlaylist, PlaylistUpdate } from '../types/playlist';
import { SpotifyTrack } from '../types';
import * as StorageService from '../services/StorageService';

interface PlaylistLibraryState {
  // State
  playlists: CustomPlaylist[];
  selectedPlaylist: CustomPlaylist | null;
  selectedTracks: SpotifyTrack[]; // Tracks being added to a new/edited playlist
  isLoading: boolean;
  error: string | null;

  // Actions
  loadPlaylists: () => Promise<void>;
  createPlaylist: (playlist: NewPlaylist) => Promise<CustomPlaylist>;
  updatePlaylist: (update: PlaylistUpdate) => Promise<CustomPlaylist | null>;
  deletePlaylist: (id: string) => Promise<boolean>;
  selectPlaylist: (playlist: CustomPlaylist | null) => void;
  addTrackToSelection: (track: SpotifyTrack) => void;
  removeTrackFromSelection: (trackId: string) => void;
  clearTrackSelection: () => void;
  setSelectedTracks: (tracks: SpotifyTrack[]) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

/**
 * Playlist library store
 * Manages the collection of custom playlists with persistence
 */
export const usePlaylistLibraryStore = create<PlaylistLibraryState>((set) => ({
  // Initial state
  playlists: [],
  selectedPlaylist: null,
  selectedTracks: [],
  isLoading: false,
  error: null,

  /**
   * Load all playlists from storage
   */
  loadPlaylists: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const playlists = await StorageService.getPlaylists();
      
      // Sort by most recently updated first
      playlists.sort((a, b) => b.updatedAt - a.updatedAt);
      
      set({ playlists, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load playlists';
      set({ error: errorMessage, isLoading: false });
    }
  },

  /**
   * Create a new playlist
   * @param playlist - New playlist data
   * @returns The created playlist with generated ID and timestamps
   */
  createPlaylist: async (playlist: NewPlaylist) => {
    set({ isLoading: true, error: null });
    
    try {
      const newPlaylist = await StorageService.savePlaylist(playlist);
      
      set((state) => ({
        playlists: [newPlaylist, ...state.playlists],
        isLoading: false,
      }));

      return newPlaylist;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create playlist';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  /**
   * Update an existing playlist
   * @param update - Partial playlist data with ID
   * @returns The updated playlist or null if not found
   */
  updatePlaylist: async (update: PlaylistUpdate) => {
    set({ error: null });
    
    try {
      const updated = await StorageService.updatePlaylist(update);
      
      if (!updated) {
        set({ error: 'Playlist not found' });
        return null;
      }

      set((state) => ({
        playlists: state.playlists.map(p => p.id === updated.id ? updated : p),
      }));

      return updated;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update playlist';
      set({ error: errorMessage });
      throw error;
    }
  },

  /**
   * Delete a playlist by ID
   * @param id - Playlist ID to delete
   * @returns True if deleted, false if not found
   */
  deletePlaylist: async (id: string) => {
    set({ error: null });
    
    try {
      const deleted = await StorageService.deletePlaylist(id);
      
      if (!deleted) {
        set({ error: 'Playlist not found' });
        return false;
      }

      set((state) => ({
        playlists: state.playlists.filter(p => p.id !== id),
        selectedPlaylist: state.selectedPlaylist?.id === id ? null : state.selectedPlaylist,
      }));

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete playlist';
      set({ error: errorMessage });
      throw error;
    }
  },

  /**
   * Select a playlist (for viewing/editing)
   * @param playlist - Playlist to select, or null to deselect
   */
  selectPlaylist: (playlist: CustomPlaylist | null) => {
    set({ selectedPlaylist: playlist });
  },

  /**
   * Add a track to the current selection
   * Used when building a new playlist or editing an existing one
   * @param track - Spotify track to add
   */
  addTrackToSelection: (track: SpotifyTrack) => {
    set((state) => {
      // Don't add duplicates
      if (state.selectedTracks.some(t => t.id === track.id)) {
        return state;
      }
      
      return {
        selectedTracks: [...state.selectedTracks, track],
      };
    });
  },

  /**
   * Remove a track from the current selection
   * @param trackId - ID of track to remove
   */
  removeTrackFromSelection: (trackId: string) => {
    set((state) => ({
      selectedTracks: state.selectedTracks.filter(t => t.id !== trackId),
    }));
  },

  /**
   * Clear all selected tracks
   */
  clearTrackSelection: () => {
    set({ selectedTracks: [] });
  },

  /**
   * Set selected tracks (replaces entire selection)
   * @param tracks - Array of tracks to set as selection
   */
  setSelectedTracks: (tracks: SpotifyTrack[]) => {
    set({ selectedTracks: tracks });
  },

  /**
   * Set error message
   * @param error - Error message or null to clear
   */
  setError: (error: string | null) => {
    set({ error });
  },

  /**
   * Clear error message
   */
  clearError: () => {
    set({ error: null });
  },
}));
