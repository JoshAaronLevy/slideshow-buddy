import { IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon } from '@ionic/react';
import { settingsOutline, musicalNotesOutline, imagesOutline } from 'ionicons/icons';
import { useHistory, useLocation } from 'react-router-dom';
import './MacOSHeader.css';

const MacOSHeader: React.FC = () => {
  const history = useHistory();
  const location = useLocation();

  const handleSettingsClick = () => {
    history.push('/settings');
  };

  const handleSlideshowsClick = () => {
    history.push('/slideshows');
  };

  const handleMusicClick = () => {
    history.push('/music');
  };

  // Get page title based on current route
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/slideshows':
        return 'Slideshows';
      case '/music':
        return 'Music';
      case '/settings':
        return 'Settings';
      default:
        return 'Slideshow Buddy';
    }
  };

  return (
    <IonHeader className="macos-header">
      <IonToolbar>
        <IonTitle>{getPageTitle()}</IonTitle>
        <IonButtons slot="end">
          <IonButton
            fill="clear"
            onClick={handleSlideshowsClick}
            className={location.pathname === '/slideshows' ? 'active' : ''}
          >
            <IonIcon icon={imagesOutline} />
          </IonButton>
          <IonButton
            fill="clear"
            onClick={handleMusicClick}
            className={location.pathname === '/music' ? 'active' : ''}
          >
            <IonIcon icon={musicalNotesOutline} />
          </IonButton>
          <IonButton
            fill="clear"
            onClick={handleSettingsClick}
            className={location.pathname === '/settings' ? 'active' : ''}
          >
            <IonIcon icon={settingsOutline} />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
  );
};

export default MacOSHeader;