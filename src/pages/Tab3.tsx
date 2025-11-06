import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonButton,
  IonIcon,
  IonText,
  IonToggle,
  IonRange,
  IonLabel,
  IonItem,
  IonList,
  useIonToast,
} from '@ionic/react';
import {
  playCircleOutline,
  imagesOutline,
  musicalNotesOutline,
  shuffleOutline,
  timerOutline,
  repeatOutline,
} from 'ionicons/icons';
import { usePhotoStore } from '../stores/photoStore';
import { useMusicStore } from '../stores/musicStore';
import { useSlideshowStore } from '../stores/slideshowStore';
// import SlideshowPlayer from '../components/SlideshowPlayer'; // Commented out during Stage 5 refactor
import { SLIDESHOW_DEFAULTS } from '../constants';
import * as HapticService from '../services/HapticService';
import './Tab3.css';

const Tab3: React.FC = () => {
  const { selectedPhotos } = usePhotoStore();
  const { selectedPlaylist, selectedTrack } = useMusicStore();
  const { config, updateConfig, start } = useSlideshowStore();
  const [presentToast] = useIonToast();

  const hasPhotos = selectedPhotos.length > 0;
  const hasMusic = selectedPlaylist !== null || selectedTrack !== null;
  const canStart = hasPhotos && hasMusic;

  const musicName = selectedPlaylist?.name || selectedTrack?.name || 'None';

  const handleStartSlideshow = async () => {
    if (!canStart) {
      await HapticService.notificationWarning();
      presentToast({
        message: 'Please select photos and music first',
        duration: 2500,
        color: 'warning',
        position: 'top',
      });
      return;
    }

    // Get the actual Photo objects from the store
    const photosToShow = selectedPhotos.filter((photo) => photo.selected);
    
    if (photosToShow.length === 0) {
      await HapticService.notificationWarning();
      presentToast({
        message: 'Please select at least one photo',
        duration: 2500,
        color: 'warning',
        position: 'top',
      });
      return;
    }

    await HapticService.impactHeavy();
    start(photosToShow);
    
    presentToast({
      message: 'Starting slideshow...',
      duration: 1500,
      color: 'success',
      position: 'top',
    });
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Slideshow</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Slideshow</IonTitle>
          </IonToolbar>
        </IonHeader>

        <div className="slideshow-container">
          {/* Quick Play Section */}
          <IonCard className="quick-play-card">
            <IonCardHeader>
              <IonCardTitle>Quick Play</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              {/* Selection Status */}
              <div className="selection-status">
                <div className="status-item">
                  <IonIcon icon={imagesOutline} className="status-icon" />
                  <div className="status-content">
                    <IonText color="medium">
                      <p className="status-label">Photos</p>
                    </IonText>
                    <IonText>
                      <p className="status-value">
                        {hasPhotos ? `${selectedPhotos.length} selected` : 'None selected'}
                      </p>
                    </IonText>
                  </div>
                  {!hasPhotos && (
                    <IonText color="warning">
                      <span className="status-warning">Required</span>
                    </IonText>
                  )}
                </div>

                <div className="status-item">
                  <IonIcon icon={musicalNotesOutline} className="status-icon" />
                  <div className="status-content">
                    <IonText color="medium">
                      <p className="status-label">Music</p>
                    </IonText>
                    <IonText>
                      <p className="status-value">{musicName}</p>
                    </IonText>
                  </div>
                  {!hasMusic && (
                    <IonText color="warning">
                      <span className="status-warning">Required</span>
                    </IonText>
                  )}
                </div>
              </div>

              {/* Start Button */}
              <IonButton
                expand="block"
                onClick={handleStartSlideshow}
                disabled={!canStart}
                className="start-button"
                size="large"
                aria-label={`Start slideshow with ${selectedPhotos.length} photos and ${musicName}`}
              >
                <IonIcon icon={playCircleOutline} slot="start" />
                Start Slideshow
              </IonButton>

              {!canStart && (
                <IonText color="medium" className="text-center">
                  <p className="helper-text">
                    Select photos and music from the tabs above to get started
                  </p>
                </IonText>
              )}
            </IonCardContent>
          </IonCard>

          {/* Settings Card */}
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>Settings</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonList lines="full">
                {/* Shuffle Toggle */}
                <IonItem>
                  <IonIcon icon={shuffleOutline} slot="start" />
                  <IonLabel>
                    <h3>Shuffle Photos</h3>
                    <p>Randomize photo order</p>
                  </IonLabel>
                  <IonToggle
                    checked={config.shuffle}
                    onIonChange={async (e) => {
                      await HapticService.impactLight();
                      updateConfig({ shuffle: e.detail.checked });
                    }}
                    aria-label="Toggle shuffle photos on or off"
                  />
                </IonItem>

                {/* Transition Speed Slider */}
                <IonItem>
                  <div className="slider-item">
                    <div className="slider-header">
                      <IonIcon icon={timerOutline} />
                      <IonLabel>
                        <h3>Transition Speed</h3>
                        <p>{config.transitionTime}s per photo</p>
                      </IonLabel>
                    </div>
                    <IonRange
                      min={SLIDESHOW_DEFAULTS.MIN_TRANSITION_TIME}
                      max={SLIDESHOW_DEFAULTS.MAX_TRANSITION_TIME}
                      step={1}
                      value={config.transitionTime}
                      onIonChange={(e) =>
                        updateConfig({ transitionTime: e.detail.value as number })
                      }
                      pin
                      pinFormatter={(value: number) => `${value}s`}
                      aria-label={`Transition speed: ${config.transitionTime} seconds per photo`}
                    >
                      <IonLabel slot="start">
                        {SLIDESHOW_DEFAULTS.MIN_TRANSITION_TIME}s
                      </IonLabel>
                      <IonLabel slot="end">
                        {SLIDESHOW_DEFAULTS.MAX_TRANSITION_TIME}s
                      </IonLabel>
                    </IonRange>
                  </div>
                </IonItem>

                {/* Loop Toggle */}
                <IonItem>
                  <IonIcon icon={repeatOutline} slot="start" />
                  <IonLabel>
                    <h3>Loop Slideshow</h3>
                    <p>Restart when finished</p>
                  </IonLabel>
                  <IonToggle
                    checked={config.loop}
                    onIonChange={async (e) => {
                      await HapticService.impactLight();
                      updateConfig({ loop: e.detail.checked });
                    }}
                    aria-label="Toggle loop slideshow on or off"
                  />
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </div>

        {/* Slideshow Player - Commented out during Stage 5 refactor */}
        {/* <SlideshowPlayer slideshow={null} isOpen={false} onClose={() => {}} /> */}
      </IonContent>
    </IonPage>
  );
};

export default Tab3;
