/**
 * PlaylistDetailModal - Modal view for selecting tracks from a playlist
 */

import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonSpinner,
  IonText,
  IonBadge,
} from '@ionic/react';
import { closeOutline, checkmarkCircle, musicalNotesSharp, timeOutline } from 'ionicons/icons';
import { useEffect } from 'react';
import { useMusicStore } from '../stores/musicStore';
import { SpotifyPlaylist, SpotifyTrack } from '../types';
import './PlaylistDetailModal.css';

interface PlaylistDetailModalProps {
  isOpen: boolean;
  playlist: SpotifyPlaylist | null;
  onDismiss: () => void;
}

/**
 * Format duration from milliseconds to MM:SS
 */
const formatDuration = (durationMs: number): string => {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const PlaylistDetailModal: React.FC<PlaylistDetailModalProps> = ({
  isOpen,
  playlist,
  onDismiss,
}) => {
  const {
    playlistTracks,
    selectedTrack,
    isLoading,
    error,
    fetchPlaylistTracks,
    selectTrack,
  } = useMusicStore();

  // Fetch tracks when playlist changes
  useEffect(() => {
    if (isOpen && playlist) {
      fetchPlaylistTracks(playlist.id);
    }
  }, [isOpen, playlist, fetchPlaylistTracks]);

  const handleTrackSelect = (track: SpotifyTrack) => {
    selectTrack(track);
    // Could auto-dismiss after selection, but leaving it open for now
    // so users can see the selection was made
  };

  if (!playlist) {
    return null;
  }

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{playlist.name}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onDismiss}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {/* Playlist Header */}
        <div className="playlist-detail-header">
          {playlist.image_url ? (
            <img
              src={playlist.image_url}
              alt={playlist.name}
              className="playlist-detail-cover"
            />
          ) : (
            <div className="playlist-detail-cover-placeholder">
              <IonIcon icon={musicalNotesSharp} />
            </div>
          )}
          <h2>{playlist.name}</h2>
          {playlist.description && (
            <p className="playlist-description">{playlist.description}</p>
          )}
          <div className="playlist-meta">
            <IonBadge color="medium">
              {playlist.track_count} tracks
            </IonBadge>
            <IonBadge color="medium">
              by {playlist.owner}
            </IonBadge>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="playlist-loading">
            <IonSpinner name="crescent" />
            <IonText>Loading tracks...</IonText>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="playlist-error">
            <IonText color="danger">
              <p>{error}</p>
            </IonText>
          </div>
        )}

        {/* Track List */}
        {!isLoading && !error && playlistTracks.length > 0 && (
          <IonList lines="none" className="track-list">
            {playlistTracks.map((track, index) => (
              <IonItem
                key={track.id}
                button
                onClick={() => handleTrackSelect(track)}
                className={`track-list-item ${
                  selectedTrack?.id === track.id ? 'selected' : ''
                }`}
              >
                <div slot="start" className="track-number">
                  {selectedTrack?.id === track.id ? (
                    <IonIcon icon={checkmarkCircle} color="success" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                <IonLabel>
                  <h3 className="track-name">{track.name}</h3>
                  <p className="track-artist">{track.artists.join(', ')}</p>
                </IonLabel>

                <div slot="end" className="track-duration">
                  <IonIcon icon={timeOutline} />
                  <span>{formatDuration(track.duration_ms)}</span>
                </div>
              </IonItem>
            ))}
          </IonList>
        )}

        {/* Empty State */}
        {!isLoading && !error && playlistTracks.length === 0 && (
          <div className="playlist-empty">
            <IonIcon icon={musicalNotesSharp} />
            <IonText color="medium">
              <p>This playlist has no tracks</p>
            </IonText>
          </div>
        )}
      </IonContent>
    </IonModal>
  );
};

export default PlaylistDetailModal;
