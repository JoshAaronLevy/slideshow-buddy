import { IonList, IonItem, IonIcon, IonLabel } from '@ionic/react';
import { imagesOutline, musicalNotesOutline, settingsOutline } from 'ionicons/icons';
import { useLocation, useHistory } from 'react-router-dom';
import './DesktopSidebar.css';

const DesktopSidebar: React.FC = () => {
  const location = useLocation();
  const history = useHistory();

  const navItems = [
    { path: '/slideshows', icon: imagesOutline, label: 'Slideshows' },
    { path: '/music', icon: musicalNotesOutline, label: 'Music' },
    { path: '/settings', icon: settingsOutline, label: 'Settings' },
  ];

  return (
    <div className="desktop-sidebar">
      <IonList>
        {navItems.map(item => (
          <IonItem
            key={item.path}
            button
            className={location.pathname === item.path ? 'selected' : ''}
            onClick={() => history.push(item.path)}
          >
            <IonIcon icon={item.icon} slot="start" />
            <IonLabel>{item.label}</IonLabel>
          </IonItem>
        ))}
      </IonList>
    </div>
  );
};

export default DesktopSidebar;