/**
 * SlideshowConfigModal - Configuration screen after photo selection
 * Allows naming, music selection, and settings configuration
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
  IonToggle,
  IonRange,
  IonIcon,
  IonText,
  IonFooter,
} from '@ionic/react';
import {
  close,
  musicalNotesOutline,
  shuffleOutline,
  timerOutline,
  checkmarkCircle,
  playCircle,
} from 'ionicons/icons';
import { useState, useEffect } from 'react';
import { Photo } from '../types';
import { MusicSource, SlideshowSettings } from '../types/slideshow';
import { CustomPlaylist } from '../types/playlist';
import { SpotifyPlaylist } from '../types';
import { SLIDESHOW_DEFAULTS } from '../constants';
import { generateSlideshowName } from '../services/StorageService';
import * as HapticService from '../services/HapticService';
import MusicSelectorModal from './MusicSelectorModal';
import './SlideshowConfigModal.css';

interface SlideshowConfigModalProps {
  isOpen: boolean;
  selectedPhotos: Photo[];
  customPlaylists: CustomPlaylist[];
  spotifyPlaylists: SpotifyPlaylist[];
  onDismiss: () => void;
  onSave: (name: string, musicSource: MusicSource, settings: SlideshowSettings) => void;
  onSaveAndPlay: (name: string, musicSource: MusicSource, settings: SlideshowSettings) => void;
}

/**
 * Get display text for music source
 */
const getMusicDisplayText = (
  musicSource: MusicSource,
  customPlaylists: CustomPlaylist[],
  spotifyPlaylists: SpotifyPlaylist[]
): string => {
  if (musicSource.type === 'none') {
    return 'No Music';
  } else if (musicSource.type === 'custom-playlist') {
    const playlist = customPlaylists.find(p => p.id === musicSource.playlistId);
    return playlist ? playlist.name : 'Custom Playlist';
  } else {
    const playlist = spotifyPlaylists.find(p => p.id === musicSource.playlistId);
    return playlist ? playlist.name : 'Spotify Playlist';
  }
};

/**
 * SlideshowConfigModal Component
 */
