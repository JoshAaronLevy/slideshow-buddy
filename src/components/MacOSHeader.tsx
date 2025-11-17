import { IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon } from '@ionic/react';
import { settingsOutline, musicalNotesOutline, imagesOutline, personCircleOutline } from 'ionicons/icons';
import { useHistory, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import ProfilePopover from './ProfilePopover';
import * as HapticService from '../services/HapticService';
import './MacOSHeader.css';

const MacOSHeader: React.FC = () => {
  const history = useHistory();
  const location = useLocation();
  const { isAuthenticated, logout } = useAuthStore();
  const [showProfilePopover, setShowProfilePopover] = useState(false);
  const [popoverEvent, setPopoverEvent] = useState<Event>();

  const handleSettingsClick = () => {
    history.push('/settings');
  };

  const handleSlideshowsClick = () => {
    history.push('/slideshows');
  };

  const handleMusicClick = () => {
    history.push('/music');
  };

  const handleProfileClick = (e: React.MouseEvent) => {
    HapticService.impactLight();
    setPopoverEvent(e.nativeEvent);
    setShowProfilePopover(true);
  };

  const handleLogout = async () => {
    setShowProfilePopover(false);
    await HapticService.impactMedium();
    await logout();
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
          {isAuthenticated && (
            <IonButton
              fill="clear"
              onClick={handleProfileClick}
              className="profile-button"
            >
              <IonIcon icon={personCircleOutline} />
            </IonButton>
          )}
        </IonButtons>
      </IonToolbar>
      
      <ProfilePopover
        isOpen={showProfilePopover}
        event={popoverEvent}
        onDismiss={() => setShowProfilePopover(false)}
        onLogout={handleLogout}
      />
    </IonHeader>
  );
};

export default MacOSHeader;