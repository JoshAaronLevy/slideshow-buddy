/**
 * PlaylistEditModal - Edit existing custom playlist
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
  IonInput,
  IonIcon,
  IonText,
  IonFooter,
  IonReorderGroup,
  IonReorder,
  ItemReorderEventDetail,
} from '@ionic/react';
import {
  close,
  addCircleOutline,
  musicalNotesOutline,
  trashOutline,
  checkmarkCircle,
  reorderTwo,
} from 'ionicons/icons';
import { useState, useEffect } from 'react';
import { CustomPlaylist } from '../types/playlist';
import { SpotifyTrack } from '../types';
import * as HapticService from '../services/HapticService';
import TrackPickerModal from './TrackPickerModal';
import './PlaylistEditModal.css';

interface PlaylistEditModalProps {
  isOpen: boolean;
  playlist: CustomPlaylist | null;
  onDismiss: () => void;
  onSave: (updatedPlaylist: CustomPlaylist) => void;
}

/**
 * Format track duration
 */
const formatDuration = (ms: number): string => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * PlaylistEditModal Component
 */
const PlaylistEditModal: React.FC<PlaylistEditModalProps> = ({
  isOpen,
  playlist,
  onDismiss,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [showTrackPicker, setShowTrackPicker] = useState(false);

  // Initialize with playlist data when modal opens or playlist changes
  useEffect(() => {
    if (isOpen && playlist) {
      setName(playlist.name);
      setTracks(playlist.tracks);
    }
  }, [isOpen, playlist]);

  const handleDismiss = () => {
    HapticService.impactLight();
    onDismiss();
  };

  const handleAddTracks = () => {
    HapticService.impactMedium();
    setShowTrackPicker(true);
  };

  const handleTracksSelected = (trackIds: string[], selectedTracks: SpotifyTrack[]) => {
    // Add only new tracks (avoid duplicates)
    const existingIds = new Set(tracks.map(t => t.id));
    const newTracks = selectedTracks.filter(t => !existingIds.has(t.id));
    setTracks([...tracks, ...newTracks]);
    setShowTrackPicker(false);
  };

  const handleRemoveTrack = (trackId: string) => {
    HapticService.impactLight();
    setTracks(tracks.filter(t => t.id !== trackId));
  };

  const handleReorder = (event: CustomEvent<ItemReorderEventDetail>) => {
    const reorderedTracks = [...tracks];
    const [movedTrack] = reorderedTracks.splice(event.detail.from, 1);
    reorderedTracks.splice(event.detail.to, 0, movedTrack);
    setTracks(reorderedTracks);
    event.detail.complete();
  };

  const handleSave = () => {
    if (!playlist) return;

    HapticService.impactMedium();

    const updatedPlaylist: CustomPlaylist = {
      ...playlist,
      name: name.trim() || playlist.name,
      trackIds: tracks.map(t => t.id),
      tracks,
      updatedAt: Date.now(),
    };

    onSave(updatedPlaylist);
  };

  const canSave = playlist && name.trim().length > 0 && tracks.length > 0;

  if (!playlist) {
    return null;
  }

  return (
    <>
      <IonModal isOpen={isOpen} onDidDismiss={handleDismiss}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Edit Playlist</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={handleDismiss}>
                <IonIcon icon={close} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>

        <IonContent>
          {/* Playlist Info */}
          <div className="edit-playlist-info">
            <IonIcon icon={musicalNotesOutline} className="playlist-icon" />
            <IonText color="medium">
              <p>Created {new Date(playlist.createdAt).toLocaleDateString()}</p>
              {playlist.playCount && playlist.playCount > 0 && (
                <p>Used in {playlist.playCount} {playlist.playCount === 1 ? 'slideshow' : 'slideshows'}</p>
              )}
            </IonText>
          </div>

          {/* Playlist Name Input */}
          <IonList>
            <IonItem>
              <IonLabel position="stacked">Playlist Name</IonLabel>
              <IonInput
                value={name}
                onIonInput={(e) => setName(e.detail.value || '')}
                placeholder="Enter playlist name"
                clearInput
              />
            </IonItem>
          </IonList>

          {/* Add Tracks Button */}
          <div className="add-tracks-section">
            <IonButton expand="block" onClick={handleAddTracks}>
              <IonIcon icon={addCircleOutline} slot="start" />
              Add More Tracks
            </IonButton>
            {tracks.length > 0 && (
              <IonText color="medium">
                <p>{tracks.length} {tracks.length === 1 ? 'track' : 'tracks'} in playlist</p>
              </IonText>
            )}
          </div>

          {/* Track List */}
          {tracks.length === 0 && (
            <div className="empty-tracks-state">
              <IonIcon icon={musicalNotesOutline} />
              <IonText color="medium">
                <p>No tracks</p>
                <p className="empty-hint">Add tracks to save this playlist</p>
              </IonText>
            </div>
          )}

          {tracks.length > 0 && (
            <IonList>
              <IonReorderGroup disabled={false} onIonItemReorder={handleReorder}>
                {tracks.map((track) => (
                  <IonItem key={track.id}>
                    <IonReorder slot="start">
                      <IonIcon icon={reorderTwo} />
                    </IonReorder>
                    <IonLabel>
                      <h3>{track.name}</h3>
                      <p>{track.artists.join(', ')}</p>
                      <small>{track.album} • {formatDuration(track.duration_ms)}</small>
                    </IonLabel>
                    <IonButton
                      fill="clear"
                      color="danger"
                      slot="end"
                      onClick={() => handleRemoveTrack(track.id)}
                    >
                      <IonIcon icon={trashOutline} slot="icon-only" />
                    </IonButton>
                  </IonItem>
                ))}
              </IonReorderGroup>
            </IonList>
          )}
        </IonContent>

        {/* Footer with Save button */}
        <IonFooter>
          <IonToolbar>
            <IonButton
              expand="block"
              onClick={handleSave}
              disabled={!canSave}
              style={{ margin: '12px 16px' }}
            >
              <IonIcon icon={checkmarkCircle} slot="start" />
              Save Changes
            </IonButton>
          </IonToolbar>
        </IonFooter>
      </IonModal>

      {/* Track Picker Modal */}
      <TrackPickerModal
        isOpen={showTrackPicker}
        selectedTrackIds={tracks.map(t => t.id)}
        onDismiss={() => setShowTrackPicker(false)}
        onConfirm={handleTracksSelected}
      />
    </>
  );
};

export default PlaylistEditModal;