const SlideshowConfigModal: React.FC<SlideshowConfigModalProps> = ({
  isOpen,
  selectedPhotos,
  customPlaylists,
  spotifyPlaylists,
  onDismiss,
  onSave,
  onSaveAndPlay,
}) => {
  const [name, setName] = useState('');
  const [musicSource, setMusicSource] = useState<MusicSource>({ type: 'none' });
  const [transitionTime, setTransitionTime] = useState(SLIDESHOW_DEFAULTS.TRANSITION_TIME);
  const [shuffle, setShuffle] = useState(SLIDESHOW_DEFAULTS.SHUFFLE_ENABLED);
  const [showMusicSelector, setShowMusicSelector] = useState(false);

  // Initialize with default name when modal opens
  useEffect(() => {
    if (isOpen) {
      setName(generateSlideshowName());
      setMusicSource({ type: 'none' });
      setTransitionTime(SLIDESHOW_DEFAULTS.TRANSITION_TIME);
      setShuffle(SLIDESHOW_DEFAULTS.SHUFFLE_ENABLED);
    }
  }, [isOpen]);

  const handleDismiss = () => {
    HapticService.impactLight();
    onDismiss();
  };

  const handleMusicSelect = (selected: MusicSource) => {
    setMusicSource(selected);
    setShowMusicSelector(false);
  };

  const handleSave = () => {
    HapticService.impactMedium();
    const settings: SlideshowSettings = {
      transitionTime,
      shuffle,
      loop: false, // Default for now
    };
    onSave(name.trim() || generateSlideshowName(), musicSource, settings);
  };

  const handleSaveAndPlay = () => {
    HapticService.impactHeavy();
    const settings: SlideshowSettings = {
      transitionTime,
      shuffle,
      loop: false,
    };
    onSaveAndPlay(name.trim() || generateSlideshowName(), musicSource, settings);
  };

  const canSave = selectedPhotos.length > 0 && name.trim().length > 0;

  return (
    <>
      <IonModal isOpen={isOpen} onDidDismiss={handleDismiss}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Configure Slideshow</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={handleDismiss}>
                <IonIcon icon={close} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>

        <IonContent>
          {/* Photo Preview */}
          <div className="config-photos-preview">
            <div className="photos-preview-grid">
              {selectedPhotos.slice(0, 4).map((photo) => (
                <img key={photo.id} src={photo.uri} alt={photo.filename} />
              ))}
              {selectedPhotos.length > 4 && (
                <div className="photos-preview-more">
                  <IonText>+{selectedPhotos.length - 4}</IonText>
                </div>
              )}
            </div>
            <IonText color="medium">
              <p>{selectedPhotos.length} photos selected</p>
            </IonText>
          </div>

          {/* Configuration Form */}
          <IonList>
            {/* Name Input */}
            <IonItem>
              <IonLabel position="stacked">Slideshow Name</IonLabel>
              <IonInput
                value={name}
                onIonInput={(e) => setName(e.detail.value || '')}
                placeholder="Enter slideshow name"
                clearInput
              />
            </IonItem>

            {/* Music Selection */}
            <IonItem button onClick={() => setShowMusicSelector(true)}>
              <IonIcon icon={musicalNotesOutline} slot="start" />
              <IonLabel>
                <h3>Music</h3>
                <p>{getMusicDisplayText(musicSource, customPlaylists, spotifyPlaylists)}</p>
              </IonLabel>
            </IonItem>

            {/* Transition Time Slider */}
            <IonItem>
              <div className="slider-container">
                <div className="slider-header">
                  <IonIcon icon={timerOutline} />
                  <IonLabel>
                    <h3>Slide Duration</h3>
                    <p>{transitionTime} seconds per photo</p>
                  </IonLabel>
                </div>
                <IonRange
                  min={SLIDESHOW_DEFAULTS.MIN_TRANSITION_TIME}
                  max={SLIDESHOW_DEFAULTS.MAX_TRANSITION_TIME}
                  step={1}
                  value={transitionTime}
                  onIonChange={(e) => setTransitionTime(e.detail.value as number)}
                  pin
                  pinFormatter={(value: number) => `${value}s`}
                >
                  <IonLabel slot="start">{SLIDESHOW_DEFAULTS.MIN_TRANSITION_TIME}s</IonLabel>
                  <IonLabel slot="end">{SLIDESHOW_DEFAULTS.MAX_TRANSITION_TIME}s</IonLabel>
                </IonRange>
              </div>
            </IonItem>

            {/* Shuffle Toggle */}
            <IonItem>
              <IonIcon icon={shuffleOutline} slot="start" />
              <IonLabel>
                <h3>Shuffle Photos</h3>
                <p>Randomize photo order</p>
              </IonLabel>
              <IonToggle
                checked={shuffle}
                onIonChange={async (e) => {
                  await HapticService.impactLight();
                  setShuffle(e.detail.checked);
                }}
              />
            </IonItem>
          </IonList>
        </IonContent>

        {/* Footer with action buttons */}
        <IonFooter>
          <IonToolbar>
            <div className="config-actions">
              <IonButton
                expand="block"
                fill="outline"
                onClick={handleSave}
                disabled={!canSave}
              >
                <IonIcon icon={checkmarkCircle} slot="start" />
                Save
              </IonButton>
              <IonButton
                expand="block"
                onClick={handleSaveAndPlay}
                disabled={!canSave}
              >
                <IonIcon icon={playCircle} slot="start" />
                Save & Play
              </IonButton>
            </div>
          </IonToolbar>
        </IonFooter>
      </IonModal>

      {/* Music Selector Modal */}
      <MusicSelectorModal
        isOpen={showMusicSelector}
        currentSelection={musicSource}
        customPlaylists={customPlaylists}
        spotifyPlaylists={spotifyPlaylists}
        onDismiss={() => setShowMusicSelector(false)}
        onSelect={handleMusicSelect}
      />
    </>
  );
};

export default SlideshowConfigModal;
