import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonList,
  IonItem,
  IonLabel,
  IonText,
  IonButton,
  IonAlert,
} from '@ionic/react';
import { useState, useEffect } from 'react';
import './SettingsTab.css';
import packageJson from '../../package.json';
import { isMacOS } from '../utils/platform';
import { usePhotoPermissions } from '../hooks/usePhotoPermissions';

const SettingsTab: React.FC = () => {
  const { state, checkPermission, requestPermission, openSystemSettings } = usePhotoPermissions();
  const [showSettingsAlert, setShowSettingsAlert] = useState(false);
  const showPhotoButton = isMacOS() && (window as any).electron?.photos;

  // Check permission status when tab loads
  useEffect(() => {
    if (showPhotoButton) {
      checkPermission();
    }
  }, [showPhotoButton, checkPermission]);

  const handleGrantPermission = async () => {
    const granted = await requestPermission({ showNotifications: true });
    
    // If permission was denied and system prompt was already shown before,
    // show alert to direct user to System Settings
    if (!granted && state.hasPermission === false) {
      // Check if this is a case where user needs to go to System Settings
      // (i.e., they previously denied and now the OS won't show the prompt)
      setShowSettingsAlert(true);
    }
  };

  const handleOpenSettings = async () => {
    setShowSettingsAlert(false);
    await openSystemSettings();
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Settings</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonList>
          <IonItem>
            <IonLabel>
              <h2>App Version</h2>
              <IonText color="medium">
                <p>Current version of Slideshow Buddy</p>
              </IonText>
            </IonLabel>
            <IonText slot="end" color="primary">
              <strong>{packageJson.version}</strong>
            </IonText>
          </IonItem>

          {showPhotoButton && state.hasPermission === false && (
            <>
              <IonItem lines="none">
                <IonLabel>
                  <h2>Photo Library Access</h2>
                  <IonText color="medium">
                    <p>Grant access to your Photos library</p>
                  </IonText>
                </IonLabel>
              </IonItem>
              
              <IonItem>
                <IonButton 
                  expand="block" 
                  onClick={handleGrantPermission}
                  disabled={state.isRequesting || state.isChecking}
                  style={{ width: '100%' }}
                >
                  {state.isRequesting ? 'Requesting...' : 'Grant Photo Permissions'}
                </IonButton>
              </IonItem>
            </>
          )}
        </IonList>

        <IonAlert
          isOpen={showSettingsAlert}
          onDidDismiss={() => setShowSettingsAlert(false)}
          header="Permission Required"
          message="Photo access can only be changed in System Settings. Would you like to open System Settings now?"
          buttons={[
            {
              text: 'Cancel',
              role: 'cancel',
            },
            {
              text: 'Open Settings',
              handler: handleOpenSettings,
            },
          ]}
        />
      </IonContent>
    </IonPage>
  );
};

export default SettingsTab;
