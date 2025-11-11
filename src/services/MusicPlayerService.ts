/**
 * MusicPlayerService - Spotify Web Playback SDK integration
 */

import axios from 'axios';
import { getAccessToken } from './SpotifyAuthService';
import { SPOTIFY_CONFIG } from '../constants';

// Ensure Spotify types are available
import '../types/spotify-sdk.d.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let player: any | null = null; // Spotify.Player
let deviceId: string | null = null;
let sdkLoaded = false;
let sdkLoading = false;

/**
 * Load the Spotify Web Playback SDK script
 */
export const loadSpotifySDK = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (sdkLoaded && window.Spotify) {
      resolve();
      return;
    }

    // Check if already loading
    if (sdkLoading) {
      // Wait for the existing load to complete
      const checkInterval = setInterval(() => {
        if (sdkLoaded && window.Spotify) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      return;
    }

    sdkLoading = true;

    // Check if script already exists
    const existingScript = document.querySelector(
      'script[src="https://sdk.scdn.co/spotify-player.js"]'
    );
    
    if (existingScript) {
      // Script exists, wait for it to load
      window.onSpotifyWebPlaybackSDKReady = () => {
        sdkLoaded = true;
        sdkLoading = false;
        resolve();
      };
      return;
    }

    // Create and load the script
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;

    script.onerror = () => {
      sdkLoading = false;
      reject(new Error('Failed to load Spotify Web Playback SDK'));
    };

    window.onSpotifyWebPlaybackSDKReady = () => {
      sdkLoaded = true;
      sdkLoading = false;
      resolve();
    };

    document.body.appendChild(script);
  });
};

/**
 * Initialize the Spotify Web Playback player
 */
