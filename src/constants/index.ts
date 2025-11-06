/**
 * Application-wide constants
 */

/**
 * Spotify API configuration
 * Note: CLIENT_ID should be set via environment variable in production
 */
export const SPOTIFY_CONFIG = {
  CLIENT_ID: import.meta.env.VITE_SPOTIFY_CLIENT_ID || '',
  REDIRECT_URI: 'com.slideshowbuddy://callback',
  SCOPES: [
    'user-read-private',
    'user-read-email',
    'playlist-read-private',
    'playlist-read-collaborative',
    'user-read-recently-played',
    'streaming',
    'user-read-playback-state',
    'user-modify-playback-state',
  ].join(' '),
  AUTH_URL: 'https://accounts.spotify.com/authorize',
  TOKEN_URL: 'https://accounts.spotify.com/api/token',
  API_BASE_URL: 'https://api.spotify.com/v1',
};

/**
 * Slideshow default settings
 */
export const SLIDESHOW_DEFAULTS = {
  TRANSITION_TIME: 5, // seconds
  MIN_TRANSITION_TIME: 2,
  MAX_TRANSITION_TIME: 10,
  SHUFFLE_ENABLED: true,
  LOOP_ENABLED: false,
};

/**
 * Storage keys for Capacitor Preferences
 */
export const STORAGE_KEYS = {
  SPOTIFY_ACCESS_TOKEN: 'spotify_access_token',
  SPOTIFY_REFRESH_TOKEN: 'spotify_refresh_token',
  SPOTIFY_TOKEN_EXPIRY: 'spotify_token_expiry',
  SPOTIFY_USER: 'spotify_user',
  LAST_SELECTED_MUSIC: 'last_selected_music',
  SLIDESHOW_SETTINGS: 'slideshow_settings',
};

/**
 * UI constants
 */
export const UI_CONSTANTS = {
  PHOTO_GRID_COLUMNS: 3,
  DEBOUNCE_DELAY: 300, // ms for search input
  TOAST_DURATION: 3000, // ms
};

/**
 * Color scheme matching design guidelines
 */
export const COLORS = {
  SPOTIFY_GREEN: '#1DB954',
  PRIMARY_PURPLE: '#6366F1',
  PRIMARY_BLUE: '#3B82F6',
};
