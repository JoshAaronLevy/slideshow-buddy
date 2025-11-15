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
} from '@ionic/react';
import './SettingsTab.css';
import packageJson from '../../package.json';

const SettingsTab: React.FC = () => {
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
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default SettingsTab;