export const initializePlayer = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onStateChange?: (state: any | null) => void, // Spotify.WebPlaybackState
  onError?: (error: string) => void
): Promise<string> => {
  try {
    // Load SDK if not already loaded
    await loadSpotifySDK();

    if (!window.Spotify) {
      throw new Error('Spotify SDK not loaded');
    }

    // Get access token
    const token = await getAccessToken();
    if (!token) {
      throw new Error('No access token available');
    }

    // Disconnect existing player if any
    if (player) {
      player.disconnect();
      player = null;
      deviceId = null;
    }

    // Create new player
    player = new window.Spotify.Player({
      name: 'Slideshow Buddy',
      getOAuthToken: (callback) => {
        getAccessToken().then((token) => {
          if (token) {
            callback(token);
          }
        });
      },
      volume: 0.8,
    });

    // Set up event listeners
    player.addListener('ready', ({ device_id }: { device_id: string }) => {
      console.log('Spotify player ready with device ID:', device_id);
      deviceId = device_id;
    });

    player.addListener('not_ready', ({ device_id }: { device_id: string }) => {
      console.log('Spotify player not ready with device ID:', device_id);
      deviceId = null;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    player.addListener('player_state_changed', (state: any) => {
      if (onStateChange) {
        onStateChange(state);
      }
    });

    player.addListener('initialization_error', ({ message }: { message: string }) => {
      console.error('Spotify initialization error:', message);
      if (onError) {
        onError(`Initialization error: ${message}`);
      }
    });

    player.addListener('authentication_error', ({ message }: { message: string }) => {
      console.error('Spotify authentication error:', message);
      if (onError) {
        onError(`Authentication error: ${message}`);
      }
    });

    player.addListener('account_error', ({ message }: { message: string }) => {
      console.error('Spotify account error:', message);
      if (onError) {
        onError(`Account error: ${message}. Spotify Premium is required.`);
      }
    });

    player.addListener('playback_error', ({ message }: { message: string }) => {
      console.error('Spotify playback error:', message);
      if (onError) {
        onError(`Playback error: ${message}`);
      }
    });

    // Connect the player
    const connected = await player.connect();
    
    if (!connected) {
      throw new Error('Failed to connect Spotify player');
    }

    // Wait for device ID to be set
    let attempts = 0;
    while (!deviceId && attempts < 50) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    if (!deviceId) {
      throw new Error('Failed to get device ID');
    }

    return deviceId;
  } catch (error) {
    console.error('Error initializing Spotify player:', error);
    if (onError) {
      onError(error instanceof Error ? error.message : 'Failed to initialize player');
    }
    throw error;
  }
};

/**
 * Start playback with a playlist URI or array of track URIs
 */
export const startPlayback = async (
  uriOrUris: string | string[],
  isPlaylist: boolean = true
): Promise<void> => {
  try {
    if (!deviceId) {
      throw new Error('No device ID available. Please initialize player first.');
    }

    const token = await getAccessToken();
    if (!token) {
      throw new Error('No access token available');
    }

    const body: {
      context_uri?: string;
      uris?: string[];
    } = isPlaylist
      ? { context_uri: uriOrUris as string }
      : { uris: Array.isArray(uriOrUris) ? uriOrUris : [uriOrUris] };

    await axios.put(
      `${SPOTIFY_CONFIG.API_BASE_URL}/me/player/play?device_id=${deviceId}`,
      body,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Playback started successfully');
  } catch (error) {
    console.error('Error starting playback:', error);
    throw error;
  }
};

/**
 * Pause playback
 */
export const pausePlayback = async (): Promise<void> => {
  try {
    if (player) {
      await player.pause();
    }
  } catch (error) {
    console.error('Error pausing playback:', error);
    throw error;
  }
};

/**
 * Resume playback
 */
export const resumePlayback = async (): Promise<void> => {
  try {
    if (player) {
      await player.resume();
    }
  } catch (error) {
    console.error('Error resuming playback:', error);
    throw error;
  }
};

/**
 * Stop playback and transfer to another device (if available)
 */
export const stopPlayback = async (): Promise<void> => {
  try {
    if (player) {
      await player.pause();
    }
  } catch (error) {
    console.error('Error stopping playback:', error);
  }
};

/**
 * Get current playback state
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getCurrentState = async (): Promise<any | null> => { // Spotify.WebPlaybackState
  try {
    if (player) {
      return await player.getCurrentState();
    }
    return null;
  } catch (error) {
    console.error('Error getting current state:', error);
    return null;
  }
};

/**
 * Get current track information
 */
export const getCurrentTrack = async (): Promise<{
  name: string;
  artists: string[];
  album: string;
  imageUrl: string;
} | null> => {
  try {
    const state = await getCurrentState();
    if (!state || !state.track_window.current_track) {
      return null;
    }

    const track = state.track_window.current_track;
    return {
      name: track.name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      artists: track.artists.map((artist: any) => artist.name),
      album: track.album.name,
      imageUrl: track.album.images[0]?.url || '',
    };
  } catch (error) {
    console.error('Error getting current track:', error);
    return null;
  }
};

/**
 * Set playback volume
 */
export const setVolume = async (volume: number): Promise<void> => {
  try {
    if (player) {
      // Volume should be between 0 and 1
      const normalizedVolume = Math.max(0, Math.min(1, volume));
      await player.setVolume(normalizedVolume);
    }
  } catch (error) {
    console.error('Error setting volume:', error);
    throw error;
  }
};

/**
 * Get current volume
 */
export const getVolume = async (): Promise<number> => {
  try {
    if (player) {
      return await player.getVolume();
    }
    return 0;
  } catch (error) {
    console.error('Error getting volume:', error);
    return 0;
  }
};

/**
 * Next track
 */
export const nextTrack = async (): Promise<void> => {
  try {
    if (player) {
      await player.nextTrack();
    }
  } catch (error) {
    console.error('Error skipping to next track:', error);
    throw error;
  }
};

/**
 * Previous track
 */
export const previousTrack = async (): Promise<void> => {
  try {
    if (player) {
      await player.previousTrack();
    }
  } catch (error) {
    console.error('Error going to previous track:', error);
    throw error;
  }
};

/**
 * Cleanup and disconnect player
 */
export const cleanup = (): void => {
  try {
    if (player) {
      player.disconnect();
      player = null;
      deviceId = null;
    }
  } catch (error) {
    console.error('Error cleaning up player:', error);
  }
};

/**
 * Check if player is initialized
 */
export const isPlayerReady = (): boolean => {
  return player !== null && deviceId !== null;
};

/**
 * Get the current device ID
 */
export const getDeviceId = (): string | null => {
  return deviceId;
};
