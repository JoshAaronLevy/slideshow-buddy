/**
 * TrackPickerModal - Multi-select tracks from Spotify
 * Supports 3 modes: Search, My Library, From Playlists
 */

import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonIcon,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonSearchbar,
  IonList,
  IonItem,
  IonCheckbox,
  IonText,
  IonFooter,
  IonBadge,
  IonSpinner,
  IonNote,
} from '@ionic/react';
import {
  close,
  search,
  musicalNote,
  albums,
  checkmarkCircle,
  playCircle,
  chevronForward,
  chevronBack,
} from 'ionicons/icons';
import { useState, useEffect } from 'react';
import { SpotifyTrack, SpotifyPlaylist } from '../types';
import * as SpotifyService from '../services/SpotifyService';
import * as HapticService from '../services/HapticService';
import './TrackPickerModal.css';

interface TrackPickerModalProps {
  isOpen: boolean;
  selectedTrackIds: string[];
  onDismiss: () => void;
  onConfirm: (trackIds: string[], tracks: SpotifyTrack[]) => void;
}

type TabType = 'search' | 'library' | 'playlists';

/**
 * Format track duration
 */
const formatDuration = (ms: number): string => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * TrackPickerModal Component
 */
const TrackPickerModal: React.FC<TrackPickerModalProps> = ({
  isOpen,
  selectedTrackIds,
  onDismiss,
  onConfirm,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [libraryTracks, setLibraryTracks] = useState<SpotifyTrack[]>([]);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<SpotifyPlaylist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<SpotifyTrack[]>([]);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [selectedTracks, setSelectedTracks] = useState<SpotifyTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize selection from props
  useEffect(() => {
    if (isOpen) {
      setSelection(new Set(selectedTrackIds));
      setSelectedPlaylist(null);
      setSearchQuery('');
    }
  }, [isOpen, selectedTrackIds]);

  // Load library tracks when Library tab is selected
  useEffect(() => {
    if (isOpen && activeTab === 'library' && libraryTracks.length === 0) {
      loadLibraryTracks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeTab]);

  // Load playlists when Playlists tab is selected
  useEffect(() => {
    if (isOpen && activeTab === 'playlists' && playlists.length === 0) {
      loadPlaylists();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeTab]);

  // Update selectedTracks array when selection changes
  useEffect(() => {
    const allTracks = [...searchResults, ...libraryTracks, ...playlistTracks];
    const tracks = Array.from(selection)
      .map(id => allTracks.find(t => t.id === id))
      .filter((t): t is SpotifyTrack => t !== undefined);
    setSelectedTracks(tracks);
  }, [selection, searchResults, libraryTracks, playlistTracks]);

  const loadLibraryTracks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Use recently played as a proxy for library (SpotifyService doesn't have getUserSavedTracks yet)
      const tracks = await SpotifyService.fetchRecentlyPlayed(50);
      setLibraryTracks(tracks);
    } catch (err) {
      setError('Failed to load library tracks');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPlaylists = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const userPlaylists = await SpotifyService.fetchUserPlaylists();
      setPlaylists(userPlaylists);
    } catch (err) {
      setError('Failed to load playlists');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPlaylistTracks = async (playlistId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const tracks = await SpotifyService.fetchPlaylistTracks(playlistId);
      setPlaylistTracks(tracks);
    } catch (err) {
      setError('Failed to load playlist tracks');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      const results = await SpotifyService.searchMusic(searchQuery);
      // searchMusic returns both tracks and playlists, we only want tracks
      setSearchResults(results.tracks);
    } catch (err) {
      setError('Search failed');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = (tab: TabType) => {
    HapticService.impactLight();
    setActiveTab(tab);
    setSelectedPlaylist(null);
  };

  const handleTrackToggle = (track: SpotifyTrack) => {
    HapticService.impactLight();
    const newSelection = new Set(selection);
    if (newSelection.has(track.id)) {
      newSelection.delete(track.id);
    } else {
      newSelection.add(track.id);
    }
    setSelection(newSelection);
  };

  const handlePlaylistSelect = async (playlist: SpotifyPlaylist) => {
    HapticService.impactMedium();
    setSelectedPlaylist(playlist);
    await loadPlaylistTracks(playlist.id);
  };

  const handleBackToPlaylists = () => {
    HapticService.impactLight();
    setSelectedPlaylist(null);
    setPlaylistTracks([]);
  };

  const handleConfirm = () => {
    HapticService.impactMedium();
    onConfirm(Array.from(selection), selectedTracks);
  };

  const handleDismiss = () => {
    HapticService.impactLight();
    onDismiss();
  };

  const renderTrackItem = (track: SpotifyTrack) => {
    const isSelected = selection.has(track.id);

    return (
      <IonItem key={track.id} button onClick={() => handleTrackToggle(track)}>
        <IonCheckbox
          slot="start"
          checked={isSelected}
          onIonChange={() => handleTrackToggle(track)}
        />
        <IonLabel>
          <h3>{track.name}</h3>
          <p>{track.artists.join(', ')}</p>
          <IonNote>{track.album} • {formatDuration(track.duration_ms)}</IonNote>
        </IonLabel>
        {track.preview_url && (
          <IonIcon icon={playCircle} slot="end" color="medium" />
        )}
      </IonItem>
    );
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={handleDismiss}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Add Tracks</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleDismiss}>
              <IonIcon icon={close} />
            </IonButton>
          </IonButtons>
        </IonToolbar>

        {/* Tab Selector */}
        <IonToolbar>
          <IonSegment value={activeTab} onIonChange={(e) => handleTabChange(e.detail.value as TabType)}>
            <IonSegmentButton value="search">
              <IonIcon icon={search} />
              <IonLabel>Search</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="library">
              <IonIcon icon={musicalNote} />
              <IonLabel>My Library</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="playlists">
              <IonIcon icon={albums} />
              <IonLabel>Playlists</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </IonToolbar>

        {/* Search Bar (Search tab only) */}
        {activeTab === 'search' && (
          <IonToolbar>
            <IonSearchbar
              value={searchQuery}
              onIonInput={(e) => setSearchQuery(e.detail.value || '')}
              onIonChange={handleSearch}
              placeholder="Search tracks..."
              debounce={500}
            />
          </IonToolbar>
        )}

        {/* Playlist breadcrumb (Playlists tab when viewing tracks) */}
        {activeTab === 'playlists' && selectedPlaylist && (
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={handleBackToPlaylists}>
                <IonIcon icon={chevronBack} />
                Back
              </IonButton>
            </IonButtons>
            <IonTitle size="small">{selectedPlaylist.name}</IonTitle>
          </IonToolbar>
        )}
      </IonHeader>

      <IonContent>
        {/* Loading State */}
        {isLoading && (
          <div className="track-picker-loading">
            <IonSpinner />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="track-picker-error">
            <IonText color="danger">
              <p>{error}</p>
            </IonText>
          </div>
        )}

        {/* Search Tab Content */}
        {activeTab === 'search' && !isLoading && (
          <IonList>
            {searchResults.length === 0 && searchQuery && (
              <div className="track-picker-empty">
                <IonIcon icon={search} />
                <IonText color="medium">
                  <p>No results found</p>
                </IonText>
              </div>
            )}
            {searchResults.length === 0 && !searchQuery && (
              <div className="track-picker-empty">
                <IonIcon icon={search} />
                <IonText color="medium">
                  <p>Search for tracks on Spotify</p>
                </IonText>
              </div>
            )}
            {searchResults.map(renderTrackItem)}
          </IonList>
        )}

        {/* Library Tab Content */}
        {activeTab === 'library' && !isLoading && (
          <IonList>
            {libraryTracks.length === 0 && (
              <div className="track-picker-empty">
                <IonIcon icon={musicalNote} />
                <IonText color="medium">
                  <p>No saved tracks found</p>
                </IonText>
              </div>
            )}
            {libraryTracks.map(renderTrackItem)}
          </IonList>
        )}

        {/* Playlists Tab Content */}
        {activeTab === 'playlists' && !isLoading && (
          <>
            {/* Playlist List */}
            {!selectedPlaylist && (
              <IonList>
                {playlists.length === 0 && (
                  <div className="track-picker-empty">
                    <IonIcon icon={albums} />
                    <IonText color="medium">
                      <p>No playlists found</p>
                    </IonText>
                  </div>
                )}
                {playlists.map((playlist) => (
                  <IonItem key={playlist.id} button onClick={() => handlePlaylistSelect(playlist)}>
                    <IonIcon icon={albums} slot="start" color="primary" />
                    <IonLabel>
                      <h3>{playlist.name}</h3>
                      <p>{playlist.track_count} tracks</p>
                    </IonLabel>
                    <IonIcon icon={chevronForward} slot="end" color="medium" />
                  </IonItem>
                ))}
              </IonList>
            )}

            {/* Playlist Tracks */}
            {selectedPlaylist && (
              <IonList>
                {playlistTracks.length === 0 && (
                  <div className="track-picker-empty">
                    <IonIcon icon={musicalNote} />
                    <IonText color="medium">
                      <p>No tracks in this playlist</p>
                    </IonText>
                  </div>
                )}
                {playlistTracks.map(renderTrackItem)}
              </IonList>
            )}
          </>
        )}
      </IonContent>

      {/* Footer with selection count and confirm button */}
      <IonFooter>
        <IonToolbar>
          <div className="track-picker-footer">
            <div className="selection-info">
              {selection.size > 0 && (
                <IonBadge color="primary">
                  {selection.size} selected
                </IonBadge>
              )}
            </div>
            <IonButton
              expand="block"
              onClick={handleConfirm}
              disabled={selection.size === 0}
            >
              <IonIcon icon={checkmarkCircle} slot="start" />
              Done
            </IonButton>
          </div>
        </IonToolbar>
      </IonFooter>
    </IonModal>
  );
};

export default TrackPickerModal;
