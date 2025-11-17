/**
 * PhotoLibraryManager - Advanced photo library management interface
 * Provides statistics, bulk operations, search, and organization features
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonButton,
  IonIcon,
  IonText,
  IonItem,
  IonLabel,
  IonBadge,
  IonGrid,
  IonRow,
  IonCol,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonList,
  IonCheckbox,
  IonAlert,
  IonSpinner,
  useIonToast,
  useIonActionSheet,
} from '@ionic/react';
import {
  images,
  trashOutline,
  funnelOutline,
  statsChartOutline,
  refreshOutline,
  checkmarkCircleOutline,
} from 'ionicons/icons';
import { usePhotoStore } from '../stores/photoStore';
import { useSlideshowLibraryStore } from '../stores/slideshowLibraryStore';
import * as PhotoLibraryService from '../services/PhotoLibraryService';
import * as StorageOptimizationService from '../services/StorageOptimizationService';
import { isMacOS } from '../utils/platform';
import './PhotoLibraryManager.css';

interface PhotoLibraryStats {
  totalPhotos: number;
  totalSize: number;
  oldestImport: number | null;
  newestImport: number | null;
  averageSize: number;
  unusedPhotos: number;
}

interface PhotoUsage {
  photoId: string;
  slideshowIds: string[];
  slideshowNames: string[];
}

const PhotoLibraryManager: React.FC = () => {
  const { photos, loadPhotos, isLoading } = usePhotoStore();
  const { slideshows } = useSlideshowLibraryStore();
  
  const [stats, setStats] = useState<PhotoLibraryStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [photoUsageMap, setPhotoUsageMap] = useState<Map<string, PhotoUsage>>(new Map());
  const [isCalculatingUsage, setIsCalculatingUsage] = useState(false);
  const [showUnusedOnly, setShowUnusedOnly] = useState(false);
  const [storageQuota, setStorageQuota] = useState<{ usagePercentage: number; isWarning: boolean; isCritical: boolean } | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  
  const [presentToast] = useIonToast();
  const [presentActionSheet] = useIonActionSheet();

  // Monitor storage quota
  useEffect(() => {
    const checkQuota = async () => {
      try {
        const stats = await StorageOptimizationService.getStorageStats();
        setStorageQuota({
          usagePercentage: stats.usagePercentage,
          isWarning: stats.isWarning,
          isCritical: stats.isCritical,
        });
      } catch (error) {
        console.error('[PhotoLibraryManager] Error checking storage quota:', error);
      }
    };
    
    if (photos.length > 0) {
      checkQuota();
    }
  }, [photos]);

  // Calculate library statistics
  useEffect(() => {
    const calculateStats = async () => {
      if (photos.length === 0) {
        setStats(null);
        return;
      }

      try {
        // Calculate basic stats
        const totalSize = photos.reduce((sum, photo) => sum + (photo.fileSize || 0), 0);
        const importDates = photos
          .map(p => p.importedAt)
          .filter((date): date is number => date !== undefined)
          .sort((a, b) => a - b);
        
        const oldestImport = importDates.length > 0 ? importDates[0] : null;
        const newestImport = importDates.length > 0 ? importDates[importDates.length - 1] : null;
        const averageSize = photos.length > 0 ? totalSize / photos.length : 0;

        // Calculate usage
        const usageMap = new Map<string, PhotoUsage>();
        slideshows.forEach(slideshow => {
          slideshow.photoIds.forEach(photoId => {
            const existing = usageMap.get(photoId);
            if (existing) {
              existing.slideshowIds.push(slideshow.id);
              existing.slideshowNames.push(slideshow.name);
            } else {
              usageMap.set(photoId, {
                photoId,
                slideshowIds: [slideshow.id],
                slideshowNames: [slideshow.name],
              });
            }
          });
        });

        setPhotoUsageMap(usageMap);
        const unusedPhotos = photos.filter(p => !usageMap.has(p.id)).length;

        setStats({
          totalPhotos: photos.length,
          totalSize,
          oldestImport,
          newestImport,
          averageSize,
          unusedPhotos,
        });
      } catch (error) {
        console.error('[PhotoLibraryManager] Error calculating stats:', error);
      }
    };

    calculateStats();
  }, [photos, slideshows]);

  // Filter and sort photos
  const filteredAndSortedPhotos = useMemo(() => {
    let filtered = [...photos];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(photo => 
        photo.filename.toLowerCase().includes(query) ||
        photo.originalPath?.toLowerCase().includes(query)
      );
    }

    // Filter by unused only
    if (showUnusedOnly) {
      filtered = filtered.filter(photo => !photoUsageMap.has(photo.id));
    }

    // Sort photos
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.filename.localeCompare(b.filename);
        case 'date':
          return (b.importedAt || 0) - (a.importedAt || 0);
        case 'size':
          return (b.fileSize || 0) - (a.fileSize || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [photos, searchQuery, sortBy, showUnusedOnly, photoUsageMap]);

  // Toggle photo selection
  const togglePhotoSelection = (photoId: string) => {
    const newSelection = new Set(selectedPhotoIds);
    if (newSelection.has(photoId)) {
      newSelection.delete(photoId);
    } else {
      newSelection.add(photoId);
    }
    setSelectedPhotoIds(newSelection);
  };

  // Select all filtered photos
  const selectAllFiltered = () => {
    const allIds = new Set(filteredAndSortedPhotos.map(p => p.id));
    setSelectedPhotoIds(allIds);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedPhotoIds(new Set());
  };

  // Optimize storage (cleanup orphaned photos)
  const handleOptimizeStorage = async () => {
    setIsOptimizing(true);
    try {
      const result = await StorageOptimizationService.optimizeStorage();
      
      if (result.photosRemoved > 0) {
        await loadPhotos(); // Reload photos after cleanup
        await presentToast({
          message: `Optimized! Removed ${result.photosRemoved} orphaned photo${result.photosRemoved > 1 ? 's' : ''}, freed ${StorageOptimizationService.formatBytes(result.spaceFreed)}`,
          duration: 3000,
          color: 'success',
          position: 'top',
        });
      } else {
        await presentToast({
          message: 'Library already optimized - no orphaned photos found',
          duration: 2000,
          color: 'success',
          position: 'top',
        });
      }
    } catch (error) {
      console.error('[PhotoLibraryManager] Optimization error:', error);
      await presentToast({
        message: 'Failed to optimize storage',
        duration: 3000,
        color: 'danger',
        position: 'top',
      });
    } finally {
      setIsOptimizing(false);
    }
  };

  // Validate library photos
  const handleValidateLibrary = async () => {
    setIsCalculatingUsage(true);
    try {
      const validationResult = await PhotoLibraryService.validateLibraryPhotos(photos);
      
      if (validationResult.invalid.length > 0) {
        await presentActionSheet({
          header: `Found ${validationResult.invalid.length} Missing Photo${validationResult.invalid.length > 1 ? 's' : ''}`,
          subHeader: 'These photos can no longer be found at their original locations.',
          buttons: [
            {
              text: `Remove ${validationResult.invalid.length} Missing Photo${validationResult.invalid.length > 1 ? 's' : ''}`,
              role: 'destructive',
              handler: async () => {
                await handleBulkDelete(validationResult.invalid.map(p => p.id));
              },
            },
            {
              text: 'Cancel',
              role: 'cancel',
            },
          ],
        });
      } else {
        await presentToast({
          message: 'All photos validated successfully!',
          duration: 2000,
          color: 'success',
          position: 'top',
          icon: checkmarkCircleOutline,
        });
      }
    } catch (error) {
      console.error('[PhotoLibraryManager] Validation error:', error);
      await presentToast({
        message: 'Failed to validate library',
        duration: 3000,
        color: 'danger',
        position: 'top',
      });
    } finally {
      setIsCalculatingUsage(false);
    }
  };

  // Delete selected photos
  const handleDeleteSelected = async () => {
    if (selectedPhotoIds.size === 0) return;
    
    // Check if any selected photos are in use
    const photosInUse = Array.from(selectedPhotoIds).filter(id => photoUsageMap.has(id));
    
    if (photosInUse.length > 0) {
      const usage = photosInUse.map(id => {
        const u = photoUsageMap.get(id)!;
        const photo = photos.find(p => p.id === id);
        return `${photo?.filename || 'Unknown'}: ${u.slideshowNames.join(', ')}`;
      }).slice(0, 3).join('\n');
      
      await presentActionSheet({
        header: `${photosInUse.length} Selected Photo${photosInUse.length > 1 ? 's are' : ' is'} In Use`,
        subHeader: `These photos are used in slideshows:\n\n${usage}${photosInUse.length > 3 ? '\n...' : ''}`,
        buttons: [
          {
            text: 'Delete Anyway',
            role: 'destructive',
            handler: () => setShowDeleteAlert(true),
          },
          {
            text: 'Cancel',
            role: 'cancel',
          },
        ],
      });
    } else {
      setShowDeleteAlert(true);
    }
  };

  // Bulk delete photos
  const handleBulkDelete = async (photoIds: string[]) => {
    try {
      await PhotoLibraryService.deleteFromLibrary(photoIds);
      await loadPhotos();
      
      setSelectedPhotoIds(new Set());
      
      await presentToast({
        message: `${photoIds.length} photo${photoIds.length > 1 ? 's' : ''} removed from library`,
        duration: 2000,
        color: 'success',
        position: 'top',
      });
    } catch (error) {
      console.error('[PhotoLibraryManager] Delete error:', error);
      await presentToast({
        message: 'Failed to delete photos',
        duration: 3000,
        color: 'danger',
        position: 'top',
      });
    }
  };

  // Confirm and delete selected photos
  const confirmDelete = async () => {
    await handleBulkDelete(Array.from(selectedPhotoIds));
    setShowDeleteAlert(false);
  };

  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  // Format date
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (!isMacOS()) {
    return (
      <IonCard>
        <IonCardHeader>
          <IonCardTitle>
            <IonIcon icon={images} style={{ marginRight: '8px' }} />
            Photo Library Management
          </IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <IonText color="medium">
            <p>Photo library management is only available on macOS.</p>
          </IonText>
        </IonCardContent>
      </IonCard>
    );
  }

  return (
    <div className="photo-library-manager">
      {/* Statistics Card */}
      <IonCard>
        <IonCardHeader>
          <IonCardTitle>
            <IonIcon icon={statsChartOutline} style={{ marginRight: '8px' }} />
            Library Statistics
          </IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          {/* Storage Quota Warning */}
          {storageQuota && storageQuota.isCritical && (
            <IonText color="danger">
              <p style={{ margin: '0 0 12px 0', fontWeight: 500 }}>
                ⚠️ Storage critically low ({(storageQuota.usagePercentage * 100).toFixed(1)}%). Cleanup recommended.
              </p>
            </IonText>
          )}
          {storageQuota && storageQuota.isWarning && !storageQuota.isCritical && (
            <IonText color="warning">
              <p style={{ margin: '0 0 12px 0', fontWeight: 500 }}>
                Storage usage high ({(storageQuota.usagePercentage * 100).toFixed(1)}%). Consider cleanup.
              </p>
            </IonText>
          )}

          {stats ? (
            <IonGrid>
              <IonRow>
                <IonCol size="6">
                  <div className="stat-item">
                    <IonText color="medium">
                      <p className="stat-label">Total Photos</p>
                    </IonText>
                    <IonText>
                      <h2 className="stat-value">{stats.totalPhotos}</h2>
                    </IonText>
                  </div>
                </IonCol>
                <IonCol size="6">
                  <div className="stat-item">
                    <IonText color="medium">
                      <p className="stat-label">Total Size</p>
                    </IonText>
                    <IonText>
                      <h2 className="stat-value">{formatSize(stats.totalSize)}</h2>
                    </IonText>
                  </div>
                </IonCol>
              </IonRow>
              <IonRow>
                <IonCol size="6">
                  <div className="stat-item">
                    <IonText color="medium">
                      <p className="stat-label">Average Size</p>
                    </IonText>
                    <IonText>
                      <h3 className="stat-value">{formatSize(stats.averageSize)}</h3>
                    </IonText>
                  </div>
                </IonCol>
                <IonCol size="6">
                  <div className="stat-item">
                    <IonText color="medium">
                      <p className="stat-label">Unused Photos</p>
                    </IonText>
                    <IonText color={stats.unusedPhotos > 0 ? 'warning' : 'success'}>
                      <h3 className="stat-value">{stats.unusedPhotos}</h3>
                    </IonText>
                  </div>
                </IonCol>
              </IonRow>
              {storageQuota && (
                <IonRow>
                  <IonCol size="12">
                    <div className="stat-item">
                      <IonText color="medium">
                        <p className="stat-label">Storage Usage</p>
                      </IonText>
                      <IonText color={storageQuota.isCritical ? 'danger' : storageQuota.isWarning ? 'warning' : 'success'}>
                        <h3 className="stat-value">{(storageQuota.usagePercentage * 100).toFixed(1)}%</h3>
                      </IonText>
                    </div>
                  </IonCol>
                </IonRow>
              )}
            </IonGrid>
          ) : (
            <IonText color="medium">
              <p>No photos in library</p>
            </IonText>
          )}
        </IonCardContent>
      </IonCard>

      {/* Management Tools Card */}
      <IonCard>
        <IonCardHeader>
          <IonCardTitle>
            <IonIcon icon={images} style={{ marginRight: '8px' }} />
            Library Management
          </IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          {/* Action Buttons */}
          <div className="management-actions">
            <IonButton
              expand="block"
              color="primary"
              onClick={handleOptimizeStorage}
              disabled={isLoading || isOptimizing || photos.length === 0}
            >
              <IonIcon icon={refreshOutline} slot="start" />
              {isOptimizing ? 'Optimizing...' : 'Optimize Storage'}
            </IonButton>

            <IonButton
              expand="block"
              color="primary"
              onClick={handleValidateLibrary}
              disabled={isLoading || isCalculatingUsage || photos.length === 0}
            >
              <IonIcon icon={refreshOutline} slot="start" />
              Validate Library
            </IonButton>
            
            {stats && stats.unusedPhotos > 0 && (
              <IonButton
                expand="block"
                color="warning"
                onClick={() => setShowUnusedOnly(!showUnusedOnly)}
              >
                <IonIcon icon={funnelOutline} slot="start" />
                {showUnusedOnly ? 'Show All Photos' : `Show ${stats.unusedPhotos} Unused Photos`}
              </IonButton>
            )}

            {selectedPhotoIds.size > 0 && (
              <IonButton
                expand="block"
                color="danger"
                onClick={handleDeleteSelected}
              >
                <IonIcon icon={trashOutline} slot="start" />
                Delete {selectedPhotoIds.size} Selected
              </IonButton>
            )}
          </div>

          {/* Search and Sort */}
          {photos.length > 0 && (
            <div className="search-sort-controls">
              <IonSearchbar
                value={searchQuery}
                onIonInput={(e) => setSearchQuery(e.detail.value || '')}
                placeholder="Search by filename..."
                debounce={300}
              />
              
              <IonItem lines="none">
                <IonLabel>Sort By</IonLabel>
                <IonSelect
                  value={sortBy}
                  onIonChange={(e) => setSortBy(e.detail.value)}
                  interface="popover"
                >
                  <IonSelectOption value="date">Import Date</IonSelectOption>
                  <IonSelectOption value="name">Name</IonSelectOption>
                  <IonSelectOption value="size">File Size</IonSelectOption>
                </IonSelect>
              </IonItem>

              {filteredAndSortedPhotos.length > 0 && (
                <div className="selection-controls">
                  <IonButton size="small" fill="clear" onClick={selectAllFiltered}>
                    Select All ({filteredAndSortedPhotos.length})
                  </IonButton>
                  <IonButton size="small" fill="clear" onClick={clearSelection}>
                    Clear Selection
                  </IonButton>
                </div>
              )}
            </div>
          )}

          {/* Photo List */}
          {isLoading ? (
            <div className="loading-container">
              <IonSpinner />
              <IonText color="medium">Loading photos...</IonText>
            </div>
          ) : filteredAndSortedPhotos.length > 0 ? (
            <IonList className="photo-management-list">
              {filteredAndSortedPhotos.map((photo) => {
                const usage = photoUsageMap.get(photo.id);
                const isSelected = selectedPhotoIds.has(photo.id);
                
                return (
                  <IonItem key={photo.id} className="photo-management-item">
                    <IonCheckbox
                      slot="start"
                      checked={isSelected}
                      onIonChange={() => togglePhotoSelection(photo.id)}
                    />
                    
                    <div className="photo-thumbnail">
                      <img src={photo.thumbnailUri || photo.uri} alt={photo.filename} />
                    </div>
                    
                    <IonLabel className="photo-info">
                      <h3>{photo.filename}</h3>
                      <p>
                        {photo.fileSize && formatSize(photo.fileSize)}
                        {photo.importedAt && ` • ${formatDate(photo.importedAt)}`}
                      </p>
                      {usage && (
                        <p className="usage-info">
                          Used in {usage.slideshowIds.length} slideshow{usage.slideshowIds.length > 1 ? 's' : ''}
                        </p>
                      )}
                    </IonLabel>
                    
                    {usage ? (
                      <IonBadge color="success" slot="end">In Use</IonBadge>
                    ) : (
                      <IonBadge color="medium" slot="end">Unused</IonBadge>
                    )}
                  </IonItem>
                );
              })}
            </IonList>
          ) : (
            <IonText color="medium" className="empty-state">
              <p>
                {searchQuery ? 'No photos match your search' : 
                 showUnusedOnly ? 'No unused photos found' : 
                 'No photos in library'}
              </p>
            </IonText>
          )}
        </IonCardContent>
      </IonCard>

      {/* Delete Confirmation Alert */}
      <IonAlert
        isOpen={showDeleteAlert}
        onDidDismiss={() => setShowDeleteAlert(false)}
        header="Delete Photos?"
        message={`Are you sure you want to remove ${selectedPhotoIds.size} photo${selectedPhotoIds.size > 1 ? 's' : ''} from the library? Original files will be preserved.`}
        buttons={[
          {
            text: 'Cancel',
            role: 'cancel',
          },
          {
            text: 'Delete',
            role: 'destructive',
            handler: confirmDelete,
          },
        ]}
      />
    </div>
  );
};

export default PhotoLibraryManager;
