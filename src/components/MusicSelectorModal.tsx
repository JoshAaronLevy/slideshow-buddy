/**
 * MusicSelectorModal - Modal for selecting music source for a slideshow
 * Allows choosing from custom playlists, Spotify playlists, or no music
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
  IonText,
  IonRadioGroup,
  IonRadio,
  IonSearchbar,
} from '@ionic/react';
import {
  close,
  musicalNotesOutline,
  musicalNotesSharp,
  volumeMuteOutline,
  checkmarkCircle,
} from 'ionicons/icons';
import { useState, useEffect } from 'react';
import { MusicSource } from '../types/slideshow';
import { CustomPlaylist } from '../types/playlist';
import { SpotifyPlaylist } from '../types';
import * as HapticService from '../services/HapticService';
import './MusicSelectorModal.css';

interface MusicSelectorModalProps {
  isOpen: boolean;
  currentSelection: MusicSource | null;
  customPlaylists: CustomPlaylist[];
  spotifyPlaylists: SpotifyPlaylist[];
  onDismiss: () => void;
  onSelect: (musicSource: MusicSource) => void;
}

/**
 * MusicSelectorModal Component
 */
const MusicSelectorModal: React.FC<MusicSelectorModalProps> = ({
  isOpen,
  currentSelection,
  customPlaylists,
  spotifyPlaylists,
  onDismiss,
  onSelect,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedValue, setSelectedValue] = useState<string>('none');

  // Initialize selected value when modal opens
  useEffect(() => {
    if (isOpen && currentSelection) {
      if (currentSelection.type === 'none') {
        setSelectedValue('none');
      } else if (currentSelection.type === 'custom-playlist') {
        setSelectedValue(`custom-${currentSelection.playlistId}`);
      } else if (currentSelection.type === 'spotify-playlist') {
        setSelectedValue(`spotify-${currentSelection.playlistId}`);
      }
    } else if (isOpen) {
      setSelectedValue('none');
    }
  }, [isOpen, currentSelection]);

  const handleDismiss = () => {
    HapticService.impactLight();
    setSearchQuery('');
    onDismiss();
  };

  const handleConfirm = () => {
    HapticService.impactMedium();
    
    // Parse selected value and create MusicSource
    if (selectedValue === 'none') {
      onSelect({ type: 'none' });
    } else if (selectedValue.startsWith('custom-')) {
      const playlistId = selectedValue.replace('custom-', '');
      onSelect({ type: 'custom-playlist', playlistId });
    } else if (selectedValue.startsWith('spotify-')) {
      const playlistId = selectedValue.replace('spotify-', '');
      onSelect({ type: 'spotify-playlist', playlistId });
    }
    
    setSearchQuery('');
  };

  // Filter playlists based on search query
  const filteredCustomPlaylists = customPlaylists.filter(playlist =>
    playlist.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSpotifyPlaylists = spotifyPlaylists.filter(playlist =>
    playlist.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const hasCustomPlaylists = filteredCustomPlaylists.length > 0;
  const hasSpotifyPlaylists = filteredSpotifyPlaylists.length > 0;
  const hasAnyPlaylists = customPlaylists.length > 0 || spotifyPlaylists.length > 0;

  return (
    <IonModal isOpen={isOpen} onDidDismiss={handleDismiss}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Select Music</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleDismiss}>
              <IonIcon icon={close} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
        {hasAnyPlaylists && (
          <IonToolbar>
            <IonSearchbar
              value={searchQuery}
              onIonInput={(e) => setSearchQuery(e.detail.value || '')}
              placeholder="Search playlists"
              debounce={300}
            />
          </IonToolbar>
        )}
      </IonHeader>

      <IonContent>
        <IonRadioGroup value={selectedValue} onIonChange={(e) => setSelectedValue(e.detail.value)}>
          <IonList>
            {/* No Music Option */}
            <IonItem button>
              <IonIcon icon={volumeMuteOutline} slot="start" />
              <IonLabel>
                <h3>No Music</h3>
                <p>Play slideshow without audio</p>
              </IonLabel>
              <IonRadio slot="end" value="none" />
            </IonItem>

            {/* Custom Playlists Section */}
            {customPlaylists.length > 0 && (
              <>
                <IonItem lines="none" className="section-header">
                  <IonLabel>
                    <h2>Custom Playlists</h2>
                  </IonLabel>
                </IonItem>

                {!hasCustomPlaylists && searchQuery && (
                  <IonItem lines="none">
                    <IonText color="medium">
                      <p>No custom playlists match "{searchQuery}"</p>
                    </IonText>
                  </IonItem>
                )}

                {filteredCustomPlaylists.map((playlist) => (
                  <IonItem key={playlist.id} button>
                    {playlist.thumbnailUri ? (
                      <img 
                        src={playlist.thumbnailUri} 
                        alt={playlist.name}
                        slot="start"
                        className="playlist-thumbnail"
                      />
                    ) : (
                      <IonIcon icon={musicalNotesSharp} slot="start" />
                    )}
                    <IonLabel>
                      <h3>{playlist.name}</h3>
                      <p>{playlist.tracks.length} tracks</p>
                    </IonLabel>
                    <IonRadio slot="end" value={`custom-${playlist.id}`} />
                  </IonItem>
                ))}
              </>
            )}

            {/* Spotify Playlists Section */}
            {spotifyPlaylists.length > 0 && (
              <>
                <IonItem lines="none" className="section-header">
                  <IonLabel>
                    <h2>Spotify Playlists</h2>
                  </IonLabel>
                </IonItem>

                {!hasSpotifyPlaylists && searchQuery && (
                  <IonItem lines="none">
                    <IonText color="medium">
                      <p>No Spotify playlists match "{searchQuery}"</p>
                    </IonText>
                  </IonItem>
                )}

                {filteredSpotifyPlaylists.map((playlist) => (
                  <IonItem key={playlist.id} button>
                    {playlist.image_url ? (
                      <img 
                        src={playlist.image_url} 
                        alt={playlist.name}
                        slot="start"
                        className="playlist-thumbnail"
                      />
                    ) : (
                      <IonIcon icon={musicalNotesSharp} slot="start" />
                    )}
                    <IonLabel>
                      <h3>{playlist.name}</h3>
                      <p>{playlist.track_count} tracks • {playlist.owner}</p>
                    </IonLabel>
                    <IonRadio slot="end" value={`spotify-${playlist.id}`} />
                  </IonItem>
                ))}
              </>
            )}

            {/* Empty State */}
            {!hasAnyPlaylists && (
              <div className="music-selector-empty">
                <IonIcon icon={musicalNotesOutline} className="empty-icon" />
                <IonText color="medium">
                  <h3>No Playlists Available</h3>
                  <p>Create custom playlists in the Music tab or connect to Spotify</p>
                </IonText>
              </div>
            )}
          </IonList>
        </IonRadioGroup>
      </IonContent>

      <IonToolbar>
        <IonButton expand="block" onClick={handleConfirm} className="confirm-button">
          <IonIcon icon={checkmarkCircle} slot="start" />
          Confirm Selection
        </IonButton>
      </IonToolbar>
    </IonModal>
  );
};

export default MusicSelectorModal;
