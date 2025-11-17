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
import { close, checkmarkCircle, chevronForward, chevronBack, imagesOutline, alertCircle, cloudUploadOutline, trashOutline, addOutline } from 'ionicons/icons';
import { useEffect, useState } from 'react';
import { Photo, PhotoAlbum, PhotoImportResult } from '../types';
import { getPhotoAlbums, getPhotosFromAlbum } from '../services/PhotoService';
import * as PhotoLibraryService from '../services/PhotoLibraryService';
import { usePhotoStore } from '../stores/photoStore';
import * as HapticService from '../services/HapticService';
import { isMacOS } from '../utils/platform';
import ContextMenu from './ContextMenu';
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
  const isDesktop = isMacOS();
  // On macOS, default to 'library' view; on iOS/Android, use 'albums'
  const [view, setView] = useState<'library' | 'albums' | 'photos'>(isDesktop ? 'library' : 'albums');
  const [albums, setAlbums] = useState<PhotoAlbum[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<PhotoAlbum | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<Map<string, Photo>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<PhotoImportResult | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [showPerformanceWarning, setShowPerformanceWarning] = useState(false);
  const [hasShownWarning, setHasShownWarning] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; photo: Photo } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const PAGE_SIZE = 100;
  const PERFORMANCE_WARNING_THRESHOLD = 400;
  
  // Use photo store for library management
  const photoStore = usePhotoStore();

  // Load appropriate view when modal opens
  useEffect(() => {
    if (isOpen) {
      if (isDesktop) {
        // macOS: Load library photos
        loadLibraryPhotos();
      } else {
        // iOS/Android: Load albums
        loadAlbums();
      }
    } else {
      // Reset state when modal closes
      setView(isDesktop ? 'library' : 'albums');
      setAlbums([]);
      setSelectedAlbum(null);
      setPhotos([]);
      setSelectedPhotos(new Map());
      setError(null);
      setImportResult(null);
      setHasMore(true);
      setCurrentPage(1);
      setHasShownWarning(false);
      setShowPerformanceWarning(false);
      setContextMenu(null);
      setIsDragOver(false);
      setIsImporting(false);
    }
  }, [isOpen, isDesktop]);

  /**
   * Load photos from the library (macOS only)
   */
  const loadLibraryPhotos = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const libraryPhotos = await PhotoLibraryService.getLibraryPhotos();
      setPhotos(libraryPhotos);
      console.log(`[PhotoPicker] Loaded ${libraryPhotos.length} photos from library`);
    } catch (err) {
      console.error('Error loading library photos:', err);
      setError(err instanceof Error ? err.message : 'Failed to load library photos');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Import photos to library (macOS only)
   */
  const handleImportPhotos = async () => {
    setIsImporting(true);
    setError(null);
    setImportResult(null);
    
    try {
      const result = await photoStore.importPhotosToLibrary();
      setImportResult(result);
      
      if (result.success && result.imported.length > 0) {
        // Reload library photos
        await loadLibraryPhotos();
        await HapticService.notificationSuccess();
      }
    } catch (err) {
      console.error('Error importing photos:', err);
      setError(err instanceof Error ? err.message : 'Failed to import photos');
      await HapticService.notificationError();
    } finally {
      setIsImporting(false);
    }
  };

  /**
   * Delete selected photos from library (macOS only)
   */
  const handleDeleteFromLibrary = async () => {
    const photoIdsToDelete = Array.from(selectedPhotos.keys());
    
    if (photoIdsToDelete.length === 0) return;
    
    try {
      const deleted = await PhotoLibraryService.deleteFromLibrary(photoIdsToDelete);
      
      if (deleted) {
        // Remove deleted photos from current view
        setPhotos(prev => prev.filter(p => !photoIdsToDelete.includes(p.id)));
        setSelectedPhotos(new Map());
        await HapticService.notificationSuccess();
      }
    } catch (err) {
      console.error('Error deleting photos from library:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete photos');
      await HapticService.notificationError();
    }
  };

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

  const handlePhotoContextMenu = (e: React.MouseEvent, photo: Photo) => {
    if (!isMacOS()) return;
    
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, photo });
  };

  const handleTogglePhotoSelection = (photo: Photo) => {
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

  // Drag & Drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    if (!isDesktop) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!isDesktop) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isDesktop) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (!isDesktop) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      await handleDroppedFiles(imageFiles);
    }
  };

  const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleDroppedFiles = async (files: File[]) => {
    if (isDesktop && view === 'library') {
      // On macOS library view, import to library
      // Note: This is a placeholder - actual file drop import would need
      // Electron to handle File -> file path conversion
      console.log('[PhotoPicker] Drag & drop on library view - use Import button instead');
      setError('Please use the Import button to add photos to your library');
      return;
    }
    
    try {
      // Convert File objects to Photo objects (for non-library views)
      const droppedPhotos = await Promise.all(
        files.map(async (file) => {
          const uri = await fileToDataURL(file);
          return {
            id: `dropped-${Date.now()}-${Math.random()}`,
            uri,
            filename: file.name,
            timestamp: file.lastModified,
            selected: false
          };
        })
      );
      
      // Add to existing photos at the beginning for immediate visibility
      setPhotos(prev => [...droppedPhotos, ...prev]);
      
      // Auto-select the dropped photos
      setSelectedPhotos(prev => {
        const next = new Map(prev);
        droppedPhotos.forEach(photo => next.set(photo.id, photo));
        
        // Show performance warning if threshold crossed and not shown yet
        if (!hasShownWarning && next.size >= PERFORMANCE_WARNING_THRESHOLD) {
          setShowPerformanceWarning(true);
          setHasShownWarning(true);
        }
        
        return next;
      });
      
    } catch (error) {
      console.error('Error processing dropped files:', error);
      setError('Failed to process dropped files');
    }
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
          <IonTitle>
            {view === 'library' ? 'Photo Library' : view === 'albums' ? title : selectedAlbum?.name || 'Photos'}
          </IonTitle>
          <IonButtons slot="end">
            {view === 'library' && isDesktop && (
              <IonButton onClick={handleImportPhotos} disabled={isImporting}>
                <IonIcon slot="start" icon={addOutline} />
                Import
              </IonButton>
            )}
            <IonButton onClick={handleDismiss}>
              <IonIcon icon={close} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
        {(view === 'photos' || view === 'library') && (
          <IonToolbar>
            <div className="photo-picker-actions">
              {photos.length > 0 && (
                <IonButton size="small" fill="clear" onClick={handleSelectAll}>
                  Select All ({photos.length})
                </IonButton>
              )}
              <IonBadge color="primary" className="selection-badge">
                {photos.length} in library{selectedCount > 0 ? ` • ${selectedCount} selected` : ''}
              </IonBadge>
              {selectedCount > 0 && (
                <>
                  <IonButton size="small" fill="clear" onClick={handleDeselectAll}>
                    Deselect All
                  </IonButton>
                  {view === 'library' && isDesktop && (
                    <IonButton size="small" fill="clear" color="danger" onClick={handleDeleteFromLibrary}>
                      <IonIcon slot="start" icon={trashOutline} />
                      Delete ({selectedCount})
                    </IonButton>
                  )}
                </>
              )}
            </div>
          </IonToolbar>
        )}
      </IonHeader>

      <IonContent
        className={`photo-picker-content ${isDragOver ? 'drag-over' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isDragOver && isDesktop && (
          <div className="drop-overlay">
            <p>Drop photos here to import</p>
          </div>
        )}
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

        {/* Library View (macOS) */}
        {view === 'library' && !error && (
          <>
            {photos.length === 0 && !isLoading ? (
              <div className="photo-picker-empty">
                <IonIcon icon={cloudUploadOutline} className="empty-icon" />
                <IonText color="medium">
                  <h2>No Photos in Library</h2>
                  <p>Import photos to get started</p>
                </IonText>
                <IonButton
                  expand="block"
                  onClick={handleImportPhotos}
                  disabled={isImporting}
                  style={{ maxWidth: '300px', margin: '20px auto 0' }}
                >
                  <IonIcon slot="start" icon={addOutline} />
                  {isImporting ? 'Importing...' : 'Import Photos'}
                </IonButton>
                {importResult && (
                  <IonText color={importResult.success ? 'success' : 'danger'} style={{ marginTop: '16px' }}>
                    <p>
                      {importResult.success
                        ? `Imported ${importResult.imported.length} photos${importResult.duplicates > 0 ? ` (${importResult.duplicates} duplicates skipped)` : ''}`
                        : `Import failed${importResult.errors ? ': ' + importResult.errors[0] : ''}`}
                    </p>
                  </IonText>
                )}
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
                        onContextMenu={(e) => handlePhotoContextMenu(e, photo)}
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
                
                {importResult && (
                  <div style={{ padding: '16px', textAlign: 'center' }}>
                    <IonText color={importResult.success ? 'success' : 'danger'}>
                      <p>
                        {importResult.success
                          ? `Imported ${importResult.imported.length} photos${importResult.duplicates > 0 ? ` (${importResult.duplicates} duplicates skipped)` : ''}`
                          : `Import failed${importResult.errors ? ': ' + importResult.errors[0] : ''}`}
                      </p>
                    </IonText>
                  </div>
                )}
              </>
            )}
          </>
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
                        onContextMenu={(e) => handlePhotoContextMenu(e, photo)}
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
      {(view === 'photos' || view === 'library') && selectedCount > 0 && (
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

      {/* Context Menu for Photos */}
      {contextMenu && (
        <ContextMenu
          items={[
            {
              label: selectedPhotos.has(contextMenu.photo.id) ? 'Deselect' : 'Select',
              action: () => handleTogglePhotoSelection(contextMenu.photo)
            },
            ...(view === 'library' && isDesktop ? [
              {
                label: 'Delete from Library',
                action: async () => {
                  await PhotoLibraryService.deleteFromLibrary([contextMenu.photo.id]);
                  setPhotos(prev => prev.filter(p => p.id !== contextMenu.photo.id));
                  setSelectedPhotos(prev => {
                    const next = new Map(prev);
                    next.delete(contextMenu.photo.id);
                    return next;
                  });
                  await HapticService.notificationSuccess();
                },
                destructive: true
              }
            ] : [])
          ]}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </IonModal>
  );
};

export default PhotoPickerModal;
