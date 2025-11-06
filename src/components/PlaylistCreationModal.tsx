/**
 * PlaylistCreationModal - Create new custom playlist
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
import { SpotifyTrack } from '../types';
import { generatePlaylistName } from '../services/StorageService';
import * as HapticService from '../services/HapticService';
import TrackPickerModal from './TrackPickerModal';
import './PlaylistCreationModal.css';

interface PlaylistCreationModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  onSave: (name: string, tracks: SpotifyTrack[]) => void;
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
 * PlaylistCreationModal Component
 */
const PlaylistCreationModal: React.FC<PlaylistCreationModalProps> = ({
  isOpen,
  onDismiss,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [showTrackPicker, setShowTrackPicker] = useState(false);

  // Initialize with default name when modal opens
  useEffect(() => {
    if (isOpen) {
      setName(generatePlaylistName());
      setTracks([]);
    }
  }, [isOpen]);

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
    HapticService.impactMedium();
    onSave(name.trim() || generatePlaylistName(), tracks);
  };

  const canSave = name.trim().length > 0 && tracks.length > 0;

  return (
    <>
      <IonModal isOpen={isOpen} onDidDismiss={handleDismiss}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>New Playlist</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={handleDismiss}>
                <IonIcon icon={close} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>

        <IonContent>
          {/* Playlist Name Input */}
          <div className="playlist-creation-header">
            <IonIcon icon={musicalNotesOutline} className="playlist-icon" />
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
          </div>

          {/* Add Tracks Button */}
          <div className="add-tracks-section">
            <IonButton expand="block" onClick={handleAddTracks}>
              <IonIcon icon={addCircleOutline} slot="start" />
              Add Tracks
            </IonButton>
            {tracks.length > 0 && (
              <IonText color="medium">
                <p>{tracks.length} {tracks.length === 1 ? 'track' : 'tracks'} added</p>
              </IonText>
            )}
          </div>

          {/* Track List */}
          {tracks.length === 0 && (
            <div className="empty-tracks-state">
              <IonIcon icon={musicalNotesOutline} />
              <IonText color="medium">
                <p>No tracks yet</p>
                <p className="empty-hint">Tap "Add Tracks" to get started</p>
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
              Save Playlist
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

export default PlaylistCreationModal;
