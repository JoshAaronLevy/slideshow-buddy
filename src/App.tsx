import { Redirect, Route } from 'react-router-dom';
import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  IonAlert,
  setupIonicReact,
  useIonToast,
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { imagesOutline, musicalNotesOutline } from 'ionicons/icons';
import { useState, useEffect } from 'react';
import SlideshowsTab from './pages/SlideshowsTab';
import Tab2 from './pages/Tab2';
import SpotifySyncModal from './components/SpotifySyncModal';
import { requestPhotoLibraryPermission } from './services/PhotoService';
import { useSpotifyAuth } from './hooks/useSpotifyAuth';
// import Tab3 from './pages/Tab3'; // Commented out for redesign (Stage 5 will reintegrate)

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* import '@ionic/react/css/palettes/dark.always.css'; */
/* import '@ionic/react/css/palettes/dark.class.css'; */
import '@ionic/react/css/palettes/dark.system.css';

/* Theme variables */
import './theme/variables.css';

setupIonicReact();

const App: React.FC = () => {
  const [showSpotifySync, setShowSpotifySync] = useState(false);
  const [showPermissionAlert, setShowPermissionAlert] = useState(false);
  const { loginWithSpotify } = useSpotifyAuth();
  const [presentToast] = useIonToast();

  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const hasPermission = await requestPhotoLibraryPermission();
        
        if (hasPermission) {
          // Permission granted - check if we should show Spotify sync modal
          const { value: dismissed } = await import('@capacitor/preferences').then(
            ({ Preferences }) => Preferences.get({ key: 'spotify_sync_dismissed' })
          );
          
          if (!dismissed || dismissed !== 'true') {
            // Small delay to let the app finish loading
            setTimeout(() => {
              setShowSpotifySync(true);
            }, 500);
          }
        } else {
          // Permission denied - show alert with instructions
          setShowPermissionAlert(true);
        }
      } catch (error) {
        console.error('Error checking photo permissions:', error);
        presentToast({
          message: 'Unable to check photo permissions. Please try again.',
          duration: 3000,
          color: 'danger',
        });
      }
    };

    checkPermissions();
  }, [presentToast]);

  const handleSyncNow = async () => {
    setShowSpotifySync(false);
    try {
      await loginWithSpotify();
    } catch (error) {
      console.error('Error initiating Spotify sync:', error);
      presentToast({
        message: 'Unable to start Spotify sync. Please try again later.',
        duration: 3000,
        color: 'danger',
      });
    }
  };

  const handleSyncLater = async () => {
    setShowSpotifySync(false);
    // Store preference to not show again
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({ key: 'spotify_sync_dismissed', value: 'true' });
  };

  return (
    <IonApp>
      <IonReactRouter>
        <IonTabs>
          <IonRouterOutlet>
            <Route exact path="/slideshows">
              <SlideshowsTab />
            </Route>
            <Route exact path="/music">
              <Tab2 />
            </Route>
            {/* <Route exact path="/play">
              <Tab3 />
            </Route> */}
            <Route exact path="/">
              <Redirect to="/slideshows" />
            </Route>
          </IonRouterOutlet>
          <IonTabBar slot="bottom">
            <IonTabButton tab="slideshows" href="/slideshows">
              <IonIcon aria-hidden="true" icon={imagesOutline} />
              <IonLabel>Slideshows</IonLabel>
            </IonTabButton>
            <IonTabButton tab="music" href="/music">
              <IonIcon aria-hidden="true" icon={musicalNotesOutline} />
              <IonLabel>Music</IonLabel>
            </IonTabButton>
            {/* <IonTabButton tab="play" href="/play">
              <IonIcon aria-hidden="true" icon={playCircle} />
              <IonLabel>Play</IonLabel>
            </IonTabButton> */}
          </IonTabBar>
        </IonTabs>
      </IonReactRouter>

      <IonAlert
        isOpen={showPermissionAlert}
        onDidDismiss={() => setShowPermissionAlert(false)}
        header="Photo Access Required"
        message="Slideshow Buddy needs access to your photos to create slideshows. Please enable photo access in Settings > Privacy & Security > Photos > Slideshow Buddy."
        buttons={['OK']}
      />

      <SpotifySyncModal
        isOpen={showSpotifySync}
        onDismiss={handleSyncLater}
        onSyncNow={handleSyncNow}
        onSyncLater={handleSyncLater}
      />
    </IonApp>
  );
};

export default App;
