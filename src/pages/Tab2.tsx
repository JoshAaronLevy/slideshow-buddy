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
  IonSearchbar,
  IonList,
  IonItem,
  IonLabel,
  IonThumbnail,
  IonRefresher,
  IonRefresherContent,
  useIonToast,
  RefresherEventDetail,
} from '@ionic/react';
import {
  musicalNotesOutline,
  checkmarkCircle,
  warningOutline,
  musicalNotesSharp,
  playCircleOutline,
} from 'ionicons/icons';
import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useMusicStore } from '../stores/musicStore';
import { setupAuthListener } from '../services/SpotifyAuthService';
import { SpotifyPlaylist } from '../types';
import PlaylistDetailModal from '../components/PlaylistDetailModal';
import SkeletonLoader from '../components/SkeletonLoader';
import * as HapticService from '../services/HapticService';
import './Tab2.css';

/**
 * MusicSelection Component - Displays playlists and music selection
 */
const MusicSelection: React.FC = () => {
  const {
    playlists,
    recentTracks,
    featuredPlaylists,
    searchResults,
    selectedPlaylist,
    isLoading,
    searchQuery,
    fetchPlaylists,
    fetchRecentTracks,
    fetchFeaturedPlaylists,
    searchMusic,
    selectPlaylist,
    setSearchQuery,
    clearSearchResults,
  } = useMusicStore();

  const [searchDebounce, setSearchDebounce] = useState<NodeJS.Timeout | null>(null);
  const [showPlaylistDetail, setShowPlaylistDetail] = useState(false);
  const [viewingPlaylist, setViewingPlaylist] = useState<SpotifyPlaylist | null>(null);

  // Fetch initial data
  useEffect(() => {
    fetchPlaylists();
    fetchRecentTracks();
    fetchFeaturedPlaylists();
  }, [fetchPlaylists, fetchRecentTracks, fetchFeaturedPlaylists]);

  // Handle search with debouncing
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);

      if (searchDebounce) {
        clearTimeout(searchDebounce);
      }

      if (!query.trim()) {
        clearSearchResults();
        return;
      }

      const timeout = setTimeout(() => {
        searchMusic(query);
      }, 500); // 500ms debounce

      setSearchDebounce(timeout);
    },
    [searchDebounce, setSearchQuery, clearSearchResults, searchMusic]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (searchDebounce) {
        clearTimeout(searchDebounce);
      }
    };
  }, [searchDebounce]);

  // Handle pull-to-refresh
  const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
    await fetchPlaylists();
    await fetchRecentTracks();
    await fetchFeaturedPlaylists();
    event.detail.complete();
  };

  const handlePlaylistClick = async (playlist: SpotifyPlaylist) => {
    await HapticService.impactLight();
    selectPlaylist(playlist);
    setViewingPlaylist(playlist);
    setShowPlaylistDetail(true);
  };

  const handleModalDismiss = () => {
    setShowPlaylistDetail(false);
    setViewingPlaylist(null);
  };

  // Determine which playlists to show
  const displayPlaylists = searchQuery
    ? searchResults.playlists
    : playlists;

  const showRecentTracks = !searchQuery && recentTracks.length > 0;
  const showFeaturedPlaylists = !searchQuery && featuredPlaylists.length > 0;

  return (
    <>
      <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
        <IonRefresherContent />
      </IonRefresher>

      {/* Search Bar */}
      <div className="music-search">
        <IonSearchbar
          value={searchQuery}
          onIonInput={(e) => handleSearch(e.detail.value || '')}
          placeholder="Search playlists and tracks"
          debounce={0} // We handle debouncing manually
        />
      </div>

      {/* Loading State */}
      {isLoading && (
        <>
          <IonCard>
            <IonCardHeader>
              <SkeletonLoader type="text" width="60%" height="24px" />
            </IonCardHeader>
            <IonCardContent className="music-card-content">
              <SkeletonLoader type="list-item" count={5} />
            </IonCardContent>
          </IonCard>
          <IonCard>
            <IonCardHeader>
              <SkeletonLoader type="text" width="50%" height="24px" />
            </IonCardHeader>
            <IonCardContent className="music-card-content">
              <SkeletonLoader type="list-item" count={8} />
            </IonCardContent>
          </IonCard>
        </>
      )}

      {/* Recently Played Section */}
      {!isLoading && showRecentTracks && (
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Recently Played</IonCardTitle>
          </IonCardHeader>
          <IonCardContent className="music-card-content">
            <IonList lines="none">
              {recentTracks.slice(0, 5).map((track) => (
                <IonItem key={track.id} className="track-item">
                  <IonIcon icon={musicalNotesSharp} slot="start" color="primary" />
                  <IonLabel>
                    <h3>{track.name}</h3>
                    <p>{track.artists.join(', ')}</p>
                  </IonLabel>
                </IonItem>
              ))}
            </IonList>
          </IonCardContent>
        </IonCard>
      )}

      {/* Playlists Section */}
      {!isLoading && (
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>
              {searchQuery ? 'Search Results' : 'Your Playlists'}
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent className="music-card-content">
            {displayPlaylists.length === 0 && !isLoading && (
            <div className="empty-state">
              <IonIcon icon={musicalNotesSharp} className="empty-state-icon" />
              <IonText color="medium" className="text-center">
                <p>
                  {searchQuery
                    ? 'No playlists found'
                    : 'No playlists available'}
                </p>
                {!searchQuery && (
                  <p className="empty-state-hint">
                    Create some playlists in Spotify to get started
                  </p>
                )}
              </IonText>
            </div>
          )}

          <IonList lines="none">
            {displayPlaylists.map((playlist) => (
              <IonItem
                key={playlist.id}
                button
                onClick={() => handlePlaylistClick(playlist)}
                className={`playlist-item ${
                  selectedPlaylist?.id === playlist.id ? 'selected' : ''
                }`}
                aria-label={`${playlist.name} playlist by ${playlist.owner}, ${playlist.track_count} tracks${
                  selectedPlaylist?.id === playlist.id ? ', currently selected' : ''
                }`}
              >
                <IonThumbnail slot="start" className="playlist-thumbnail">
                  {playlist.image_url ? (
                    <img src={playlist.image_url} alt={playlist.name} />
                  ) : (
                    <div className="playlist-placeholder">
                      <IonIcon icon={musicalNotesSharp} />
                    </div>
                  )}
                </IonThumbnail>
                <IonLabel>
                  <h3>{playlist.name}</h3>
                  <p>
                    {playlist.track_count} tracks • {playlist.owner}
                  </p>
                </IonLabel>
                {selectedPlaylist?.id === playlist.id && (
                  <IonIcon icon={checkmarkCircle} slot="end" color="success" />
                )}
              </IonItem>
            ))}
          </IonList>
        </IonCardContent>
        </IonCard>
      )}

      {/* Featured Playlists Section */}
      {!isLoading && showFeaturedPlaylists && (
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Featured Playlists</IonCardTitle>
          </IonCardHeader>
          <IonCardContent className="music-card-content">
            <IonList lines="none">
              {featuredPlaylists.map((playlist) => (
                <IonItem
                  key={playlist.id}
                  button
                  onClick={() => handlePlaylistClick(playlist)}
                  className="playlist-item"
                  aria-label={`Featured playlist: ${playlist.name}, ${playlist.description || 'Curated by Spotify'}`}
                >
                  <IonThumbnail slot="start" className="playlist-thumbnail">
                    {playlist.image_url ? (
                      <img src={playlist.image_url} alt={playlist.name} />
                    ) : (
                      <div className="playlist-placeholder">
                        <IonIcon icon={musicalNotesSharp} />
                      </div>
                    )}
                  </IonThumbnail>
                  <IonLabel>
                    <h3>{playlist.name}</h3>
                    <p>{playlist.description || 'Curated by Spotify'}</p>
                  </IonLabel>
                  <IonIcon icon={playCircleOutline} slot="end" color="medium" />
                </IonItem>
              ))}
            </IonList>
          </IonCardContent>
        </IonCard>
      )}

      {/* Playlist Detail Modal */}
      <PlaylistDetailModal
        isOpen={showPlaylistDetail}
        playlist={viewingPlaylist}
        onDismiss={handleModalDismiss}
      />
    </>
  );
};

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
    await HapticService.impactMedium();
    await login();
  };

  const handleLogout = async () => {
    await HapticService.impactLight();
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
                  aria-label="Connect with Spotify to access your music"
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
                    aria-label="Disconnect from Spotify"
                  >
                    Disconnect
                  </IonButton>
                </IonCardContent>
              </IonCard>

              {/* Music Selection UI */}
              {isPremium && <MusicSelection />}
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Tab2;
