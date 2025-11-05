import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonFab,
  IonFabButton,
  IonIcon,
  IonButton,
  IonBadge,
  IonSpinner,
  IonText,
  useIonToast,
} from '@ionic/react';
import { addOutline, checkmarkCircle } from 'ionicons/icons';
import { useEffect } from 'react';
import { usePhotoStore } from '../stores/photoStore';
import './Tab1.css';

const Tab1: React.FC = () => {
  const {
    photos,
    selectedPhotos,
    isLoading,
    error,
    importPhotos,
    togglePhotoSelection,
    clearSelection,
    selectAll,
    setError,
  } = usePhotoStore();

  const [presentToast] = useIonToast();

  // Show error toast when error occurs
  useEffect(() => {
    if (error) {
      presentToast({
        message: error,
        duration: 3000,
        color: 'danger',
        position: 'top',
      });
      setError(null);
    }
  }, [error, presentToast, setError]);

  const handleImportPhotos = async () => {
    await importPhotos();
  };

  const handlePhotoClick = (photoId: string) => {
    togglePhotoSelection(photoId);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>My Photos</IonTitle>
          {selectedPhotos.length > 0 && (
            <IonBadge slot="end" color="primary">
              {selectedPhotos.length} selected
            </IonBadge>
          )}
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">My Photos</IonTitle>
          </IonToolbar>
        </IonHeader>

        {/* Selection Actions Bar */}
        {selectedPhotos.length > 0 && (
          <div className="selection-actions">
            <IonButton size="small" fill="clear" onClick={selectAll}>
              Select All
            </IonButton>
            <IonButton size="small" fill="clear" onClick={clearSelection}>
              Deselect All
            </IonButton>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="loading-container">
            <IonSpinner name="crescent" />
            <IonText>
              <p>Importing photos...</p>
            </IonText>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && photos.length === 0 && (
          <div className="empty-state">
            <IonIcon
              icon={addOutline}
              style={{ fontSize: '80px', color: 'var(--ion-color-medium)' }}
            />
            <IonText color="medium">
              <h2>No Photos Yet</h2>
              <p>Tap the + button below to import photos from your library</p>
            </IonText>
          </div>
        )}

        {/* Photo Grid */}
        {!isLoading && photos.length > 0 && (
          <div className="photo-grid">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className={`photo-item ${photo.selected ? 'selected' : ''}`}
                onClick={() => handlePhotoClick(photo.id)}
              >
                <img src={photo.uri} alt={photo.filename} />
                {photo.selected && (
                  <div className="selected-overlay">
                    <IonIcon icon={checkmarkCircle} className="checkmark-icon" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Floating Action Button for Import */}
        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton onClick={handleImportPhotos} disabled={isLoading}>
            <IonIcon icon={addOutline} />
          </IonFabButton>
        </IonFab>
      </IonContent>
    </IonPage>
  );
};

export default Tab1;
