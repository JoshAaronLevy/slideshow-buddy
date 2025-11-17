import {
  IonPopover,
  IonContent,
  IonButton,
  IonAvatar,
  IonText,
  IonBadge,
  IonIcon,
} from '@ionic/react';
import { checkmarkCircle, warningOutline } from 'ionicons/icons';
import { useAuthStore } from '../stores/authStore';
import './ProfilePopover.css';

interface ProfilePopoverProps {
  isOpen: boolean;
  event: Event | undefined;
  onDismiss: () => void;
  onLogout: () => void;
}

const ProfilePopover: React.FC<ProfilePopoverProps> = ({
  isOpen,
  event,
  onDismiss,
  onLogout,
}) => {
  const { user } = useAuthStore();

  if (!user) return null;

  const isPremium = user.product === 'premium';

  return (
    <IonPopover
      isOpen={isOpen}
      event={event}
      onDidDismiss={onDismiss}
      className="profile-popover"
      side="bottom"
      alignment="end"
    >
      <IonContent>
        <div className="profile-popover-content">
          {/* Profile Header */}
          <div className="profile-popover-header">
            {user.images && user.images.length > 0 ? (
              <IonAvatar className="profile-popover-avatar">
                <img src={user.images[0].url} alt={user.display_name} />
              </IonAvatar>
            ) : (
              <IonAvatar className="profile-popover-avatar">
                <div className="avatar-placeholder">
                  {user.display_name?.charAt(0).toUpperCase()}
                </div>
              </IonAvatar>
            )}
            <div className="profile-popover-info">
              <h3>{user.display_name}</h3>
              {user.email && (
                <IonText color="medium">
                  <p className="profile-email">{user.email}</p>
                </IonText>
              )}
              <div className="profile-badge">
                {isPremium ? (
                  <IonBadge color="success">
                    <IonIcon icon={checkmarkCircle} />
                    <span>Premium</span>
                  </IonBadge>
                ) : (
                  <IonBadge color="warning">
                    <IonIcon icon={warningOutline} />
                    <span>Free</span>
                  </IonBadge>
                )}
              </div>
            </div>
          </div>

          {/* Disconnect Button */}
          <div className="profile-popover-actions">
            <IonButton
              expand="block"
              fill="outline"
              color="danger"
              onClick={onLogout}
            >
              Disconnect from Spotify
            </IonButton>
          </div>
        </div>
      </IonContent>
    </IonPopover>
  );
};

export default ProfilePopover;
