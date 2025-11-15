/**
 * PhotoPickerModal - Modal for selecting photos directly from device library
 * Supports album browsing and infinite scroll
 */

import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonIcon,
  IonText,
  IonFooter,
  IonBadge,
  IonSpinner,
  IonAlert,
} from '@ionic/react';
import { close, checkmarkCircle, chevronForward, chevronBack, imagesOutline, alertCircle } from 'ionicons/icons';
import { useEffect, useState } from 'react';
import { Photo, PhotoAlbum } from '../types';
import { getPhotoAlbums, getPhotosFromAlbum } from '../services/PhotoService';
import * as HapticService from '../services/HapticService';
import './PhotoPickerModal.css';

interface PhotoPickerModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  onConfirm: (selectedPhotos: Photo[]) => void;
  title?: string;
  confirmText?: string;
}

/**
 * PhotoPickerModal Component
 * Allows users to browse albums and select photos from their device library
 */
const PhotoPickerModal: React.FC<PhotoPickerModalProps> = ({
  isOpen,
  onDismiss,
  onConfirm,
  title = 'Select Photos',
  confirmText = 'Done',
}) => {
  const [view, setView] = useState<'albums' | 'photos'>('albums');
  const [albums, setAlbums] = useState<PhotoAlbum[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<PhotoAlbum | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<Map<string, Photo>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [showPerformanceWarning, setShowPerformanceWarning] = useState(false);
  const [hasShownWarning, setHasShownWarning] = useState(false);
  const PAGE_SIZE = 100;
  const PERFORMANCE_WARNING_THRESHOLD = 400;

  // Load albums when modal opens
  useEffect(() => {
    if (isOpen) {
      loadAlbums();
    } else {
      // Reset state when modal closes
      setView('albums');
      setAlbums([]);
      setSelectedAlbum(null);
      setPhotos([]);
      setSelectedPhotos(new Map());
      setError(null);
      setHasMore(true);
      setCurrentPage(1);
      setHasShownWarning(false);
      setShowPerformanceWarning(false);
    }
  }, [isOpen]);

  const loadAlbums = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const albumList = await getPhotoAlbums();
      
      // Add "All Photos" as first album
      const allPhotosAlbum: PhotoAlbum = {
        identifier: '__ALL_PHOTOS__',
        name: 'All Photos',
        type: 'all',
        count: 0,
      };
      
      setAlbums([allPhotosAlbum, ...albumList]);
    } catch (err) {
      console.error('Error loading albums:', err);
      setError(err instanceof Error ? err.message : 'Failed to load albums');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPhotos = async (albumId?: string, loadMore: boolean = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const albumIdentifier = albumId === '__ALL_PHOTOS__' ? undefined : albumId;
      
      // Calculate the page to load
      const pageToLoad = loadMore ? currentPage + 1 : 1;
      const totalQuantity = PAGE_SIZE * pageToLoad;
      
      console.log('[PhotoPicker] Loading photos:', {
        loadMore,
        currentPage,
        pageToLoad,
        totalQuantity,
        albumIdentifier
      });
      
      // Fetch all photos up to the current page
      const allPhotos = await getPhotosFromAlbum(albumIdentifier, totalQuantity);
      
      console.log('[PhotoPicker] Received photos:', {
        allPhotosLength: allPhotos.length,
        requestedQuantity: totalQuantity
      });
      
      if (loadMore) {
        // Only add the new photos (slice from previous page's end)
        const previousCount = PAGE_SIZE * currentPage;
        const newPhotos = allPhotos.slice(previousCount);
        
        console.log('[PhotoPicker] New photos:', {
          previousCount,
          newPhotosLength: newPhotos.length,
          sliceStart: previousCount
        });
        
        if (newPhotos.length === 0) {
          console.log('[PhotoPicker] No more photos - setting hasMore to false');
          setHasMore(false);
        } else {
          setPhotos(prev => [...prev, ...newPhotos]);
          setCurrentPage(pageToLoad);
          
          // If we got fewer new photos than page size, there are no more
          if (newPhotos.length < PAGE_SIZE) {
            console.log('[PhotoPicker] Got fewer than PAGE_SIZE - setting hasMore to false');
            setHasMore(false);
          } else {
            console.log('[PhotoPicker] More photos available');
          }
        }
      } else {
        // Initial load
        setPhotos(allPhotos);
        setCurrentPage(1);
        
        // If we got fewer photos than page size, there are no more
        if (allPhotos.length < PAGE_SIZE) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }
      }
    } catch (err) {
      console.error('Error loading photos:', err);
      setError(err instanceof Error ? err.message : 'Failed to load photos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAlbumClick = async (album: PhotoAlbum) => {
    await HapticService.impactLight();
    setSelectedAlbum(album);
    setPhotos([]);
    setHasMore(true);
    setCurrentPage(1);
    setView('photos');
    await loadPhotos(album.identifier);
  };

  const handleBackToAlbums = async () => {
    await HapticService.impactLight();
    setView('albums');
    setSelectedAlbum(null);
    setPhotos([]);
    setHasMore(true);
    setCurrentPage(1);
  };

  const handlePhotoClick = (photo: Photo) => {
    HapticService.impactLight();
    
    setSelectedPhotos((prev) => {
      const next = new Map(prev);
      if (next.has(photo.id)) {
        next.delete(photo.id);
      } else {
        next.set(photo.id, photo);
        
        // Show performance warning if threshold crossed and not shown yet
        if (!hasShownWarning && next.size >= PERFORMANCE_WARNING_THRESHOLD) {
          setShowPerformanceWarning(true);
          setHasShownWarning(true);
        }
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    HapticService.impactMedium();
    const newSelected = new Map<string, Photo>();
    photos.forEach(photo => newSelected.set(photo.id, photo));
    
    // Show performance warning if threshold crossed and not shown yet
    if (!hasShownWarning && newSelected.size >= PERFORMANCE_WARNING_THRESHOLD) {
      setShowPerformanceWarning(true);
      setHasShownWarning(true);
    }
    
    setSelectedPhotos(newSelected);
  };

  const handleDeselectAll = () => {
    HapticService.impactLight();
    setSelectedPhotos(new Map());
  };

  const handleConfirm = () => {
    HapticService.impactMedium();
    onConfirm(Array.from(selectedPhotos.values()));
  };

  const handleDismiss = () => {
    HapticService.impactLight();
    onDismiss();
  };

  const selectedCount = selectedPhotos.size;

  return (
    <IonModal isOpen={isOpen} onDidDismiss={handleDismiss}>
      <IonHeader>
        <IonToolbar>
          {view === 'photos' && (
            <IonButtons slot="start">
              <IonButton onClick={handleBackToAlbums}>
                <IonIcon slot="icon-only" icon={chevronBack} />
              </IonButton>
            </IonButtons>
          )}
          <IonTitle>{view === 'albums' ? title : selectedAlbum?.name || 'Photos'}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleDismiss}>
              <IonIcon icon={close} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
        {view === 'photos' && (
          <IonToolbar>
            <div className="photo-picker-actions">
              <IonButton size="small" fill="clear" onClick={handleSelectAll}>
                Select All ({photos.length})
              </IonButton>
              <IonBadge color="primary" className="selection-badge">
                {photos.length} loaded{selectedCount > 0 ? ` • ${selectedCount} selected` : ''}
              </IonBadge>
              {selectedCount > 0 && (
                <IonButton size="small" fill="clear" onClick={handleDeselectAll}>
                  Deselect All
                </IonButton>
              )}
            </div>
          </IonToolbar>
        )}
      </IonHeader>

      <IonContent className="photo-picker-content">
        {/* Loading State */}
        {isLoading && photos.length === 0 && albums.length === 0 && (
          <div className="photo-picker-loading">
            <IonSpinner name="crescent" />
            <IonText>
              <p>Loading...</p>
            </IonText>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="photo-picker-error">
            <IonIcon icon={alertCircle} className="error-icon" />
            <IonText color="danger">
              <h2>Error</h2>
              <p>{error}</p>
            </IonText>
            <IonButton onClick={() => view === 'albums' ? loadAlbums() : loadPhotos(selectedAlbum?.identifier)}>
              Try Again
            </IonButton>
          </div>
        )}

        {/* Albums View */}
        {view === 'albums' && !isLoading && !error && (
          <div className="photo-picker-albums">
            {albums.length === 0 ? (
              <div className="photo-picker-empty">
                <IonIcon icon={imagesOutline} className="empty-icon" />
                <IonText color="medium">
                  <h2>No Albums Found</h2>
                  <p>Unable to access photo albums</p>
                </IonText>
              </div>
            ) : (
              albums.map((album) => (
                <div
                  key={album.identifier}
                  className="photo-picker-album-item"
                  onClick={() => handleAlbumClick(album)}
                >
                  <div className="album-info">
                    <IonIcon icon={imagesOutline} className="album-icon" />
                    <div className="album-text">
                      <h3>{album.name}</h3>
                      {album.count > 0 && <p>{album.count} photos</p>}
                    </div>
                  </div>
                  <IonIcon icon={chevronForward} className="album-chevron" />
                </div>
              ))
            )}
          </div>
        )}

        {/* Photos View */}
        {view === 'photos' && !error && (
          <>
            {photos.length === 0 && !isLoading ? (
              <div className="photo-picker-empty">
                <IonIcon icon={imagesOutline} className="empty-icon" />
                <IonText color="medium">
                  <h2>No Photos</h2>
                  <p>This album is empty</p>
                </IonText>
              </div>
            ) : (
              <>
                <div className="photo-picker-grid">
                  {photos.map((photo) => {
                    const isSelected = selectedPhotos.has(photo.id);
                    return (
                      <div
                        key={photo.id}
                        className={`photo-picker-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => handlePhotoClick(photo)}
                      >
                        <img src={photo.uri} alt={photo.filename} loading="lazy" />
                        {isSelected && (
                          <div className="photo-picker-overlay">
                            <IonIcon icon={checkmarkCircle} className="checkmark-icon" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Load More Button */}
                {hasMore && !isLoading && (
                  <div style={{ padding: '16px', textAlign: 'center' }}>
                    <IonButton
                      expand="block"
                      fill="outline"
                      onClick={() => loadPhotos(selectedAlbum?.identifier, true)}
                    >
                      Load More Photos
                    </IonButton>
                  </div>
                )}
                
                {isLoading && photos.length > 0 && (
                  <div style={{ padding: '16px', textAlign: 'center' }}>
                    <IonSpinner name="crescent" />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </IonContent>

      {/* Footer with confirm button */}
      {view === 'photos' && selectedCount > 0 && (
        <IonFooter>
          <IonToolbar>
            <IonButton
              expand="block"
              onClick={handleConfirm}
              className="photo-picker-confirm"
            >
              {confirmText} ({selectedCount})
            </IonButton>
          </IonToolbar>
        </IonFooter>
      )}

      {/* Performance Warning Alert */}
      <IonAlert
        isOpen={showPerformanceWarning}
        onDidDismiss={() => setShowPerformanceWarning(false)}
        header="Large Slideshow"
        message={`You've selected ${selectedCount} photos. Slideshows with over ${PERFORMANCE_WARNING_THRESHOLD} photos may experience slower performance on some devices. Consider creating multiple smaller slideshows for the best experience.`}
        buttons={['Got It']}
      />
    </IonModal>
  );
};

export default PhotoPickerModal;
