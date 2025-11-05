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
  IonSpinner,
  IonText,
  IonAvatar,
  IonIcon,
  IonBadge,
  useIonToast,
} from '@ionic/react';
import { musicalNotesOutline, checkmarkCircle, warningOutline } from 'ionicons/icons';
import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { setupAuthListener } from '../services/SpotifyAuthService';
import './Tab2.css';

const Tab2: React.FC = () => {
  const {
    isAuthenticated,
    user,
    isLoading,
    error,
    login,
    logout,
    handleCallback,
    checkAuthStatus,
    setError,
  } = useAuthStore();

  const [presentToast] = useIonToast();

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Setup OAuth callback listener
  useEffect(() => {
    setupAuthListener((code, state) => {
      handleCallback(code, state);
    });
  }, [handleCallback]);

  // Show error toast
  useEffect(() => {
    if (error) {
      presentToast({
        message: error,
        duration: 3000,
        color: 'danger',
        position: 'top',
      });
      setError(null);
    }
  }, [error, presentToast, setError]);

  const handleLogin = async () => {
    await login();
  };

  const handleLogout = async () => {
    await logout();
  };

  const isPremium = user?.product === 'premium';

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Music</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Music</IonTitle>
          </IonToolbar>
        </IonHeader>

        <div className="music-container">
          {/* Loading State */}
          {isLoading && (
            <IonCard>
              <IonCardContent className="loading-card">
                <IonSpinner name="crescent" />
                <IonText>
                  <p>Connecting to Spotify...</p>
                </IonText>
              </IonCardContent>
            </IonCard>
          )}

          {/* Not Connected State */}
          {!isLoading && !isAuthenticated && (
            <IonCard className="connection-card">
              <IonCardHeader>
                <div className="spotify-logo-container">
                  <IonIcon icon={musicalNotesOutline} className="spotify-logo" />
                </div>
                <IonCardTitle className="text-center">Connect to Spotify</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <IonText color="medium" className="text-center">
                  <p>
                    Connect your Spotify account to play music during your slideshows.
                  </p>
                  <p className="premium-note">
                    <strong>Note:</strong> Spotify Premium is required for music playback.
                  </p>
                </IonText>
                <IonButton
                  expand="block"
                  onClick={handleLogin}
                  className="spotify-button"
                  disabled={isLoading}
                >
                  <IonIcon icon={musicalNotesOutline} slot="start" />
                  Connect with Spotify
                </IonButton>
              </IonCardContent>
            </IonCard>
          )}

          {/* Connected State */}
          {!isLoading && isAuthenticated && user && (
            <>
              <IonCard className="profile-card">
                <IonCardContent>
                  <div className="profile-header">
                    {user.images && user.images.length > 0 ? (
                      <IonAvatar className="profile-avatar">
                        <img src={user.images[0].url} alt={user.display_name} />
                      </IonAvatar>
                    ) : (
                      <IonAvatar className="profile-avatar">
                        <div className="avatar-placeholder">
                          {user.display_name?.charAt(0).toUpperCase()}
                        </div>
                      </IonAvatar>
                    )}
                    <div className="profile-info">
                      <h2>{user.display_name}</h2>
                      {user.email && (
                        <IonText color="medium">
                          <p>{user.email}</p>
                        </IonText>
                      )}
                      <div className="account-status">
                        {isPremium ? (
                          <IonBadge color="success">
                            <IonIcon icon={checkmarkCircle} />
                            <span>Premium</span>
                          </IonBadge>
                        ) : (
                          <IonBadge color="warning">
                            <IonIcon icon={warningOutline} />
                            <span>Free Account</span>
                          </IonBadge>
                        )}
                      </div>
                    </div>
                  </div>

                  {!isPremium && (
                    <div className="premium-warning">
                      <IonText color="warning">
                        <p>
                          <strong>Spotify Premium Required</strong>
                        </p>
                        <p>
                          Music playback requires a Spotify Premium subscription. Please
                          upgrade your account to use this feature.
                        </p>
                      </IonText>
                    </div>
                  )}

                  <IonButton
                    expand="block"
                    fill="outline"
                    onClick={handleLogout}
                    className="disconnect-button"
                  >
                    Disconnect
                  </IonButton>
                </IonCardContent>
              </IonCard>

              {/* Placeholder for future music selection UI */}
              {isPremium && (
                <IonCard>
                  <IonCardHeader>
                    <IonCardTitle>Your Music</IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    <IonText color="medium" className="text-center">
                      <p>Music selection will be available in Phase 3</p>
                    </IonText>
                  </IonCardContent>
                </IonCard>
              )}
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Tab2;
