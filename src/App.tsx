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
import { imagesOutline, musicalNotesOutline, settingsOutline } from 'ionicons/icons';
import { useState, useEffect } from 'react';
import SlideshowsTab from './pages/SlideshowsTab';
import Tab2 from './pages/Tab2';
import SettingsTab from './pages/SettingsTab';
import SpotifySyncModal from './components/SpotifySyncModal';
import PreferencesModal from './components/PreferencesModal';
import DesktopSidebar from './components/DesktopSidebar';
import MacOSHeader from './components/MacOSHeader';
import { useSpotifyAuth } from './hooks/useSpotifyAuth';
import { usePhotoPermissions } from './hooks/usePhotoPermissions';
import TokenManager from './services/TokenManager';
import { memoryMonitor } from './utils/memoryMonitor';
import { isMacOS } from './utils/platform';
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
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const { loginWithSpotify } = useSpotifyAuth();
  const [presentToast] = useIonToast();
  const { requestPermission } = usePhotoPermissions();

  // Check/request photo permissions on app launch (macOS only)
  useEffect(() => {
    const initPhotoPermissions = async () => {
      if (!isMacOS()) {
        return;
      }

      try {
        // Request permission (will check first, then request if needed)
        // This includes all UX: loading spinner, success/error notifications, denial dialogue
        await requestPermission({ showNotifications: true });

        // After permission flow completes, check if we should show Spotify sync modal
        const { value: dismissed } = await import('@capacitor/preferences').then(
          ({ Preferences }) => Preferences.get({ key: 'spotify_sync_dismissed' })
        );
        
        if (!dismissed || dismissed !== 'true') {
          // Small delay to let any toasts finish
          setTimeout(() => {
            setShowSpotifySync(true);
          }, 1000);
        }
      } catch (error) {
        console.error('[App] Error in photo permission flow:', error);
      }
    };

    // Small delay to let app finish mounting
    setTimeout(initPhotoPermissions, 500);
  }, [requestPermission]);

  // Stage 6: Initialize TokenManager on app mount
  // Replaces Stage 2 app resume listener - TokenManager handles auto-refresh via timer
  useEffect(() => {
    console.log('[App] Initializing TokenManager...');

    const initTokenManager = async () => {
      try {
        await TokenManager.getInstance().initialize();
        console.log('[App] TokenManager initialized successfully');
      } catch (error) {
        console.error('[App] Failed to initialize TokenManager:', error);
      }
    };

    initTokenManager();
  }, []);

  // Stage 5: Start memory monitoring
  useEffect(() => {
    console.log('[App] Starting memory monitor...');
    memoryMonitor.start();

    return () => {
      console.log('[App] Stopping memory monitor...');
      memoryMonitor.stop();
    };
  }, []);

  // Stage 8: Listen for menu preferences event (macOS Cmd+,)
  useEffect(() => {
    const electron = (window as any).electron;
    if (electron?.menu) {
      const removeListener = electron.menu.onPreferences(() => {
        console.log('[App] Preferences menu triggered');
        setPreferencesOpen(true);
      });
      return removeListener;
    }
  }, []);

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

  const isDesktop = isMacOS();

  return (
    <IonApp>
      <IonReactRouter>
        {isDesktop ? (
          // Desktop layout with sidebar and header
          <div style={{ display: 'flex', height: '100vh' }}>
            <DesktopSidebar />
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
              <MacOSHeader />
              <div style={{ flex: 1, overflow: 'auto' }}>
                <IonRouterOutlet>
                  <Route exact path="/slideshows">
                    <SlideshowsTab />
                  </Route>
                  <Route exact path="/music">
                    <Tab2 />
                  </Route>
                  <Route exact path="/settings">
                    <SettingsTab />
                  </Route>
                  {/* <Route exact path="/play">
                    <Tab3 />
                  </Route> */}
                  <Route exact path="/">
                    <Redirect to="/slideshows" />
                  </Route>
                </IonRouterOutlet>
              </div>
            </div>
          </div>
        ) : (
          // Mobile layout with tabs
          <IonTabs>
            <IonRouterOutlet>
              <Route exact path="/slideshows">
                <SlideshowsTab />
              </Route>
              <Route exact path="/music">
                <Tab2 />
              </Route>
              <Route exact path="/settings">
                <SettingsTab />
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
              <IonTabButton tab="settings" href="/settings">
                <IonIcon aria-hidden="true" icon={settingsOutline} />
                <IonLabel>Settings</IonLabel>
              </IonTabButton>
              {/* <IonTabButton tab="play" href="/play">
                <IonIcon aria-hidden="true" icon={playCircle} />
                <IonLabel>Play</IonLabel>
              </IonTabButton> */}
            </IonTabBar>
          </IonTabs>
        )}
      </IonReactRouter>

      <SpotifySyncModal
        isOpen={showSpotifySync}
        onDismiss={handleSyncLater}
        onSyncNow={handleSyncNow}
        onSyncLater={handleSyncLater}
      />

      <PreferencesModal
        isOpen={preferencesOpen}
        onClose={() => setPreferencesOpen(false)}
      />
    </IonApp>
  );
};

export default App;
