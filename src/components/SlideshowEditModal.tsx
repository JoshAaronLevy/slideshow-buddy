/**
 * SlideshowEditModal - Edit existing slideshow configuration
 * Similar to SlideshowConfigModal but with pre-populated values
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
  repeatOutline,
} from 'ionicons/icons';
import { useState, useEffect } from 'react';
import { SavedSlideshow } from '../types/slideshow';
import { MusicSource } from '../types/slideshow';
import { CustomPlaylist } from '../types/playlist';
import { SpotifyPlaylist } from '../types';
import { SLIDESHOW_DEFAULTS } from '../constants';
import * as HapticService from '../services/HapticService';
import MusicSelectorModal from './MusicSelectorModal';
import './SlideshowEditModal.css';

interface SlideshowEditModalProps {
  isOpen: boolean;
  slideshow: SavedSlideshow | null;
  customPlaylists: CustomPlaylist[];
  spotifyPlaylists: SpotifyPlaylist[];
  onDismiss: () => void;
  onSave: (updatedSlideshow: SavedSlideshow) => void;
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
 * SlideshowEditModal Component
 */
const SlideshowEditModal: React.FC<SlideshowEditModalProps> = ({
  isOpen,
  slideshow,
  customPlaylists,
  spotifyPlaylists,
  onDismiss,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [musicSource, setMusicSource] = useState<MusicSource>({ type: 'none' });
  const [transitionTime, setTransitionTime] = useState(SLIDESHOW_DEFAULTS.TRANSITION_TIME);
  const [shuffle, setShuffle] = useState(SLIDESHOW_DEFAULTS.SHUFFLE_ENABLED);
  const [loop, setLoop] = useState(SLIDESHOW_DEFAULTS.LOOP_ENABLED);
  const [showMusicSelector, setShowMusicSelector] = useState(false);

  // Initialize with slideshow data when modal opens or slideshow changes
  useEffect(() => {
    if (isOpen && slideshow) {
      setName(slideshow.name);
      setMusicSource(slideshow.musicSource);
      setTransitionTime(slideshow.settings.transitionTime);
      setShuffle(slideshow.settings.shuffle);
      setLoop(slideshow.settings.loop);
    }
  }, [isOpen, slideshow]);

  const handleDismiss = () => {
    HapticService.impactLight();
    onDismiss();
  };

  const handleMusicSelect = (selected: MusicSource) => {
    setMusicSource(selected);
    setShowMusicSelector(false);
  };

  const handleSave = () => {
    if (!slideshow) return;

    HapticService.impactMedium();

    const updatedSlideshow: SavedSlideshow = {
      ...slideshow,
      name: name.trim() || slideshow.name,
      musicSource,
      settings: {
        ...slideshow.settings,
        transitionTime,
        shuffle,
        loop,
      },
      updatedAt: Date.now(),
    };

    onSave(updatedSlideshow);
  };

  const canSave = slideshow && name.trim().length > 0;

  if (!slideshow) {
    return null;
  }

  return (
    <>
      <IonModal isOpen={isOpen} onDidDismiss={handleDismiss}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Edit Slideshow</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={handleDismiss}>
                <IonIcon icon={close} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>

        <IonContent>
          {/* Slideshow Info */}
          <div className="edit-slideshow-info">
            <IonText color="medium">
              <p>{slideshow.photoIds.length} photos</p>
              <p>Created {new Date(slideshow.createdAt).toLocaleDateString()}</p>
              {slideshow.playCount > 0 && (
                <p>Played {slideshow.playCount} {slideshow.playCount === 1 ? 'time' : 'times'}</p>
              )}
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

            {/* Loop Toggle */}
            <IonItem>
              <IonIcon icon={repeatOutline} slot="start" />
              <IonLabel>
                <h3>Repeat Slideshow</h3>
                <p>Restart from beginning when finished</p>
              </IonLabel>
              <IonToggle
                checked={loop}
                onIonChange={async (e) => {
                  await HapticService.impactLight();
                  setLoop(e.detail.checked);
                }}
              />
            </IonItem>
          </IonList>
        </IonContent>

        {/* Footer with save button */}
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

export default SlideshowEditModal;
