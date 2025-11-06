/**
 * SpotifySyncModal - Prompts user to sync Spotify library on app launch
 */

import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonIcon,
  IonText,
  IonFooter,
} from '@ionic/react';
import { musicalNotesOutline, closeOutline, checkmarkCircleOutline } from 'ionicons/icons';
import * as HapticService from '../services/HapticService';
import './SpotifySyncModal.css';

interface SpotifySyncModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  onSyncNow: () => void;
  onSyncLater: () => void;
}

/**
 * SpotifySyncModal Component
 * Asks user if they want to sync Spotify on app launch
 */
const SpotifySyncModal: React.FC<SpotifySyncModalProps> = ({
  isOpen,
  onDismiss,
  onSyncNow,
  onSyncLater,
}) => {
  const handleSyncNow = async () => {
    await HapticService.impactMedium();
    onSyncNow();
    onDismiss();
  };

  const handleSyncLater = async () => {
    await HapticService.impactLight();
    onSyncLater();
    onDismiss();
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss} className="spotify-sync-modal">
      <IonHeader>
        <IonToolbar>
          <IonTitle>Sync Spotify Library</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="spotify-sync-content">
        <div className="spotify-sync-container">
          <IonIcon icon={musicalNotesOutline} className="spotify-sync-icon" />
          
          <IonText>
            <h2>Connect to Spotify?</h2>
            <p className="sync-description">
              Sync your Spotify library to add music to your slideshows. 
              You can always do this later from the Music tab.
            </p>
          </IonText>

          <div className="spotify-sync-features">
            <div className="feature-item">
              <IonIcon icon={checkmarkCircleOutline} color="success" />
              <span>Access your playlists</span>
            </div>
            <div className="feature-item">
              <IonIcon icon={checkmarkCircleOutline} color="success" />
              <span>Browse recently played</span>
            </div>
            <div className="feature-item">
              <IonIcon icon={checkmarkCircleOutline} color="success" />
              <span>Play music during slideshows</span>
            </div>
          </div>
        </div>
      </IonContent>

      <IonFooter>
        <IonToolbar>
          <div className="spotify-sync-actions">
            <IonButton
              expand="block"
              fill="outline"
              onClick={handleSyncLater}
              className="sync-later-button"
            >
              <IonIcon icon={closeOutline} slot="start" />
              Sync Later
            </IonButton>
            <IonButton
              expand="block"
              onClick={handleSyncNow}
              className="sync-now-button"
              color="success"
            >
              <IonIcon icon={musicalNotesOutline} slot="start" />
              Sync Now
            </IonButton>
          </div>
        </IonToolbar>
      </IonFooter>
    </IonModal>
  );
};

export default SpotifySyncModal;
