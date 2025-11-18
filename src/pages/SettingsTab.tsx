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
  IonNote,
} from '@ionic/react';
import { useState } from 'react';
import './SettingsTab.css';
import packageJson from '../../package.json';
import { isMacOS } from '../utils/platform';

const SettingsTab: React.FC = () => {
  const [permissionStatus, setPermissionStatus] = useState<string>('Not tested yet');
  const [isRequesting, setIsRequesting] = useState(false);
  const showPhotoTest = isMacOS() && (window as any).electron?.photos;

  const handleTestPhotosPermission = async () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[RENDERER-TEST-BUTTON] 🔘 Test Photos Permission button clicked');
    console.log('[RENDERER-TEST-BUTTON] Timestamp:', new Date().toISOString());
    console.log('[RENDERER-TEST-BUTTON] Platform:', navigator.platform);
    console.log('[RENDERER-TEST-BUTTON] User Agent:', navigator.userAgent);
    
    setIsRequesting(true);
    setPermissionStatus('Requesting permission...');
    
    try {
      console.log('[RENDERER-TEST-BUTTON] Checking if electron.photos API exists...');
      
      if (!(window as any).electron?.photos) {
        const errorMsg = 'ERROR: window.electron.photos API not available!';
        console.error('[RENDERER-TEST-BUTTON]', errorMsg);
        console.error('[RENDERER-TEST-BUTTON] window.electron:', (window as any).electron);
        setPermissionStatus(errorMsg);
        return;
      }
      
      console.log('[RENDERER-TEST-BUTTON] ✓ API available, starting permission request flow...');
      console.log('[RENDERER-TEST-BUTTON] Calling window.electron.photos.requestPermission()...');
      console.log('[Photos Permission Test] Invoking photos.requestPermission - PhotoKit only, no filesystem access');
      
      const startTime = performance.now();
      const result = await (window as any).electron.photos.requestPermission();
      const duration = performance.now() - startTime;
      
      console.log('[RENDERER-TEST-BUTTON] ━━━ IPC CALL COMPLETED ━━━');
      console.log('[RENDERER-TEST-BUTTON] Duration:', duration.toFixed(2), 'ms');
      console.log('[RENDERER-TEST-BUTTON] Raw result:', result);
      console.log('[RENDERER-TEST-BUTTON] Result type:', typeof result);
      console.log('[RENDERER-TEST-BUTTON] Result.success:', result.success);
      console.log('[RENDERER-TEST-BUTTON] Result.hasPermission:', result.hasPermission);
      console.log('[RENDERER-TEST-BUTTON] Result.error:', result.error);
      
      if (result.success) {
        if (result.hasPermission) {
          const successMsg = `✓ PERMISSION GRANTED (${duration.toFixed(0)}ms)`;
          console.log('[RENDERER-TEST-BUTTON] ✓✓✓', successMsg);
          setPermissionStatus(successMsg);
        } else {
          const deniedMsg = `✗ PERMISSION DENIED (${duration.toFixed(0)}ms)`;
          console.log('[RENDERER-TEST-BUTTON] ✗✗✗', deniedMsg);
          setPermissionStatus(deniedMsg);
        }
      } else {
        const errorMsg = `ERROR: ${result.error || 'Unknown error'}`;
        console.error('[RENDERER-TEST-BUTTON]', errorMsg);
        setPermissionStatus(errorMsg);
      }
    } catch (error) {
      console.error('[RENDERER-TEST-BUTTON] ⚠️  EXCEPTION CAUGHT:', error);
      console.error('[RENDERER-TEST-BUTTON] Error name:', (error as any).name);
      console.error('[RENDERER-TEST-BUTTON] Error message:', (error as any).message);
      console.error('[RENDERER-TEST-BUTTON] Error stack:', (error as any).stack);
      setPermissionStatus(`Exception: ${(error as any).message}`);
    } finally {
      setIsRequesting(false);
      console.log('[RENDERER-TEST-BUTTON] Test completed');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
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

          {showPhotoTest && (
            <>
              <IonItem lines="none">
                <IonLabel>
                  <h2>macOS Photos Permission Test</h2>
                  <IonText color="medium">
                    <p>Debug tool to test Photos library permission dialog</p>
                  </IonText>
                </IonLabel>
              </IonItem>
              
              <IonItem>
                <IonButton 
                  expand="block" 
                  onClick={handleTestPhotosPermission}
                  disabled={isRequesting}
                  style={{ width: '100%' }}
                >
                  {isRequesting ? 'Requesting...' : 'Test Photos Permission'}
                </IonButton>
              </IonItem>
              
              <IonItem lines="none">
                <IonLabel>
                  <IonNote color={permissionStatus.includes('GRANTED') ? 'success' : permissionStatus.includes('DENIED') || permissionStatus.includes('ERROR') ? 'danger' : 'medium'}>
                    Status: {permissionStatus}
                  </IonNote>
                  <IonText color="medium">
                    <p style={{ fontSize: '0.85em', marginTop: '8px' }}>
                      Check browser console and macOS Console.app for detailed logs
                    </p>
                  </IonText>
                </IonLabel>
              </IonItem>
            </>
          )}
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default SettingsTab;
