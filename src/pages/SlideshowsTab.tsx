/**
 * SlideshowsTab - Main page for managing saved slideshows
 */

import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonFab,
  IonFabButton,
  IonIcon,
  IonText,
  IonRefresher,
  IonRefresherContent,
  RefresherEventDetail,
  useIonToast,
  useIonActionSheet,
} from '@ionic/react';
import { addOutline, playOutline } from 'ionicons/icons';
import { useState, useEffect } from 'react';
import { SavedSlideshow, MusicSource, SlideshowSettings } from '../types/slideshow';
import { Photo } from '../types';
import { useSlideshowLibraryStore } from '../stores/slideshowLibraryStore';
import { usePlaylistLibraryStore } from '../stores/playlistLibraryStore';
import { useMusicStore } from '../stores/musicStore';
import SlideshowCard from '../components/SlideshowCard';
import PhotoPickerModal from '../components/PhotoPickerModal';
import SlideshowConfigModal from '../components/SlideshowConfigModal';
import SlideshowEditModal from '../components/SlideshowEditModal';
import SlideshowPlayer from '../components/SlideshowPlayer';
import SkeletonLoader from '../components/SkeletonLoader';
import * as HapticService from '../services/HapticService';
import './SlideshowsTab.css';

const SlideshowsTab: React.FC = () => {
  const {
    slideshows,
    isLoading,
    loadSlideshows,
    createSlideshow,
    updateSlideshow,
    deleteSlideshow,
    selectSlideshow,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    recordPlay,
  } = useSlideshowLibraryStore();

  const { playlists, loadPlaylists } = usePlaylistLibraryStore();
  const { playlists: spotifyPlaylists } = useMusicStore();

  const [presentToast] = useIonToast();
  const [presentActionSheet] = useIonActionSheet();

  // Modal states
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Photo[]>([]);
  const [slideshowToEdit, setSlideshowToEdit] = useState<SavedSlideshow | null>(null);
  const [slideshowToPlay, setSlideshowToPlay] = useState<SavedSlideshow | null>(null);

  // Load slideshows and playlists on mount
  useEffect(() => {
    loadSlideshows();
    loadPlaylists();
  }, [loadSlideshows, loadPlaylists]);

  // Handle refresh
  const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
    await loadSlideshows();
    await loadPlaylists();
    event.detail.complete();
  };

  // Start creating a new slideshow
  const handleStartNewSlideshow = () => {
    HapticService.impactMedium();
    setShowPhotoPicker(true);
  };

  // After photos selected, show config modal
  const handlePhotosSelected = (photos: Photo[]) => {
    setSelectedPhotos(photos);
    setShowPhotoPicker(false);
    setShowConfigModal(true);
  };

  // Save new slideshow
  const handleSaveSlideshow = async (
    name: string,
    musicSource: MusicSource,
    settings: SlideshowSettings
  ) => {
    try {
      const newSlideshow: import('../types/slideshow').NewSlideshow = {
        name,
        photoIds: selectedPhotos.map(p => p.id),
        photos: selectedPhotos, // Store complete photo objects
        musicSource,
        settings,
      };
      await createSlideshow(newSlideshow);
      setShowConfigModal(false);
      setSelectedPhotos([]);
      
      await presentToast({
        message: 'Slideshow saved!',
        duration: 2000,
        color: 'success',
        position: 'top',
      });
    } catch {
      await presentToast({
        message: 'Failed to save slideshow',
        duration: 3000,
        color: 'danger',
        position: 'top',
      });
    }
  };

  // Save and play new slideshow
  const handleSaveAndPlay = async (
    name: string,
    musicSource: MusicSource,
    settings: SlideshowSettings
  ) => {
    try {
      const newSlideshowData: import('../types/slideshow').NewSlideshow = {
        name,
        photoIds: selectedPhotos.map(p => p.id),
        photos: selectedPhotos, // Store complete photo objects
        musicSource,
        settings,
      };
      const newSlideshow = await createSlideshow(newSlideshowData);
      setShowConfigModal(false);
      setSelectedPhotos([]);

      // Play the slideshow
      selectSlideshow(newSlideshow);
      setSlideshowToPlay(newSlideshow);
      setShowPlayer(true);
    } catch {
      await presentToast({
        message: 'Failed to create slideshow',
        duration: 3000,
        color: 'danger',
        position: 'top',
      });
    }
  };

  // Handle play action from card
  const handlePlaySlideshow = async (slideshow: SavedSlideshow) => {
    HapticService.impactHeavy();
    selectSlideshow(slideshow);
    setSlideshowToPlay(slideshow);
    setShowPlayer(true);
  };
  
  // Handle player close
  const handlePlayerClose = () => {
    setShowPlayer(false);
    setSlideshowToPlay(null);
  };

  // Handle edit action from card
  const handleEditSlideshow = (slideshow: SavedSlideshow) => {
    HapticService.impactLight();
    setSlideshowToEdit(slideshow);
    setShowEditModal(true);
  };

  // Save edited slideshow
  const handleSaveEditedSlideshow = async (updatedSlideshow: SavedSlideshow) => {
    try {
      await updateSlideshow(updatedSlideshow);
      setShowEditModal(false);
      setSlideshowToEdit(null);
      
      await presentToast({
        message: 'Slideshow updated!',
        duration: 2000,
        color: 'success',
        position: 'top',
      });
    } catch {
      await presentToast({
        message: 'Failed to update slideshow',
        duration: 3000,
        color: 'danger',
        position: 'top',
      });
    }
  };

  // Handle delete action from card
  const handleDeleteSlideshow = async (slideshow: SavedSlideshow) => {
    await presentActionSheet({
      header: 'Delete Slideshow?',
      subHeader: `"${slideshow.name}" will be permanently deleted.`,
      buttons: [
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            HapticService.impactHeavy();
            try {
              await deleteSlideshow(slideshow.id);
              await presentToast({
                message: 'Slideshow deleted',
                duration: 2000,
                color: 'medium',
                position: 'top',
              });
            } catch {
              await presentToast({
                message: 'Failed to delete slideshow',
                duration: 3000,
                color: 'danger',
                position: 'top',
              });
            }
          },
        },
        {
          text: 'Cancel',
          role: 'cancel',
          handler: () => {
            HapticService.impactLight();
          },
        },
      ],
    });
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Slideshows</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Slideshows</IonTitle>
          </IonToolbar>
        </IonHeader>

        {/* Pull to Refresh */}
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {/* Loading State */}
        {isLoading && (
          <div className="slideshows-grid">
            <SkeletonLoader type="rectangle" count={4} />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && slideshows.length === 0 && (
          <div className="empty-state">
            <IonIcon
              icon={playOutline}
              className="empty-state-icon"
            />
            <IonText color="medium">
              <h2>No Slideshows Yet</h2>
              <p>Create your first slideshow by selecting photos from your library</p>
              <p className="empty-state-hint">
                Tap the + button below to get started
              </p>
            </IonText>
          </div>
        )}

        {/* Slideshows Content */}
        {!isLoading && slideshows.length > 0 && (
          <>
            {/* Recently Played Section */}
            {slideshows.filter(s => s.lastPlayedAt).length > 0 && (
              <div className="slideshows-section">
                <h3 className="section-heading">Recently Played</h3>
                <div className="slideshows-grid">
                  {slideshows
                    .filter(s => s.lastPlayedAt)
                    .sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0))
                    .slice(0, 4)
                    .map((slideshow) => (
                      <SlideshowCard
                        key={slideshow.id}
                        slideshow={slideshow}
                        onPlay={handlePlaySlideshow}
                        onEdit={handleEditSlideshow}
                        onDelete={handleDeleteSlideshow}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* All Slideshows Section */}
            <div className="slideshows-section">
              <h3 className="section-heading">All Slideshows</h3>
              <div className="slideshows-grid">
                {slideshows.map((slideshow) => (
                  <SlideshowCard
                    key={slideshow.id}
                    slideshow={slideshow}
                    onPlay={handlePlaySlideshow}
                    onEdit={handleEditSlideshow}
                    onDelete={handleDeleteSlideshow}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Floating Action Button */}
        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton onClick={handleStartNewSlideshow} disabled={isLoading}>
            <IonIcon icon={addOutline} />
          </IonFabButton>
        </IonFab>
      </IonContent>

      {/* Photo Picker Modal */}
      <PhotoPickerModal
        isOpen={showPhotoPicker}
        onDismiss={() => setShowPhotoPicker(false)}
        onConfirm={handlePhotosSelected}
      />

      {/* Slideshow Config Modal */}
      <SlideshowConfigModal
        isOpen={showConfigModal}
        selectedPhotos={selectedPhotos}
        customPlaylists={playlists}
        spotifyPlaylists={spotifyPlaylists}
        onDismiss={() => {
          setShowConfigModal(false);
          setSelectedPhotos([]);
        }}
        onSave={handleSaveSlideshow}
        onSaveAndPlay={handleSaveAndPlay}
      />

      {/* Slideshow Edit Modal */}
      <SlideshowEditModal
        isOpen={showEditModal}
        slideshow={slideshowToEdit}
        customPlaylists={playlists}
        spotifyPlaylists={spotifyPlaylists}
        onDismiss={() => {
          setShowEditModal(false);
          setSlideshowToEdit(null);
        }}
        onSave={handleSaveEditedSlideshow}
      />

      {/* Slideshow Player */}
      <SlideshowPlayer
        slideshow={slideshowToPlay}
        isOpen={showPlayer}
        onClose={handlePlayerClose}
      />
    </IonPage>
  );
};

export default SlideshowsTab;
